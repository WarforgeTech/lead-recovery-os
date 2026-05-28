import Link from "next/link";
import { signOut } from "@/app/actions";
import { DailyDumpBox } from "@/components/daily-dump-box";
import { LeadWorkCard } from "@/components/lead-work-card";
import { Card, Shell, Stat } from "@/components/ui";
import { getActiveWorkspaceView, metadataNumber, metadataText } from "@/lib/workspace-view";
import { filterForStage, isDue, matchesWorkflowFilter, workflowFilters, type WorkflowFilter } from "@/lib/mortgage-workflow";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: WorkflowFilter }>;
}) {
  const params = await searchParams;
  const filter = workflowFilters.some((item) => item.id === params.filter) ? params.filter! : "all";
  const { organizationId, organization, template, opportunities } = await getActiveWorkspaceView();
  const isMortgage = template.id === "mortgage_growth";
  const due = opportunities
    .filter((item) => isDue(item.next_follow_up_at ?? metadataText(item, "next_due_at"), item.status))
    .sort((a, b) => b.priority_score - a.priority_score);
  const filtered = due.filter((item) => matchesWorkflowFilter(item, filter));
  const hotAtRisk = due.filter((item) => (metadataNumber(item, "days_since_last_meaningful_contact") ?? 0) >= 14).length;
  const applicationFollowUps = due.filter((item) => filterForStage(metadataText(item, "pipeline_stage")) === "application").length;
  const repliesAppointments = opportunities.filter((item) => ["replied", "appointment_set"].includes(item.status)).length;

  if (!isMortgage) {
    return (
      <Shell title={organization?.name ?? "Workspace"} actions={<SignOutButton />}>
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Imported contacts" value={String(opportunities.length)} note="Visible inside this workspace" />
          <Stat label="Due today" value={String(due.length)} note="Ready for human review" />
          <Stat label="Priority queue" value={String(due.filter((item) => item.priority_score >= 70).length)} note="Score 70+ for first review" />
          <Stat label="Approved drafts" value={String(opportunities.filter((item) => item.status === "approved").length)} note="Ready for manual export" />
        </div>
        <div className="mt-6 space-y-4">
          {due.map((item) => <LeadWorkCard key={item.id} item={item} />)}
        </div>
      </Shell>
    );
  }

  return (
    <Shell title="Today’s Follow-Up Queue" actions={<SignOutButton />}>
      <Card className="mb-6">
        <div className="text-sm text-zinc-500">Workspace</div>
        <div className="mt-1 text-lg font-semibold text-zinc-950">{organization?.name ?? "Mortgage workspace"}</div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Daily recovery layer for application follow-up, stuck pre-approval steps, dead deals, and relationship touches.
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Due today" value={String(due.length)} note="People needing action now" />
        <Stat label="Hot leads at risk" value={String(hotAtRisk)} note="14+ days since meaningful contact" />
        <Stat label="Application follow-ups" value={String(applicationFollowUps)} note="App link, started, or not submitted" />
        <Stat label="Replies / appointments" value={String(repliesAppointments)} note="Pilot proof from this workspace" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Work this list first</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  These are the people most likely to disappear unless Adam or Janine follows up today.
                </p>
              </div>
              <Link
                href="/leads"
                className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Search contacts
              </Link>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {workflowFilters.map((item) => (
                <Link
                  key={item.id}
                  href={item.id === "all" ? "/dashboard" : `/dashboard?filter=${item.id}`}
                  className={`rounded-md border px-3 py-2 text-sm ${
                    filter === item.id ? "border-zinc-950 bg-zinc-950 text-white" : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </Card>

          {filtered.map((item) => <LeadWorkCard key={item.id} item={item} />)}
          {filtered.length === 0 ? (
            <Card>
              <p className="text-sm text-zinc-500">No contacts match this daily filter right now.</p>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <h2 className="text-xl font-semibold tracking-tight">How Adam and Janine use this</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-700">
              <p><strong className="text-zinc-950">Adam:</strong> works high-intent borrowers and anything marked Needs Adam.</p>
              <p><strong className="text-zinc-950">Janine:</strong> clears application reminders, docs, no-response follow-ups, and escalates only the important ones.</p>
              <p><strong className="text-zinc-950">End of day:</strong> paste a messy recap below instead of manually hunting through every contact.</p>
            </div>
          </Card>
          <DailyDumpBox organizationId={organizationId} />
        </div>
      </div>
    </Shell>
  );
}

function SignOutButton() {
  return (
    <form action={signOut}>
      <button className="text-sm text-zinc-600 hover:text-zinc-950">Sign out</button>
    </form>
  );
}
