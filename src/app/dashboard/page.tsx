import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Badge, Card, Shell, Stat } from "@/components/ui";
import { getActiveOrganizationId, getClientOpportunities, getMemberships, requireUser } from "@/lib/data";
import { statusLabels, type LeadSegment } from "@/lib/types";
import { formatCurrency, getPipelineTemplate } from "@/lib/pipeline-templates";
import type { WorkspaceOpportunity } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");

  const memberships = await getMemberships();
  const organization = memberships[0]?.organization as {
    name?: string;
    market?: string;
    pipeline_template?: string;
    organization_settings?: Record<string, number>;
  } | undefined;
  const template = getPipelineTemplate(organization?.pipeline_template);
  const opportunities = await getClientOpportunities(organizationId);
  const reachable = opportunities.filter((item) => item.segment !== "needs_consent").length;
  const priority = opportunities.filter((item) => item.priority_score >= 70 && item.segment !== "needs_consent").length;
  const approved = opportunities.filter((item) => item.status === "approved").length;
  const mortgage = template.id === "mortgage_growth" ? mortgageDashboard(opportunities, organization?.organization_settings ?? {}) : null;
  const bySegment = opportunities.reduce<Record<string, number>>((acc, item) => {
    acc[item.segment] = (acc[item.segment] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Shell
      title={organization?.name ?? "Workspace"}
      actions={
        <form action={signOut}>
          <button className="text-sm text-zinc-600 hover:text-zinc-950">Sign out</button>
        </form>
      }
    >
      {mortgage ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Monthly volume goal" value={formatCurrency(mortgage.monthlyGoal)} note={`${mortgage.applicationsPerDay} applications/day target`} />
          <Stat label="Active pipeline volume" value={formatCurrency(mortgage.activePipeline)} note={`${mortgage.applicationCount} application-path records`} />
          <Stat label="Gap to monthly goal" value={formatCurrency(mortgage.gapToGoal)} note={`${mortgage.borrowersAtRisk} borrowers in 14/21-day risk`} />
          <Stat label="Follow-ups due today" value={String(mortgage.followUpsDue)} note={`${mortgage.completedToday} completed or approved`} />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Imported contacts" value={String(opportunities.length)} note="Visible inside this workspace" />
          <Stat label="Reachable leads" value={String(reachable)} note="Consent present and not suppressed" />
          <Stat label="Priority queue" value={String(priority)} note="Score 70+ for first review" />
          <Stat label="Approved drafts" value={String(approved)} note="Ready for manual export" />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">{mortgage ? "Pipeline stage groups" : "Segments"}</h2>
          <div className="mt-5 grid gap-3">
            {(Object.keys(template.segmentLabels) as LeadSegment[]).map((segment) => (
              <div key={segment} className="flex items-center justify-between rounded-md border border-zinc-200 p-4">
                <div>
                  <div className="font-medium">{template.segmentLabels[segment]}</div>
                  <div className="text-sm text-zinc-500">
                    {mortgage ? "Mortgage template labels mapped from imported status and notes" : "Recommended action set generated from import data"}
                  </div>
                </div>
                <div className="text-2xl font-semibold">{bySegment[segment] ?? 0}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">{mortgage ? "Next-best actions" : "Top opportunities"}</h2>
          <div className="mt-5 space-y-3">
            {opportunities.slice(0, 6).map((item) => (
              <a key={item.id} href={`/leads/${item.id}`} className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.contact?.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{metadataText(item.pipeline_metadata, "why_now") || item.recommended_action}</div>
                  </div>
                  <Badge tone={item.status === "approved" ? "green" : "neutral"}>{statusLabels[item.status]}</Badge>
                </div>
              </a>
            ))}
            {opportunities.length === 0 ? <p className="text-sm text-zinc-500">No import has been processed yet.</p> : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function mortgageDashboard(opportunities: WorkspaceOpportunity[], settings: Record<string, number>) {
  const monthlyGoal = Number(settings.monthly_volume_goal_cents ?? 300000000);
  const applicationsPerDay = Number(settings.applications_per_day_target ?? 2);
  const activePipeline = opportunities
    .filter((item) => item.segment !== "needs_consent" && item.status !== "closed_lost")
    .reduce((sum, item) => sum + Number(item.estimated_value_cents ?? 0), 0);
  const applicationCount = opportunities.filter((item) =>
    ["talked_no_application", "application_started", "application_completed"].includes(metadataText(item.pipeline_metadata, "pipeline_stage")),
  ).length;
  const borrowersAtRisk = opportunities.filter((item) => Number(item.pipeline_metadata?.days_since_last_meaningful_contact ?? 0) >= 14).length;
  const followUpsDue = opportunities.filter((item) => !["do_not_contact", "closed_lost", "closed_won"].includes(item.status)).length;
  const completedToday = opportunities.filter((item) => ["approved", "contacted", "replied", "appointment_set"].includes(item.status)).length;
  return {
    monthlyGoal,
    applicationsPerDay,
    activePipeline,
    applicationCount,
    borrowersAtRisk,
    followUpsDue,
    completedToday,
    gapToGoal: Math.max(0, monthlyGoal - activePipeline),
  };
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}
