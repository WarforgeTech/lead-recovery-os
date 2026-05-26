import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Badge, Card, Shell, Stat } from "@/components/ui";
import { getActiveOrganizationId, getClientOpportunities, getMemberships, requireUser } from "@/lib/data";
import { segmentLabels, statusLabels, type LeadSegment } from "@/lib/types";

export default async function DashboardPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");

  const memberships = await getMemberships();
  const organization = memberships[0]?.organization as { name?: string; market?: string } | undefined;
  const opportunities = await getClientOpportunities(organizationId);
  const reachable = opportunities.filter((item) => item.segment !== "needs_consent").length;
  const priority = opportunities.filter((item) => item.priority_score >= 70 && item.segment !== "needs_consent").length;
  const approved = opportunities.filter((item) => item.status === "approved").length;
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
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Imported contacts" value={String(opportunities.length)} note="Visible inside this workspace" />
        <Stat label="Reachable leads" value={String(reachable)} note="Consent present and not suppressed" />
        <Stat label="Priority queue" value={String(priority)} note="Score 70+ for first review" />
        <Stat label="Approved drafts" value={String(approved)} note="Ready for manual export" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Segments</h2>
          <div className="mt-5 grid gap-3">
            {(Object.keys(segmentLabels) as LeadSegment[]).map((segment) => (
              <div key={segment} className="flex items-center justify-between rounded-md border border-zinc-200 p-4">
                <div>
                  <div className="font-medium">{segmentLabels[segment]}</div>
                  <div className="text-sm text-zinc-500">Recommended action set generated from import data</div>
                </div>
                <div className="text-2xl font-semibold">{bySegment[segment] ?? 0}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Top opportunities</h2>
          <div className="mt-5 space-y-3">
            {opportunities.slice(0, 6).map((item) => (
              <a key={item.id} href={`/leads/${item.id}`} className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{item.contact?.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{item.recommended_action}</div>
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
