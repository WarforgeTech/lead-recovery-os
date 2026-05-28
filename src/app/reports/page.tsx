import { Card, Shell, Stat } from "@/components/ui";
import { formatCurrency } from "@/lib/pipeline-templates";
import { getActiveWorkspaceView, metadataNumber, metadataText } from "@/lib/workspace-view";
import { stageLabel } from "@/lib/mortgage-workflow";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const { opportunities, organization } = await getActiveWorkspaceView();
  const settings = organization?.organization_settings ?? {};
  const worked = opportunities.filter((item) => Number(item.pipeline_metadata?.touch_count ?? 0) > 0 || ["contacted", "replied", "appointment_set", "not_now"].includes(item.status));
  const noResponse = opportunities.filter((item) => metadataText(item, "last_outcome") === "no_response").length;
  const applicationsRecovered = opportunities.filter((item) => metadataText(item, "pipeline_stage") === "application_submitted").length;
  const appointments = opportunities.filter((item) => item.status === "appointment_set").length;
  const reactivated = opportunities.filter((item) => ["replied", "appointment_set"].includes(item.status)).length;
  const deadDeals = opportunities.filter((item) => ["preapproval_declined_not_ready", "loan_process_dead"].includes(metadataText(item, "pipeline_stage"))).length;
  const adamEscalations = opportunities.filter((item) => item.pipeline_metadata?.needs_escalation === true).length;
  const activeVolume = opportunities
    .filter((item) => !["do_not_contact", "closed_lost", "closed_won"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.estimated_value_cents ?? 0), 0);
  const monthlyGoal = Number(settings.monthly_volume_goal_cents ?? 300000000);
  const leakage = opportunities.reduce<Record<string, number>>((acc, item) => {
    const stage = stageLabel(metadataText(item, "pipeline_stage"));
    acc[stage] = (acc[stage] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Shell title="Reports">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Leads worked" value={String(worked.length)} note="Contacts touched or moved" />
        <Stat label="No-response follow-ups" value={String(noResponse)} note="Cadence handled without manual CRM digging" />
        <Stat label="Applications recovered" value={String(applicationsRecovered)} note="Moved into submitted application state" />
        <Stat label="Appointments set" value={String(appointments)} note="High-signal pilot outcome" />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Stat label="Stale leads reactivated" value={String(reactivated)} note="Replies or appointments" />
        <Stat label="Dead deals resurfaced" value={String(deadDeals)} note="Declined or could-not-fund records" />
        <Stat label="Adam escalations" value={String(adamEscalations)} note="Assistant handed off" />
        <Stat label="Active pipeline value" value={formatCurrency(activeVolume)} note={`${formatCurrency(Math.max(0, monthlyGoal - activeVolume))} gap to goal`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Pipeline leakage by stage</h2>
          <div className="mt-5 space-y-3 text-sm">
            {Object.entries(leakage).map(([stage, count]) => (
              <div key={stage} className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
                <span className="text-zinc-600">{stage}</span>
                <span className="font-semibold text-zinc-950">{count}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Pilot proof</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            This page is for the broker-owner conversation. It shows whether the team is recovering conversations,
            moving people back toward applications, and reducing the forgotten-lead pile without adding CRM busywork.
          </p>
          <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
            Reports summarize operational movement. Contact-level details stay in Today and Contacts.
          </div>
          <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
            <div className="text-zinc-500">Borrowers 14+ days since meaningful contact</div>
            <div className="mt-1 text-3xl font-semibold text-zinc-950">
              {opportunities.filter((item) => (metadataNumber(item, "days_since_last_meaningful_contact") ?? 0) >= 14).length}
            </div>
          </div>
        </Card>
      </div>
    </Shell>
  );
}
