import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Shell } from "@/components/ui";
import { getActiveOrganizationId, getClientOpportunities, requireUser } from "@/lib/data";
import { segmentLabels, statusLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const params = await searchParams;
  const opportunities = await getClientOpportunities(organizationId);
  const filtered = params.segment ? opportunities.filter((item) => item.segment === params.segment) : opportunities;

  return (
    <Shell title="Leads">
      <Card>
        <div className="mb-5 flex flex-wrap gap-2">
          <Link href="/leads" className="rounded-md border border-zinc-300 px-3 py-2 text-sm">All</Link>
          {Object.entries(segmentLabels).map(([key, label]) => (
            <Link key={key} href={`/leads?segment=${key}`} className="rounded-md border border-zinc-300 px-3 py-2 text-sm">
              {label}
            </Link>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="py-3">Lead</th>
                <th>Segment</th>
                <th>Status</th>
                <th>Score</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td className="py-4">
                    <Link href={`/leads/${item.id}`} className="font-medium text-zinc-950 hover:underline">
                      {item.contact?.name}
                    </Link>
                    <div className="text-zinc-500">{item.contact?.source ?? "Imported contact"}</div>
                  </td>
                  <td>{segmentLabels[item.segment]}</td>
                  <td><Badge>{statusLabels[item.status]}</Badge></td>
                  <td>{item.priority_score}</td>
                  <td className="max-w-sm text-zinc-600">{item.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="py-8 text-sm text-zinc-500">No leads match this view.</p> : null}
      </Card>
    </Shell>
  );
}
