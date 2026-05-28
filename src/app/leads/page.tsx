import Link from "next/link";
import { Badge, Card, Shell } from "@/components/ui";
import { getActiveWorkspaceView, metadataText } from "@/lib/workspace-view";
import { stageLabel } from "@/lib/mortgage-workflow";
import { statusLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = String(params.q ?? "").trim().toLowerCase();
  const { opportunities } = await getActiveWorkspaceView();
  const filtered = query
    ? opportunities.filter((item) =>
        [
          item.contact?.name,
          item.contact?.source,
          item.contact?.owner_name,
          metadataText(item, "stage_label"),
          metadataText(item, "why_now"),
          item.recommended_action,
        ].some((value) => String(value ?? "").toLowerCase().includes(query)),
      )
    : opportunities;

  return (
    <Shell title="Contacts">
      <Card>
        <form className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search by name, source, owner, stage, or note..."
            className="h-11 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
          />
          <button className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">Search</button>
          {query ? (
            <Link href="/leads" className="inline-flex h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium text-zinc-900 hover:bg-zinc-50">
              Clear
            </Link>
          ) : null}
        </form>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
              <tr>
                <th className="py-3">Contact</th>
                <th>Stage</th>
                <th>Status</th>
                <th>Owner</th>
                <th>Next due</th>
                <th>Why it matters</th>
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
                  <td>{stageLabel(metadataText(item, "pipeline_stage"))}</td>
                  <td><Badge>{statusLabels[item.status]}</Badge></td>
                  <td>{metadataText(item, "assigned_owner") || item.contact?.owner_name || "Unassigned"}</td>
                  <td>{metadataText(item, "next_due_at") || item.next_follow_up_at || "Today"}</td>
                  <td className="max-w-sm text-zinc-600">{metadataText(item, "why_now") || item.recommended_action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="py-8 text-sm text-zinc-500">No contacts match this view.</p> : null}
      </Card>
    </Shell>
  );
}
