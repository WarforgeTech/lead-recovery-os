import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportContact } from "@/lib/lead-processing";
import { classifyPipelineOpportunity, defaultOrganizationSettings } from "@/lib/pipeline-templates";

export const reviewerEmail = "vercel-reviewer@pipeline-recovery.test";
const reviewerOrganizationName = "Vercel Reviewer Demo Team";
const reviewerImportFilename = "vercel-reviewer-mortgage-pipeline.csv";

const reviewerContacts: ImportContact[] = [
  {
    name: "Jordan Miles",
    email: "jordan.miles@example.test",
    phone: "7135550201",
    source: "Realtor referral",
    leadType: "talked no application",
    area: "Austin",
    priceRange: "$520K",
    timeline: "Active purchase",
    lastContactAt: "2026-05-14",
    consent: "ok",
    ownerName: "Adam",
    rawNotes: "Had purchase consult and asked for application link but has not submitted.",
    normalizedSummary: "Borrower had a purchase consult but has not completed the application.",
    pipelineMetadata: {
      current_status: "talked no application",
      loan_intent: "purchase",
      estimated_loan_amount: 520000,
      referral_source: "Elena Park",
      missing_next_step: "finish application",
      last_meaningful_contact: "2026-05-14",
    },
  },
  {
    name: "Taylor Reed",
    email: "taylor.reed@example.test",
    phone: "2815550202",
    source: "Website lead",
    leadType: "application started",
    area: "Houston",
    priceRange: "$410K",
    timeline: "Active purchase",
    lastContactAt: "2026-05-08",
    consent: "ok",
    ownerName: "Janine",
    rawNotes: "Application started but borrower got stuck on income section.",
    normalizedSummary: "Application is started but incomplete; borrower needs help finishing.",
    pipelineMetadata: {
      current_status: "application started",
      loan_intent: "purchase",
      estimated_loan_amount: 410000,
      referral_source: "Google Ads",
      missing_next_step: "complete application",
      last_meaningful_contact: "2026-05-08",
    },
  },
  {
    name: "Monica Patel",
    email: "monica.patel@example.test",
    phone: "8325550203",
    source: "Past client",
    leadType: "past client",
    area: "Dallas",
    priceRange: "$385K",
    timeline: "Annual review",
    lastContactAt: "2026-04-30",
    consent: "ok",
    ownerName: "Adam",
    rawNotes: "Closed in 2023 and asked whether a refi review would make sense later.",
    normalizedSummary: "Past client candidate for check-in and mortgage review.",
    pipelineMetadata: {
      current_status: "closed client",
      loan_intent: "refi check-in",
      estimated_loan_amount: 385000,
      referral_source: "Past client",
      missing_next_step: "annual mortgage review",
      last_meaningful_contact: "2026-04-30",
    },
  },
  {
    name: "Chris Howard",
    email: "chris.howard@example.test",
    phone: "3465550204",
    source: "Realtor partner",
    leadType: "referral partner",
    area: "Houston",
    priceRange: "$0",
    timeline: "Partner nurture",
    lastContactAt: "2026-05-01",
    consent: "ok",
    ownerName: "Adam",
    rawNotes: "Agent sends first-time buyers but has not heard from Adam this month.",
    normalizedSummary: "Referral partner needs a relationship-first check-in.",
    pipelineMetadata: {
      current_status: "referral partner",
      loan_intent: "partner nurture",
      estimated_loan_amount: 0,
      referral_source: "Rachel Gomez",
      missing_next_step: "partner check-in",
      last_meaningful_contact: "2026-05-01",
    },
  },
  {
    name: "Nina Alvarez",
    email: "nina.alvarez@example.test",
    phone: "7135550205",
    source: "Phone consult",
    leadType: "docs missing",
    area: "San Antonio",
    priceRange: "$610K",
    timeline: "Active purchase",
    lastContactAt: "2026-05-03",
    consent: "ok",
    ownerName: "Janine",
    rawNotes: "Borrower is confused by bank statement upload and e-signature step.",
    normalizedSummary: "Missing bank statements and signatures are blocking file movement.",
    pipelineMetadata: {
      current_status: "docs missing",
      loan_intent: "purchase",
      estimated_loan_amount: 610000,
      referral_source: "Open-house partner",
      missing_next_step: "bank statements and signatures",
      docs_missing: "bank statements; e-signature",
      last_meaningful_contact: "2026-05-03",
    },
  },
  {
    name: "Andre Coleman",
    email: "andre.coleman@example.test",
    phone: "2815550206",
    source: "Old CRM",
    leadType: "lost stale",
    area: "Houston",
    priceRange: "$455K",
    timeline: "Paused purchase",
    lastContactAt: "2026-04-18",
    consent: "ok",
    ownerName: "Adam",
    rawNotes: "Talked through FHA path then went quiet before submitting application.",
    normalizedSummary: "Older borrower conversation fell off before application.",
    pipelineMetadata: {
      current_status: "lost stale",
      loan_intent: "purchase",
      estimated_loan_amount: 455000,
      referral_source: "Facebook lead",
      missing_next_step: "restart application",
      last_meaningful_contact: "2026-04-18",
    },
  },
];

