"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { archiveImportCsv } from "@/lib/import-archive";
import { refineFollowUpDraft } from "@/lib/ai-drafts";
import { parseCsv, inferMapping, applyMapping, type Mapping } from "@/lib/csv";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { requireAdmin, requireUser } from "@/lib/data";
import { traceAsync } from "@/lib/tracing";
import type { ConsentStatus, OpportunityStatus } from "@/lib/types";
import { parseDailyDump } from "@/lib/daily-dump";
import { applyWorkflowOutcome, type WorkflowOutcome } from "@/lib/mortgage-workflow";
import {
  classifyPipelineOpportunity,
  defaultOrganizationSettings,
  getPipelineTemplateId,
} from "@/lib/pipeline-templates";

const ACCEPT_CONCURRENCY = 8;

// Bounded-concurrency worker pool: runs `fn` over items with at most `limit`
// in flight. Keeps the accept step fast without opening unbounded DB connections.
async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      await fn(items[current]);
    }
  });
  await Promise.all(workers);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createOrganization(formData: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  const clientType = String(formData.get("client_type") ?? "agent").trim();
  const pipelineTemplate = getPipelineTemplateId(String(formData.get("pipeline_template") ?? "real_estate_default"));
  const market = String(formData.get("market") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) throw new Error("Organization name is required");

  const org = await traceAsync("organization.create", { client_type: clientType, pipeline_template: pipelineTemplate, has_client_email: Boolean(email) }, async () => {
    const { data: createdOrg, error } = await admin
      .from("organizations")
      .insert({
        name,
        client_type: clientType,
        pipeline_template: pipelineTemplate,
        organization_settings: defaultOrganizationSettings(pipelineTemplate),
        market,
        status: "pilot",
      })
      .select()
      .single();
    if (error) throw error;

    const members: Array<{ organization_id: string; email: string; user_id?: string | null; role: string }> = [
      { organization_id: createdOrg.id, email: user.email!, user_id: user.id, role: "admin" },
    ];
    if (email) members.push({ organization_id: createdOrg.id, email, user_id: null, role: "client" });

    const { error: memberError } = await admin.from("organization_members").insert(members);
    if (memberError) throw memberError;

    await admin.from("activity_log").insert({
      organization_id: createdOrg.id,
      actor_user_id: user.id,
      event: "organization_created",
      metadata: { name, email, pipeline_template: pipelineTemplate },
    });

    return createdOrg;
  });

  revalidatePath("/admin");
  redirect(`/admin/organizations/${org.id}`);
}

export async function createSelfServeWorkspace(formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  const clientType = String(formData.get("client_type") ?? "agent").trim();
  const pipelineTemplate = getPipelineTemplateId(String(formData.get("pipeline_template") ?? "real_estate_default"));
  const market = String(formData.get("market") ?? "").trim();
  if (!name) throw new Error("Workspace name is required");
  if (!user.email) throw new Error("User email is required");

  await traceAsync("workspace.self_serve_create", { client_type: clientType, pipeline_template: pipelineTemplate }, async () => {
    const { data: existing } = await admin
      .from("organization_members")
      .select("organization_id")
      .or(`user_id.eq.${user.id},email.eq.${user.email!.toLowerCase()}`)
      .limit(1)
      .maybeSingle();
    if (existing?.organization_id) return existing.organization_id;

    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({
        name,
        client_type: clientType,
        pipeline_template: pipelineTemplate,
        organization_settings: defaultOrganizationSettings(pipelineTemplate),
        market,
        status: "pilot",
        notes: "Self-serve free workspace.",
      })
      .select("id")
      .single();
    if (orgError) throw orgError;

    const { error: memberError } = await admin.from("organization_members").insert({
      organization_id: org.id,
      email: user.email!.toLowerCase(),
      user_id: user.id,
      role: "owner",
    });
    if (memberError) throw memberError;

    await admin.from("activity_log").insert({
      organization_id: org.id,
      actor_user_id: user.id,
      event: "self_serve_workspace_created",
      metadata: { pipeline_template: pipelineTemplate, client_type: clientType },
    });

    return org.id;
  });

  revalidatePath("/dashboard");
  redirect("/onboarding/import");
}

