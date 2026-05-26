"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseCsv, inferMapping, applyMapping, type Mapping } from "@/lib/csv";
import {
  draftFor,
  recommendedAction,
  scoreContact,
  segmentContact,
  statusFor,
} from "@/lib/lead-processing";
import { createAdminClient, createClient } from "@/lib/supabase-server";
import { requireAdmin, requireUser } from "@/lib/data";
import type { OpportunityStatus } from "@/lib/types";

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
  const market = String(formData.get("market") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!name) throw new Error("Organization name is required");

  const { data: org, error } = await admin
    .from("organizations")
    .insert({ name, client_type: clientType, market, status: "pilot" })
    .select()
    .single();
  if (error) throw error;

  const members: Array<{ organization_id: string; email: string; user_id?: string | null; role: string }> = [
    { organization_id: org.id, email: user.email!, user_id: user.id, role: "admin" },
  ];
  if (email) members.push({ organization_id: org.id, email, user_id: null, role: "client" });

  const { error: memberError } = await admin.from("organization_members").insert(members);
  if (memberError) throw memberError;

  await admin.from("activity_log").insert({
    organization_id: org.id,
    actor_user_id: user.id,
    event: "organization_created",
    metadata: { name, email },
  });

  revalidatePath("/admin");
  redirect(`/admin/organizations/${org.id}`);
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

  const rawPath = `${organizationId}/${Date.now()}-${sourceFilename.replace(/[^a-z0-9._-]/gi, "-")}`;
  await admin.storage.from("raw-imports").upload(rawPath, new Blob([csvText], { type: "text/csv" }), {
    contentType: "text/csv",
    upsert: true,
  }).catch(() => null);

  const processedContacts = Array.from(unique.values());
  const priorityCount = processedContacts.filter((contact) => {
    const segment = segmentContact(contact);
    return segment !== "needs_consent" && scoreContact(contact, segment) >= 70;
  }).length;

  const { data: importRow, error: importError } = await admin
    .from("imports")
    .insert({
      organization_id: organizationId,
      uploaded_by: user.id,
      source_filename: sourceFilename,
      raw_file_path: rawPath,
      status: "processed",
      mapping,
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
      .select()
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
      .select()
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
    actor_user_id: user.id,
    event: "contacts_imported",
    metadata: { import_id: importRow.id, processed: processedContacts.length },
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

  revalidatePath("/leads");
  revalidatePath(`/leads/${opportunityId}`);
  revalidatePath("/queue");
  revalidatePath("/dashboard");
}

function field(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}