export async function ensureReviewerDemoWorkspace(admin: SupabaseClient) {
  const { data: existingOrg, error: existingError } = await admin
    .from("organizations")
    .select("id, pipeline_template")
    .eq("name", reviewerOrganizationName)
    .maybeSingle();
  if (existingError) throw existingError;

  const organizationId = existingOrg?.id ?? (await createReviewerOrganization(admin));
  await admin
    .from("organizations")
    .update({
      pipeline_template: "mortgage_growth",
      organization_settings: defaultOrganizationSettings("mortgage_growth"),
      client_type: "broker",
      market: "Texas mortgage reviewer sandbox",
    })
    .eq("id", organizationId);

  await ensureReviewerMembership(admin, organizationId);
  await ensureReviewerContacts(admin, organizationId);
  return organizationId;
}

async function createReviewerOrganization(admin: SupabaseClient) {
  const { data, error } = await admin
    .from("organizations")
    .insert({
      name: reviewerOrganizationName,
      client_type: "broker",
      pipeline_template: "mortgage_growth",
      organization_settings: defaultOrganizationSettings("mortgage_growth"),
      market: "Texas mortgage reviewer sandbox",
      status: "pilot",
      notes: "Synthetic reviewer workspace for mortgage brokerage evaluation. No real client or borrower data.",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensureReviewerMembership(admin: SupabaseClient, organizationId: string) {
  const { error } = await admin.from("organization_members").upsert(
    {
      organization_id: organizationId,
      email: reviewerEmail,
      role: "client",
    },
    { onConflict: "organization_id,email" },
  );
  if (error) throw error;
}

async function ensureReviewerContacts(admin: SupabaseClient, organizationId: string) {
  const { data: existingImport, error: importLookupError } = await admin
    .from("imports")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_filename", reviewerImportFilename)
    .maybeSingle();
  if (importLookupError) throw importLookupError;
  if (existingImport) return;

  await admin.from("contacts").delete().eq("organization_id", organizationId);
  await admin.from("imports").delete().eq("organization_id", organizationId);

  const { data: importRow, error: importError } = await admin
    .from("imports")
    .insert({
      organization_id: organizationId,
      source_filename: reviewerImportFilename,
      raw_file_path: "reviewer-demo/mortgage-pipeline.csv",
      raw_storage_provider: "none",
      raw_file_url: null,
      archived_at: null,
      status: "processed",
      mapping: { reviewerDemo: true, pipeline_template: "mortgage_growth" },
      total_rows: reviewerContacts.length,
      processed_rows: reviewerContacts.length,
      duplicate_rows: 0,
      missing_contact_rows: 0,
      held_for_review_rows: 0,
      priority_opportunities: reviewerContacts.length,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (importError) throw importError;

  for (const contact of reviewerContacts) {
    const classification = classifyPipelineOpportunity(contact, "mortgage_growth");
    const { data: insertedContact, error: contactError } = await admin
      .from("contacts")
      .insert({
        organization_id: organizationId,
        import_id: importRow.id,
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
      .select("id")
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
      .select("id")
      .single();
    if (opportunityError) throw opportunityError;

    if (classification.draftText) {
      const { error: draftError } = await admin.from("message_drafts").insert({
        organization_id: organizationId,
        contact_id: insertedContact.id,
        opportunity_id: opportunity.id,
        draft_text: classification.draftText,
      });
      if (draftError) throw draftError;
    }
  }

  await admin.from("activity_log").insert({
    organization_id: organizationId,
    event: "reviewer_mortgage_workspace_seeded",
    metadata: { contacts: reviewerContacts.length, pipeline_template: "mortgage_growth" },
  });
}