export async function addOrganizationMember(formData: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const organizationId = String(formData.get("organization_id"));
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "client");
  if (!organizationId || !email) throw new Error("Organization and email are required");

  const { error } = await admin
    .from("organization_members")
    .upsert({ organization_id: organizationId, email, role }, { onConflict: "organization_id,email" });
  if (error) throw error;

  await admin.from("activity_log").insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    event: "member_added",
    metadata: { email, role },
  });

  revalidatePath(`/admin/organizations/${organizationId}`);
}

export async function importContacts(formData: FormData) {
  const user = await requireAdmin();
  const admin = createAdminClient();
  const organizationId = String(formData.get("organization_id"));
  const csvText = String(formData.get("csv") ?? "");
  const sourceFilename = String(formData.get("source_filename") ?? "manual-import.csv");
  if (!organizationId || !csvText.trim()) throw new Error("Organization and CSV are required");

  const importRow = await traceAsync("import.process", { organization_id: organizationId }, async () => {
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("pipeline_template")
      .eq("id", organizationId)
      .single();
    if (organizationError) throw organizationError;
    const templateId = getPipelineTemplateId(organization.pipeline_template);
    const rows = parseCsv(csvText);
    const headers = Object.keys(rows[0] ?? {});
    const inferred = inferMapping(headers);
    const mapping: Mapping = {
      name: field(formData, "map_name") || inferred.name,
      email: field(formData, "map_email") || inferred.email,
      phone: field(formData, "map_phone") || inferred.phone,
      source: field(formData, "map_source") || inferred.source,
      leadType: field(formData, "map_lead_type") || inferred.leadType,
      area: field(formData, "map_area") || inferred.area,
      priceRange: field(formData, "map_price_range") || inferred.priceRange,
      timeline: field(formData, "map_timeline") || inferred.timeline,
      lastContactAt: field(formData, "map_last_contact") || inferred.lastContactAt,
      consent: field(formData, "map_consent") || inferred.consent,
      ownerName: field(formData, "map_owner") || inferred.ownerName,
      notes: field(formData, "map_notes") || inferred.notes,
      currentStatus: field(formData, "map_current_status") || inferred.currentStatus,
      loanIntent: field(formData, "map_loan_intent") || inferred.loanIntent,
      estimatedLoanAmount: field(formData, "map_estimated_loan_amount") || inferred.estimatedLoanAmount,
      referralSource: field(formData, "map_referral_source") || inferred.referralSource,
      missingNextStep: field(formData, "map_missing_next_step") || inferred.missingNextStep,
      lastMeaningfulContact: field(formData, "map_last_meaningful_contact") || inferred.lastMeaningfulContact,
      docsMissing: field(formData, "map_docs_missing") || inferred.docsMissing,
    };

    const contacts = applyMapping(rows, mapping);
    const unique = new Map<string, (typeof contacts)[number]>();
    let duplicates = 0;
    let missingContact = 0;
    let held = 0;

    for (const contact of contacts) {
      if (!contact.email && !contact.phone) missingContact += 1;
      if (contact.consent !== "ok") held += 1;
      const key = contact.email || contact.phone || `${contact.name}:${contact.source ?? ""}`;
      if (unique.has(key)) {
        duplicates += 1;
        continue;
      }
      unique.set(key, contact);
    }

    const archive = await archiveImportCsv({ admin, organizationId, sourceFilename, csvText });

    const processedContacts = Array.from(unique.values());
    const priorityCount = processedContacts.filter((contact) => {
      const classification = classifyPipelineOpportunity(contact, templateId);
      return classification.segment !== "needs_consent" && classification.priorityScore >= 70;
    }).length;

    const { data: createdImport, error: importError } = await admin
      .from("imports")
      .insert({
        organization_id: organizationId,
        uploaded_by: user.id,
        source_filename: sourceFilename,
        raw_file_path: archive.path,
        raw_storage_provider: archive.provider,
        raw_file_url: archive.url,
        archived_at: archive.archivedAt,
        status: "processed",
        mapping: { ...mapping, pipeline_template: templateId },
        total_rows: rows.length,
        processed_rows: processedContacts.length,
        duplicate_rows: duplicates,
        missing_contact_rows: missingContact,
        held_for_review_rows: held,
        priority_opportunities: priorityCount,
        processed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (importError) throw importError;

    for (const contact of processedContacts) {
      const classification = classifyPipelineOpportunity(contact, templateId);
      const { data: insertedContact, error: contactError } = await admin
        .from("contacts")
        .insert({
          organization_id: organizationId,
          import_id: createdImport.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          source: contact.source,
          lead_type: contact.leadType,
          area: contact.area,
          price_range: contact.priceRange,
          timeline: contact.timeline,
          last_contact_at: contact.lastContactAt,
          consent: contact.consent,
          owner_name: contact.ownerName,
          raw_notes: contact.rawNotes,
          normalized_summary: contact.normalizedSummary,
          pipeline_metadata: classification.contactMetadata,
        })
        .select()
        .single();
      if (contactError) throw contactError;

      const { data: opportunity, error: opportunityError } = await admin
        .from("lead_opportunities")
        .insert({
          organization_id: organizationId,
          contact_id: insertedContact.id,
          segment: classification.segment,
          status: classification.status,
          priority_score: classification.priorityScore,
          estimated_value_cents: classification.estimatedValueCents,
          recommended_action: classification.recommendedAction,
          pipeline_metadata: classification.opportunityMetadata,
        })
        .select()
        .single();
      if (opportunityError) throw opportunityError;

      const draft = classification.draftText;
      if (draft) {
        const { error: draftError } = await admin.from("message_drafts").insert({
          organization_id: organizationId,
          contact_id: insertedContact.id,
          opportunity_id: opportunity.id,
          draft_text: draft,
        });
        if (draftError) throw draftError;
      }
    }

    await admin.from("activity_log").insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      event: "contacts_imported",
      metadata: {
        import_id: createdImport.id,
        processed: processedContacts.length,
        archive_provider: archive.provider,
      },
    });

    return createdImport;
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect(`/admin/imports/${importRow.id}`);
}

export async function updateOpportunity(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const opportunityId = String(formData.get("opportunity_id"));
  const status = String(formData.get("status")) as OpportunityStatus;
  const draftId = String(formData.get("draft_id") ?? "");
  const editedText = String(formData.get("edited_text") ?? "").trim();

  await traceAsync("opportunity.update", { opportunity_id: opportunityId, status, has_draft: Boolean(draftId) }, async () => {
    const { data: opportunity, error: oppError } = await supabase
      .from("lead_opportunities")
      .update({ status })
      .eq("id", opportunityId)
      .select("organization_id")
      .single();
    if (oppError) throw oppError;

    if (draftId && editedText) {
      const approvalStatus = status === "approved" ? "approved" : "edited";
      const { error: draftError } = await supabase
        .from("message_drafts")
        .update({
          edited_text: editedText,
          approval_status: approvalStatus,
          approved_by: approvalStatus === "approved" ? user.id : null,
          approved_at: approvalStatus === "approved" ? new Date().toISOString() : null,
        })
        .eq("id", draftId);
      if (draftError) throw draftError;
    }

    await supabase.from("activity_log").insert({
      organization_id: opportunity.organization_id,
      actor_user_id: user.id,
      event: "opportunity_updated",
      metadata: { opportunity_id: opportunityId, status },
    });
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${opportunityId}`);
  revalidatePath("/queue");
  revalidatePath("/dashboard");
}

export async function updateLeadOutcome(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const opportunityId = String(formData.get("opportunity_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "mark_contacted") as WorkflowOutcome;
  const snoozeDays = Number(formData.get("snooze_days") ?? 3);
  if (!opportunityId) throw new Error("Opportunity is required");

  await traceAsync("opportunity.outcome", { opportunity_id: opportunityId, outcome }, async () => {
    const { data: opportunity, error } = await supabase
      .from("lead_opportunities")
      .select("id, organization_id, status, pipeline_metadata")
      .eq("id", opportunityId)
      .single();
    if (error) throw error;

    const update = applyWorkflowOutcome({
      currentMetadata: opportunity.pipeline_metadata,
      currentStatus: opportunity.status,
      outcome,
      snoozeDays,
    });

    const { error: updateError } = await supabase
      .from("lead_opportunities")
      .update({
        status: update.status,
        next_follow_up_at: update.nextFollowUpAt,
        pipeline_metadata: update.metadata,
      })
      .eq("id", opportunityId);
    if (updateError) throw updateError;

    await supabase.from("activity_log").insert({
      organization_id: opportunity.organization_id,
      actor_user_id: user.id,
      event: "lead_outcome_updated",
      metadata: { opportunity_id: opportunityId, outcome, label: update.eventLabel },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/leads");
  revalidatePath(`/leads/${opportunityId}`);
}

export type DailyDumpState = {
  status: "idle" | "success" | "error";
  message: string;
  updated: number;
  unmatched: number;
};

export async function processDailyDump(_previousState: DailyDumpState, formData: FormData): Promise<DailyDumpState> {
  const user = await requireUser();
  const supabase = await createClient();
  const organizationId = String(formData.get("organization_id") ?? "");
  const dump = String(formData.get("daily_dump") ?? "").trim();
  if (!organizationId || !dump) return { status: "error", message: "Paste an end-of-day update first.", updated: 0, unmatched: 0 };

  const { data: opportunities, error } = await supabase
    .from("lead_opportunities")
    .select("id, status, pipeline_metadata, contact:contacts(name, source, owner_name)")
    .eq("organization_id", organizationId);
  if (error) throw error;

  const contacts = (opportunities ?? []).map((item) => {
    const contact = Array.isArray(item.contact) ? item.contact[0] : item.contact;
    return {
      opportunityId: item.id,
      name: contact?.name ?? "Unknown",
      source: contact?.source ?? null,
      stage: typeof item.pipeline_metadata?.pipeline_stage === "string" ? item.pipeline_metadata.pipeline_stage : null,
      owner: contact?.owner_name ?? null,
    };
  });

  const parsed = await parseDailyDump(dump, contacts);
  let updated = 0;

  for (const item of parsed.updates) {
    const opportunity = (opportunities ?? []).find((candidate) => candidate.id === item.opportunityId);
    if (!opportunity) continue;
    const outcomeUpdate = applyWorkflowOutcome({
      currentMetadata: {
        ...(opportunity.pipeline_metadata ?? {}),
        last_dump_note: item.note,
        last_dump_confidence: item.confidence,
      },
      currentStatus: opportunity.status,
      outcome: item.outcome,
    });
    const { error: updateError } = await supabase
      .from("lead_opportunities")
      .update({
        status: outcomeUpdate.status,
        next_follow_up_at: outcomeUpdate.nextFollowUpAt,
        pipeline_metadata: outcomeUpdate.metadata,
      })
      .eq("id", item.opportunityId);
    if (updateError) throw updateError;
    updated += 1;

    await supabase.from("activity_log").insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      event: "daily_dump_update_applied",
      metadata: {
        opportunity_id: item.opportunityId,
        contact_name: item.contactName,
        outcome: item.outcome,
        confidence: item.confidence,
        note: item.note,
      },
    });
  }

  if (parsed.unmatched.length) {
    await supabase.from("activity_log").insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      event: "daily_dump_unmatched",
      metadata: { items: parsed.unmatched },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/leads");

  return {
    status: "success",
    message: `Applied ${updated} update${updated === 1 ? "" : "s"}. ${parsed.unmatched.length ? `${parsed.unmatched.length} item${parsed.unmatched.length === 1 ? "" : "s"} need review.` : "No unmatched items."}`,
    updated,
    unmatched: parsed.unmatched.length,
  };
}

export async function refineDraftWithAi(formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const opportunityId = String(formData.get("opportunity_id"));
  const draftId = String(formData.get("draft_id") ?? "");
  const currentDraft = String(formData.get("edited_text") ?? "").trim();

  if (!opportunityId || !draftId || !currentDraft) {
    throw new Error("A draft is required before AI refinement.");
  }

  await traceAsync("draft.refine_ai", { opportunity_id: opportunityId, model: "openai/gpt-5.5" }, async () => {
    const { data: opportunity, error: opportunityError } = await supabase
      .from("lead_opportunities")
      .select("id, organization_id, segment, contact:contacts(source, area, price_range, timeline, normalized_summary)")
      .eq("id", opportunityId)
      .single();
    if (opportunityError) throw opportunityError;

    const contact = Array.isArray(opportunity.contact) ? opportunity.contact[0] : opportunity.contact;
    const refined = await refineFollowUpDraft({
      segment: opportunity.segment,
      source: contact?.source ?? null,
      area: contact?.area ?? null,
      priceRange: contact?.price_range ?? null,
      timeline: contact?.timeline ?? null,
      normalizedSummary: contact?.normalized_summary ?? null,
      currentDraft,
    });

    const { error: draftError } = await supabase
      .from("message_drafts")
      .update({
        edited_text: refined.text,
        approval_status: "edited",
        model_used: "openai/gpt-5.5",
        generated_at: new Date().toISOString(),
        ai_generation_notes: {
          finish_reason: refined.finishReason,
          usage: refined.usage,
        },
      })
      .eq("id", draftId);
    if (draftError) throw draftError;

    await supabase.from("activity_log").insert({
      organization_id: opportunity.organization_id,
      actor_user_id: user.id,
      event: "draft_refined_ai",
      metadata: { opportunity_id: opportunityId, model: "openai/gpt-5.5" },
    });
  });

  revalidatePath(`/leads/${opportunityId}`);
}

export async function acceptStagedImport(formData: FormData) {
  const user = await requireUser();
  const admin = createAdminClient();
  const importId = String(formData.get("import_id") ?? "");
  if (!importId) throw new Error("Import is required");

  await traceAsync("import.accept", { import_id: importId }, async () => {
    const { data: importRow, error: importError } = await admin
      .from("imports")
      .select("id, organization_id, source_kind, workflow_status, organization:organizations(pipeline_template)")
      .eq("id", importId)
      .single();
    if (importError) throw importError;

    const organizationId = importRow.organization_id;
    await assertCanAcceptImport(admin, organizationId, user.id, user.email ?? "");

    const { data: readyRows, error: readyError } = await admin
      .from("import_rows")
      .select("*")
      .eq("import_id", importId)
      .eq("review_status", "ready")
      .order("row_number", { ascending: true });
    if (readyError) throw readyError;

    const { data: suppressedRows, error: suppressedError } = await admin
      .from("import_rows")
      .select("*")
      .eq("import_id", importId)
      .eq("review_status", "suppressed")
      .order("row_number", { ascending: true });
    if (suppressedError) throw suppressedError;

    // Commit rows with bounded concurrency instead of one-at-a-time. Accepting a
    // large import previously did hundreds of sequential round-trips (the "10s
    // freeze"); parallelizing across rows collapses it to ~1-2s.
    await mapWithConcurrency(suppressedRows ?? [], ACCEPT_CONCURRENCY, async (row) => {
      const normalized = row.normalized_record as Record<string, unknown>;
      await Promise.all([
        admin.from("contact_exclusions").insert({
          organization_id: organizationId,
          contact_id: row.matched_contact_id,
          kind: String(row.suppression_reason ?? "suppression").toLowerCase().includes("do not") ? "dnc" : "suppression",
          email: stringOrNull(normalized.email),
          phone: stringOrNull(normalized.phone),
          normalized_name: stringOrNull(normalized.name)?.toLowerCase() ?? null,
          reason: row.suppression_reason ?? "Suppressed during import review",
          source_import_id: importId,
          created_by: user.id,
        }),
        admin.from("import_merge_decisions").insert({
          organization_id: organizationId,
          import_id: importId,
          import_row_id: row.id,
          contact_id: row.matched_contact_id,
          decision: "excluded",
          reason: row.suppression_reason,
          decided_by: user.id,
        }),
      ]);
    });

    const organization = Array.isArray(importRow.organization) ? importRow.organization[0] : importRow.organization;
    const templateId = getPipelineTemplateId(organization?.pipeline_template);

    await mapWithConcurrency(readyRows ?? [], ACCEPT_CONCURRENCY, async (row) => {
      const normalized = row.normalized_record as Record<string, unknown>;
      const journey = row.journey as Record<string, unknown>;
      const existingContactId = stringOrNull(row.matched_contact_id);
      const contactConsent: ConsentStatus = normalized.consent === "do_not_contact" ? "do_not_contact" : normalized.consent === "review" ? "review" : "ok";
      const contactPayload = {
        organization_id: organizationId,
        import_id: importId,
        name: stringOrNull(normalized.name) ?? "Imported Lead",
        email: stringOrNull(normalized.email),
        phone: stringOrNull(normalized.phone),
        source: stringOrNull(normalized.source),
        lead_type: stringOrNull(normalized.status) ?? stringOrNull(normalized.stage),
        area: null,
        price_range: normalized.estimatedValue ? `$${normalized.estimatedValue}` : null,
        timeline: null,
        last_contact_at: stringOrNull(normalized.lastContactAt),
        consent: contactConsent,
        owner_name: stringOrNull(normalized.owner),
        raw_notes: stringOrNull(normalized.notes),
        normalized_summary: stringOrNull(journey.summary) ?? stringOrNull(normalized.notes) ?? "Imported lead record.",
        pipeline_metadata: {
          imported_stage: stringOrNull(normalized.stage),
          journey,
          source_kind: stringOrNull(normalized.sourceKind),
        },
      };

      // Contact must exist before its dependent rows; everything after is independent.
      const contactId = existingContactId
        ? await updateExistingContact(admin, existingContactId, contactPayload)
        : await insertNewContact(admin, contactPayload);

      const classification = classifyPipelineOpportunity({
        name: contactPayload.name,
        email: contactPayload.email,
        phone: contactPayload.phone,
        source: contactPayload.source,
        leadType: contactPayload.lead_type,
        area: null,
        priceRange: contactPayload.price_range,
        timeline: null,
        lastContactAt: contactPayload.last_contact_at,
        consent: contactPayload.consent,
        ownerName: contactPayload.owner_name,
        rawNotes: contactPayload.raw_notes,
        normalizedSummary: contactPayload.normalized_summary,
        pipelineMetadata: {
          current_status: stringOrNull(normalized.status),
          estimated_loan_amount: Number(normalized.estimatedValue) || null,
          missing_next_step: stringOrNull(journey.nextStep),
          last_meaningful_contact: contactPayload.last_contact_at,
          imported_stage: stringOrNull(normalized.stage),
        },
      }, templateId);

      const eventRows = (Array.isArray(journey.events) ? journey.events : [])
        .map((event) => event as Record<string, unknown>)
        .filter((item) => stringOrNull(item.summary))
        .map((item) => ({
          organization_id: organizationId,
          contact_id: contactId,
          import_id: importId,
          event_date: stringOrNull(item.eventDate),
          event_type: stringOrNull(item.eventType) ?? "imported_touchpoint",
          source: stringOrNull(item.source),
          summary: stringOrNull(item.summary),
          confidence: stringOrNull(item.confidence) ?? row.confidence,
          raw_refs: { import_row_id: row.id, row_number: row.row_number },
        }));

      await Promise.all([
        upsertIdentity(admin, organizationId, contactId, "email", stringOrNull(normalized.email), importId),
        upsertIdentity(admin, organizationId, contactId, "phone", stringOrNull(normalized.phone), importId),
        upsertIdentity(admin, organizationId, contactId, "name_source", `${stringOrNull(normalized.name)?.toLowerCase() ?? ""}:${stringOrNull(normalized.source)?.toLowerCase() ?? ""}`, importId),
        eventRows.length ? admin.from("contact_journey_events").insert(eventRows) : Promise.resolve(),
        (async () => {
          const opportunityId = await upsertOpportunity(admin, organizationId, contactId, classification);
          if (classification.draftText) {
            await upsertDraft(admin, organizationId, contactId, opportunityId, classification.draftText);
          }
        })(),
        admin.from("import_merge_decisions").insert({
          organization_id: organizationId,
          import_id: importId,
          import_row_id: row.id,
          contact_id: contactId,
          decision: existingContactId ? "merge" : "create",
          reason: row.proposed_action,
          decided_by: user.id,
          metadata: { dedupe_key: row.dedupe_key },
        }),
      ]);
    });

    await admin.from("imports").update({
      workflow_status: "accepted",
      workflow_phase: "accepted",
      workflow_percent: 100,
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
    }).eq("id", importId);

    await admin.from("import_jobs").update({
      status: "accepted",
      phase: "accepted",
      percent: 100,
      completed_at: new Date().toISOString(),
    }).eq("import_id", importId);

    await admin.from("activity_log").insert({
      organization_id: organizationId,
      actor_user_id: user.id,
      event: "self_serve_import_accepted",
      metadata: {
        import_id: importId,
        ready: readyRows?.length ?? 0,
        suppressed: suppressedRows?.length ?? 0,
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/imports");
  // Return to the imports list, which now shows this import with a green
  // "Imported" check — so the user can see it completed before moving on to the
  // queue (rather than being dropped on the dashboard with no confirmation).
  redirect("/imports");
}

function field(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

async function assertCanAcceptImport(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  userId: string,
  email: string,
) {
  const { data, error } = await admin
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .in("role", ["owner", "admin"])
    .or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("You do not have permission to accept this import.");
}

function stringOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

async function insertNewContact(admin: ReturnType<typeof createAdminClient>, payload: Record<string, unknown>) {
  const { data, error } = await admin.from("contacts").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function updateExistingContact(admin: ReturnType<typeof createAdminClient>, contactId: string, payload: Record<string, unknown>) {
  const { data, error } = await admin
    .from("contacts")
    .update({
      source: payload.source,
      lead_type: payload.lead_type,
      last_contact_at: payload.last_contact_at,
      owner_name: payload.owner_name,
      raw_notes: payload.raw_notes,
      normalized_summary: payload.normalized_summary,
      pipeline_metadata: payload.pipeline_metadata,
    })
    .eq("id", contactId)
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertIdentity(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  contactId: string,
  kind: string,
  normalizedValue: string | null,
  importId: string,
) {
  if (!normalizedValue) return;
  await admin.from("contact_identities").upsert({
    organization_id: organizationId,
    contact_id: contactId,
    kind,
    normalized_value: normalizedValue,
    confidence: "high",
    source_import_id: importId,
  }, { onConflict: "organization_id,kind,normalized_value" });
}

async function upsertOpportunity(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  contactId: string,
  classification: ReturnType<typeof classifyPipelineOpportunity>,
) {
  const { data: existing } = await admin
    .from("lead_opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    const { data, error } = await admin
      .from("lead_opportunities")
      .update({
        segment: classification.segment,
        status: classification.status,
        priority_score: classification.priorityScore,
        estimated_value_cents: classification.estimatedValueCents,
        recommended_action: classification.recommendedAction,
        pipeline_metadata: classification.opportunityMetadata,
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  const { data, error } = await admin.from("lead_opportunities").insert({
    organization_id: organizationId,
    contact_id: contactId,
    segment: classification.segment,
    status: classification.status,
    priority_score: classification.priorityScore,
    estimated_value_cents: classification.estimatedValueCents,
    recommended_action: classification.recommendedAction,
    pipeline_metadata: classification.opportunityMetadata,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function upsertDraft(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string,
  contactId: string,
  opportunityId: string,
  draftText: string,
) {
  const { data: existing } = await admin
    .from("message_drafts")
    .select("id")
    .eq("opportunity_id", opportunityId)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    await admin.from("message_drafts").update({ draft_text: draftText, approval_status: "draft" }).eq("id", existing.id);
    return;
  }
  await admin.from("message_drafts").insert({
    organization_id: organizationId,
    contact_id: contactId,
    opportunity_id: opportunityId,
    draft_text: draftText,
  });
}
