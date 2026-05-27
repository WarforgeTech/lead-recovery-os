import type { SupabaseClient } from "@supabase/supabase-js";
import { draftFor, recommendedAction, scoreContact, segmentContact, statusFor, type ImportContact } from "@/lib/lead-processing";

export const reviewerEmail = "vercel-reviewer@pipeline-recovery.test";
const reviewerOrganizationName = "Vercel Reviewer Demo Team";

const reviewerContacts: ImportContact[] = [
  {
    name: "Maria Gutierrez",
    email: "maria.gutierrez@example.test",
    phone: "7135550101",
    source: "Open house",
    leadType: "buyer",
    area: "Cypress",
    priceRange: "$390K-$460K",
    timeline: "Before school year",
    lastContactAt: "2026-02-10",
    consent: "ok",
    ownerName: "Avery",
    rawNotes: "Asked about schools and lender intro then went quiet.",
    normalizedSummary: "Open-house buyer lead in Cypress with school-year timing and lender questions.",
  },
  {
    name: "Daniel Brooks",
    email: "daniel.brooks@example.test",
    phone: "2815550102",
    source: "Website valuation",
    leadType: "seller",
    area: "Katy",
    priceRange: "$515K",
    timeline: "After repairs",
    lastContactAt: "2026-01-08",
    consent: "ok",
    ownerName: "Avery",
    rawNotes: "Requested home value estimate and asked about roof timing.",
    normalizedSummary: "Seller lead requested valuation and may be waiting for repair timing.",
  },
  {
    name: "Priya Shah",
    email: "priya.shah@example.test",
    phone: "8325550103",
    source: "Zillow inquiry",
    leadType: "buyer",
    area: "Energy Corridor",
    priceRange: "$310K-$360K",
    timeline: "Six to nine months",
    lastContactAt: "2025-10-12",
    consent: "review",
    ownerName: "Avery",
    rawNotes: "Asked about townhomes and HOA comparison; consent source needs review before outreach.",
    normalizedSummary: "Older buyer inquiry with useful notes, but source/consent should be reviewed before drafting.",
  },
  {
    name: "Lisa Nguyen",
    email: "lisa.nguyen@example.test",
    phone: "3465550104",
    source: "Closed client",
    leadType: "past client",
    area: "Spring Branch",
    priceRange: "$8.3K referral scenario",
    timeline: "Past client",
    lastContactAt: "2025-03-15",
    consent: "ok",
    ownerName: "Avery",
    rawNotes: "No review or annual check-in logged.",
    normalizedSummary: "Past client with no recent check-in, review request, or referral ask logged.",
  },
  {
    name: "Marcus Lee",
    email: "marcus.lee@example.test",
    phone: "8325550144",
    source: "Loan pre-approval partner",
    leadType: "referral partner",
    area: "Houston",
    priceRange: "$425K buyer lane",
    timeline: "Active partner",
    lastContactAt: "2026-03-02",
    consent: "ok",
    ownerName: "Avery",
    rawNotes: "Loan officer had two stalled buyer files and asked for a clean follow-up loop.",
    normalizedSummary: "Referral partner opportunity for relationship-first follow-up without compensation language.",
  },
  {
    name: "Angela Ramirez",
    email: "angela.ramirez@example.test",
    phone: "7135550199",
    source: "Expired listing conversation",
    leadType: "seller",
    area: "Pearland",
    priceRange: "$575K-$625K",
    timeline: "Spring relist",
    lastContactAt: "2025-12-18",
    consent: "ok",
    ownerName: "Avery",
    rawNotes: "Mentioned relisting if inventory improved and wanted a pricing reality check.",
    normalizedSummary: "Seller reactivation candidate with clear pricing and timing context.",
  },
];

export async function ensureReviewerDemoWorkspace(admin: SupabaseClient) {
  const { data: existingOrg, error: existingError } = await admin
    .from("organizations")
    .select("id")
    .eq("name", reviewerOrganizationName)
    .maybeSingle();
  if (existingError) throw existingError;

  const organizationId = existingOrg?.id ?? (await createReviewerOrganization(admin));
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
      market: "Houston reviewer sandbox",
      status: "pilot",
      notes: "Synthetic reviewer workspace for hiring-manager and partner evaluation. No real client data.",
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
  const { count, error: countError } = await admin
    .from("contacts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  const { data: importRow, error: importError } = await admin
    .from("imports")
    .insert({
      organization_id: organizationId,
      source_filename: "vercel-reviewer-synthetic-crm.csv",
      raw_file_path: "reviewer-demo/synthetic-crm.csv",
      raw_storage_provider: "none",
      raw_file_url: null,
      archived_at: null,
      status: "processed",
      mapping: { reviewerDemo: true },
      total_rows: reviewerContacts.length,
      processed_rows: reviewerContacts.length,
      duplicate_rows: 0,
      missing_contact_rows: 0,
      held_for_review_rows: 1,
      priority_opportunities: reviewerContacts.filter((contact) => contact.consent === "ok").length,
      processed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (importError) throw importError;

  for (const contact of reviewerContacts) {
    const segment = segmentContact(contact);
    const priorityScore = scoreContact(contact, segment);
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
      })
      .select("id")
      .single();
    if (contactError) throw contactError;

    const { data: opportunity, error: opportunityError } = await admin
      .from("lead_opportunities")
      .insert({
        organization_id: organizationId,
        contact_id: insertedContact.id,
        segment,
        status: statusFor(segment, contact.consent),
        priority_score: priorityScore,
        estimated_value_cents: 830000,
        recommended_action: recommendedAction(segment, contact.consent),
      })
      .select("id")
      .single();
    if (opportunityError) throw opportunityError;

    const draft = draftFor(contact, segment);
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
    event: "reviewer_workspace_seeded",
    metadata: { contacts: reviewerContacts.length },
  });
}
