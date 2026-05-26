import { redirect } from "next/navigation";
import { Badge, Card, Shell } from "@/components/ui";
import { getActiveOrganizationId, getClientOpportunities, requireUser } from "@/lib/data";
import { statusLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const opportunities = await getClientOpportunities(organizationId);
  const queue = opportunities.filter((item) => !["do_not_contact", "closed_lost"].includes(item.status)).slice(0, 50);

  return (
    <Shell title="Follow-up queue">
      <Card>
        <p className="text-sm leading-6 text-zinc-600">
          Prioritized records for human review. Nothing is sent from Pipeline Recovery OS in v1.
        </p>
        <div className="mt-5 space-y-3">
          {queue.map((item, index) => (
            <a key={item.id} href={`/leads/${item.id}`} className="grid gap-3 rounded-md border border-zinc-200 p-4 hover:bg-zinc-50 md:grid-cols-[52px_1fr_140px]">
              <div className="text-2xl font-semibold text-zinc-400">{index + 1}</div>
              <div>
                <div className="font-medium text-zinc-950">{item.contact?.name}</div>
                <div className="mt-1 text-sm text-zinc-600">{item.recommended_action}</div>
              </div>
              <div className="md:text-right"><Badge>{statusLabels[item.status]}</Badge></div>
            </a>
          ))}
          {queue.length === 0 ? <p className="text-sm text-zinc-500">No queue items yet.</p> : null}
        </div>
      </Card>
    </Shell>
  );
}
