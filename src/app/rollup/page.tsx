import { Card, Shell, Stat } from "@/components/ui";
import { formatCurrency } from "@/lib/pipeline-templates";
import { getActiveWorkspaceView, metadataNumber, metadataText } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

export default async function RollupPage() {
  const { template, opportunities, organization } = await getActiveWorkspaceView();
  const settings = organization?.organization_settings ?? {};
  const active = opportunities.filter((item) => !["do_not_contact", "closed_lost", "closed_won"].includes(item.status));
  const activeVolume = active.reduce((sum, item) => sum + Number(item.estimated_value_cents ?? 0), 0);
  const applicationsCreated = opportunities.filter((item) =>
    ["application_started", "application_completed", "pre_qualified", "pre_approved"].includes(metadataText(item, "pipeline_stage")),
  ).length;
  const staleRecovered = opportunities.filter((item) => item.status === "approved" || item.status === "replied" || item.status === "appointment_set").length;
  const followUpsCompleted = opportunities.filter((item) => ["approved", "contacted", "replied", "appointment_set"].includes(item.status)).length;
  const preApplicationLeak = opportunities.filter((item) =>
    ["talked_no_application", "application_started"].includes(metadataText(item, "pipeline_stage")),
  ).length;
  const atRisk = opportunities.filter((item) => (metadataNumber(item, "days_since_last_meaningful_contact") ?? 0) >= 14).length;
  const monthlyGoal = Number(settings.monthly_volume_goal_cents ?? 300000000);

  return (
    <Shell title={template.id === "mortgage_growth" ? "CEO / broker rollup" : "Pilot rollup"}>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label={template.id === "mortgage_growth" ? "Applications created" : "Approved records"} value={String(applicationsCreated || staleRecovered)} />
        <Stat label="Stale records recovered" value={String(staleRecovered)} note="Approved, replied, or appointment set" />
        <Stat label="Follow-ups completed" value={String(followUpsCompleted)} note="Human-reviewed progress" />
        <Stat label="Active pipeline value" value={formatCurrency(activeVolume)} note={template.id === "mortgage_growth" ? `${formatCurrency(Math.max(0, monthlyGoal - activeVolume))} gap to goal` : "Directional value"} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Where the pipeline leaks</h2>
          <div className="mt-5 space-y-3 text-sm">
            <RollupRow label="Before application / first step" value={String(preApplicationLeak)} />
            <RollupRow label="14+ days since meaningful contact" value={String(atRisk)} />
            <RollupRow label="Needs assistant or file help" value={String(opportunities.filter((item) => metadataText(item, "queue") === "assistant_task").length)} />
            <RollupRow label="Referral partner touches" value={String(opportunities.filter((item) => metadataText(item, "queue") === "referral_partner").length)} />
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Pilot proof target</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            This rollup is designed for the broker-owner or CEO conversation. Week-one success is measured by surfaced
            opportunities, application movement, rescued conversations, assistant task clarity, and export-ready
            human-approved follow-up.
          </p>
          <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
            No borrower PII appears in this rollup. Details stay in the workspace queues where authorized users can review
            the underlying records.
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function RollupRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
      <span className="text-zinc-600">{label}</span>
      <span className="font-semibold text-zinc-950">{value}</span>
    </div>
  );
}
