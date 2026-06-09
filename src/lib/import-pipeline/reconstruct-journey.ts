import { gateway } from "@ai-sdk/gateway";
import { generateObject } from "ai";
import { z } from "zod";
import type { ImportAdmin } from "./admin";
import type { JourneyResult, LeadGroup } from "./types";

const modelName = "anthropic/claude-sonnet-4.6";

const JourneySchema = z.object({
  summary: z.string().max(500),
  stage: z.string().max(80),
  nextStep: z.string().max(180),
  riskFlags: z.array(z.string().max(80)).max(6),
  events: z.array(z.object({
    eventDate: z.string().nullable(),
    eventType: z.string().max(50),
    source: z.string().nullable(),
    summary: z.string().max(220),
    confidence: z.enum(["high", "medium", "low"]),
  })).max(8),
  confidence: z.enum(["high", "medium", "low"]),
});

export function aiImportEnabled() {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

export async function reconstructJourney({
  admin,
  organizationId,
  importId,
  group,
}: {
  admin: ImportAdmin;
  organizationId: string;
  importId: string;
  group: LeadGroup;
}): Promise<JourneyResult> {
  if (!aiImportEnabled() || !shouldUseAi(group)) return fallbackJourney(group);

  const startedAt = Date.now();
  try {
    const result = await generateObject({
      model: gateway(modelName),
      schema: JourneySchema,
      temperature: 0,
      system: [
        "You reconstruct sales lead journeys from messy imported contact data.",
        "Only use the provided rows. Do not invent names, emails, phone numbers, dates, sources, or outcomes.",
        "Return a concise operational summary, likely current stage, next action, risk flags, and timeline events.",
        "If consent or do-not-contact status is unclear, include a risk flag and lower confidence.",
        "Never recommend outbound contact for opt-out, STOP, unsubscribe, or do-not-contact records.",
      ].join(" "),
      prompt: JSON.stringify({
        normalizedLead: group.normalized,
        rows: group.rows.map((row) => ({
          rowNumber: row.rowNumber,
          raw: row.raw,
          text: row.text.slice(0, 1200),
        })),
      }),
    });

    const usage = result.usage;
    const { data: aiRun } = await admin.from("ai_runs").insert({
      organization_id: organizationId,
      import_id: importId,
      purpose: "import_journey_reconstruction",
      model: modelName,
      input_tokens: usage?.inputTokens ?? null,
      output_tokens: usage?.outputTokens ?? null,
      latency_ms: Date.now() - startedAt,
      status: "completed",
      cost_metadata: { row_count: group.rows.length },
    }).select("id").single();

    return {
      ...result.object,
      modelUsed: modelName,
      aiRunId: aiRun?.id ?? null,
    };
  } catch (error) {
    await admin.from("ai_runs").insert({
      organization_id: organizationId,
      import_id: importId,
      purpose: "import_journey_reconstruction",
      model: modelName,
      latency_ms: Date.now() - startedAt,
      status: "failed",
      cost_metadata: { row_count: group.rows.length, error: error instanceof Error ? error.message : String(error) },
    });
    return fallbackJourney(group);
  }
}

export function fallbackJourney(group: LeadGroup): JourneyResult {
  const lead = group.normalized;
  const summary = lead.notes || `${lead.name} was imported from ${lead.source || "a lead file"} with stage ${lead.stage}.`;
  return {
    summary: summary.slice(0, 500),
    stage: lead.stage,
    nextStep: nextStepForStage(lead.stage),
    riskFlags: lead.consent === "review" ? ["Consent unclear"] : lead.consent === "do_not_contact" ? ["Do not contact"] : [],
    events: group.rows.slice(0, 8).map((row) => ({
      eventDate: lead.lastContactAt,
      eventType: "imported_touchpoint",
      source: lead.source,
      summary: (row.text || summary).slice(0, 220),
      confidence: "medium",
    })),
    confidence: group.rows.length > 1 ? "medium" : "high",
    modelUsed: null,
    aiRunId: null,
  };
}

function shouldUseAi(group: LeadGroup) {
  const notes = `${group.normalized.notes ?? ""} ${group.rows.map((row) => row.text).join(" ")}`;
  if (group.rows.length > 1) return true;
  if (notes.length > 240) return true;
  return /(facebook|imessage|texted|called|application|docs|declined|funded elsewhere|realtor)/i.test(notes);
}

function nextStepForStage(stage: string) {
  if (stage === "needs_consent") return "Review consent/source before adding this person to outreach.";
  if (stage === "application_sent_not_started") return "Resend the application link and offer help with the first step.";
  if (stage === "application_started_not_submitted") return "Help the borrower finish and submit the application.";
  if (stage === "docs_needed_preapproval_stuck") return "Follow up on missing documents or signatures.";
  if (stage === "preapproval_declined_not_ready") return "Check whether the blocker has changed and offer a fresh path review.";
  if (stage === "loan_process_dead") return "Ask whether timing or lending options have changed since the file died.";
  if (stage === "past_client_referral_partner") return "Send a relationship-first check-in.";
  return "Send a soft follow-up and move the lead toward the next clear step.";
}
