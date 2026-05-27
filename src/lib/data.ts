import { redirect } from "next/navigation";
import { isAdminEmail } from "./env";
import { createAdminClient, createClient, getUser } from "./supabase-server";

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdminEmail(user.email)) redirect("/dashboard");
  return user;
}

export async function getMemberships() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name, client_type, status, market, pipeline_template, organization_settings)")
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getActiveOrganizationId() {
  const memberships = await getMemberships();
  const first = memberships[0]?.organization as { id?: string } | null;
  return first?.id ?? null;
}

export async function getAdminOrganizations() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("*, organization_members(email, role), imports(id, total_rows, processed_rows, priority_opportunities, created_at)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getOrganizationSummary(organizationId: string) {
  const admin = createAdminClient();
  const [org, contacts, opportunities, drafts, imports] = await Promise.all([
    admin.from("organizations").select("*, organization_members(email, role)").eq("id", organizationId).single(),
    admin.from("contacts").select("id, consent", { count: "exact", head: false }).eq("organization_id", organizationId),
    admin.from("lead_opportunities").select("id, segment, status, priority_score", { count: "exact", head: false }).eq("organization_id", organizationId),
    admin.from("message_drafts").select("id, approval_status", { count: "exact", head: false }).eq("organization_id", organizationId),
    admin.from("imports").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
  ]);

  if (org.error) throw org.error;
  if (contacts.error) throw contacts.error;
  if (opportunities.error) throw opportunities.error;
  if (drafts.error) throw drafts.error;
  if (imports.error) throw imports.error;

  return {
    organization: org.data,
    contacts: contacts.data ?? [],
    opportunities: opportunities.data ?? [],
    drafts: drafts.data ?? [],
    imports: imports.data ?? [],
  };
}

export async function getClientOpportunities(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_opportunities")
    .select("*, contact:contacts(*), drafts:message_drafts(*)")
    .eq("organization_id", organizationId)
    .order("priority_score", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
