import { redirect } from "next/navigation";
import { getActiveOrganizationId, getClientOpportunities, getMemberships, requireUser } from "./data";
import { getPipelineTemplate } from "./pipeline-templates";

export type WorkspaceOpportunity = {
  id: string;
  status: string;
  segment: string;
  priority_score: number;
  estimated_value_cents: number;
  recommended_action: string | null;
  next_follow_up_at?: string | null;
  pipeline_metadata: Record<string, unknown> | null;
  contact?: {
    name?: string | null;
    source?: string | null;
    owner_name?: string | null;
    last_contact_at?: string | null;
    normalized_summary?: string | null;
  } | null;
  drafts?: Array<{ draft_text?: string | null; edited_text?: string | null }> | null;
};

export async function getActiveWorkspaceView() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const memberships = await getMemberships();
  const organization = memberships[0]?.organization as {
    id?: string;
    name?: string;
    market?: string;
    pipeline_template?: string;
    organization_settings?: Record<string, number>;
  } | undefined;
  const template = getPipelineTemplate(organization?.pipeline_template);
  const opportunities = (await getClientOpportunities(organizationId)) as WorkspaceOpportunity[];
  return { organizationId, organization, template, opportunities };
}

export function metadataText(item: WorkspaceOpportunity, key: string) {
  const value = item.pipeline_metadata?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export function metadataNumber(item: WorkspaceOpportunity, key: string) {
  const value = item.pipeline_metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function activeQueueItems(opportunities: WorkspaceOpportunity[]) {
  const activeStatuses = new Set(["new", "needs_review", "ready_to_contact", "approved", "replied"]);
  return opportunities
    .filter((item) => activeStatuses.has(item.status))
    .sort((a, b) => b.priority_score - a.priority_score);
}
