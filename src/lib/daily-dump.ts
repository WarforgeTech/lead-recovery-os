import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";
import type { WorkflowOutcome } from "./mortgage-workflow";

export type DailyDumpContact = {
  opportunityId: string;
  name: string;
  source?: string | null;
  stage?: string | null;
  owner?: string | null;
};

export type DailyDumpUpdate = {
  opportunityId: string | null;
  contactName: string;
  outcome: WorkflowOutcome;
  note: string;
  confidence: "high" | "medium" | "low";
};

export type DailyDumpResult = {
  updates: DailyDumpUpdate[];
  unmatched: Array<{ contactName: string; note: string; reason: string }>;
};

export function dailyDumpAiEnabled() {
  return Boolean(process.env.AI_GATEWAY_API_KEY);
}

export async function parseDailyDump(input: string, contacts: DailyDumpContact[]): Promise<DailyDumpResult> {
  if (!dailyDumpAiEnabled()) return fallbackParseDailyDump(input, contacts);

  const result = await generateText({
    model: gateway("openai/gpt-5.5"),
    temperature: 0,
    system: [
      "You extract end-of-day sales updates from a loan officer or assistant.",
      "Only match a person to one of the provided contacts. Never invent people.",
      "Return strict JSON only with shape: {\"updates\":[],\"unmatched\":[]}.",
      "Allowed outcomes: mark_contacted, no_response, replied, application_submitted, appointment_set, needs_adam, snooze, not_now, do_not_contact.",
      "Use no_response when contacted but nobody replied. Use replied when borrower responded. Use appointment_set for calls/meetings booked.",
      "Use application_submitted only when an application was actually submitted.",
      "Use needs_adam when the assistant says Adam must handle it.",
      "Use not_now for delayed or paused buyers. Use do_not_contact only for opt-out language.",
      "Do not include emails, phone numbers, or message text beyond the user's short note.",
    ].join(" "),
    prompt: [
      "Known contacts:",
      JSON.stringify(contacts),
      "",
      "End-of-day dump:",
      input,
      "",
      "Return JSON. Each update must include opportunityId, contactName, outcome, note, confidence.",
      "If you cannot confidently match a name, put it in unmatched with contactName, note, reason.",
    ].join("\n"),
  });

  return normalizeParsedDump(result.text, contacts);
}

function normalizeParsedDump(text: string, contacts: DailyDumpContact[]): DailyDumpResult {
  const parsed = safeJson(text);
  if (!parsed || typeof parsed !== "object") return { updates: [], unmatched: [{ contactName: "Unknown", note: text.slice(0, 180), reason: "AI response was not parseable JSON" }] };
  const contactIds = new Set(contacts.map((contact) => contact.opportunityId));
  const updates: unknown[] = Array.isArray(parsed.updates) ? parsed.updates : [];
  const unmatched: unknown[] = Array.isArray(parsed.unmatched) ? parsed.unmatched : [];

  return {
    updates: updates
      .map((item) => {
        const record = isRecord(item) ? item : {};
        return {
        opportunityId: typeof record.opportunityId === "string" && contactIds.has(record.opportunityId) ? record.opportunityId : null,
        contactName: String(record.contactName ?? "").trim(),
        outcome: normalizeOutcome(record.outcome),
        note: String(record.note ?? "").trim().slice(0, 500),
        confidence: normalizeConfidence(record.confidence),
        };
      })
      .filter((item) => item.opportunityId && item.contactName && item.note),
    unmatched: unmatched.map((item) => {
      const record = isRecord(item) ? item : {};
      return {
        contactName: String(record.contactName ?? "Unknown").trim() || "Unknown",
        note: String(record.note ?? "").trim().slice(0, 500),
        reason: String(record.reason ?? "Could not match to a known contact").trim(),
      };
    }),
  };
}

function fallbackParseDailyDump(input: string, contacts: DailyDumpContact[]): DailyDumpResult {
  const lines = input
    .split(/\n|;|(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim().replace(/[.!?]+$/, ""))
    .filter(Boolean);
  const updates: DailyDumpUpdate[] = [];
  const unmatched: DailyDumpResult["unmatched"] = [];
  for (const line of lines) {
    const contact = contacts.find((candidate) => line.toLowerCase().includes(candidate.name.toLowerCase()));
    if (!contact) {
      unmatched.push({ contactName: "Unknown", note: line, reason: "No exact contact name match" });
      continue;
    }
    updates.push({
      opportunityId: contact.opportunityId,
      contactName: contact.name,
      outcome: inferOutcome(line),
      note: line,
      confidence: "medium",
    });
  }
  return { updates, unmatched };
}

function inferOutcome(text: string): WorkflowOutcome {
  const value = text.toLowerCase();
  if (/(appointment|meeting|call booked|booked (a )?(call|review)|scheduled|set a call|set an appointment)/.test(value)) return "appointment_set";
  if (/(submitted|finished app|completed app|application complete)/.test(value)) return "application_submitted";
  if (/(replied|responded|texted back|called back)/.test(value)) return "replied";
  if (/(no response|didn't respond|did not respond|left voicemail|no reply)/.test(value)) return "no_response";
  if (/(adam|loan officer|needs him)/.test(value)) return "needs_adam";
  if (/(not now|paused|later|wait)/.test(value)) return "not_now";
  if (/(opted out|do not contact|stop texting|unsubscribe)/.test(value)) return "do_not_contact";
  return "mark_contacted";
}

function normalizeOutcome(value: unknown): WorkflowOutcome {
  const text = String(value ?? "");
  const allowed: WorkflowOutcome[] = ["mark_contacted", "no_response", "replied", "application_submitted", "appointment_set", "needs_adam", "snooze", "not_now", "do_not_contact"];
  return allowed.includes(text as WorkflowOutcome) ? text as WorkflowOutcome : "mark_contacted";
}

function normalizeConfidence(value: unknown): "high" | "medium" | "low" {
  return value === "high" || value === "low" ? value : "medium";
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
