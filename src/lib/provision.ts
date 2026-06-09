import { createAdminClient } from "./supabase-server";
import { defaultOrganizationSettings } from "./pipeline-templates";
import { seedDemoMortgageContacts } from "./reviewer-demo";

// Frictionless demo provisioning: the first time an email signs in, give it its
// own isolated, seeded mortgage workspace so the dashboard is populated and
// immediately demonstrates the product. Returning emails resolve to the same
// workspace and see only their own data (RLS + org-scoped reads).
export async function provisionSeededWorkspaceForEmail({ userId, email }: { userId: string; email: string }) {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  const { data: existing } = await admin
    .from("organization_members")
    .select("organization_id, user_id")
    .or(`user_id.eq.${userId},email.eq.${normalizedEmail}`)
    .limit(1)
    .maybeSingle();

  if (existing?.organization_id) {
    // Claim a pre-existing invite row (email matched but not yet linked to a user).
    if (!existing.user_id) {
      await admin
        .from("organization_members")
        .update({ user_id: userId })
        .eq("organization_id", existing.organization_id)
        .eq("email", normalizedEmail);
    }
    return existing.organization_id as string;
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: `${workspaceLabelFromEmail(normalizedEmail)} Mortgage Team`,
      client_type: "broker",
      pipeline_template: "mortgage_growth",
      organization_settings: defaultOrganizationSettings("mortgage_growth"),
      market: "Demo workspace",
      status: "pilot",
      notes: "Self-serve demo workspace (auto-provisioned).",
    })
    .select("id")
    .single();
  if (orgError) throw orgError;

  const { error: memberError } = await admin.from("organization_members").insert({
    organization_id: org.id,
    email: normalizedEmail,
    user_id: userId,
    role: "owner",
  });
  if (memberError) throw memberError;

  await seedDemoMortgageContacts(admin, org.id);
  return org.id as string;
}

function workspaceLabelFromEmail(email: string) {
  const local = email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "Demo";
  return local
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .slice(0, 40);
}
