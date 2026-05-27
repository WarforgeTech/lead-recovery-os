import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { metadataText, type WorkspaceOpportunity } from "@/lib/workspace-view";
import { statusLabels } from "@/lib/types";

export function PipelineList({
  title,
  description,
  items,
  empty,
}: Readonly<{
  title: string;
  description: string;
  items: WorkspaceOpportunity[];
  empty: string;
}>) {
  return (
    <Card>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <Link key={item.id} href={`/leads/${item.id}`} className="block rounded-md border border-zinc-200 p-4 hover:bg-zinc-50">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-zinc-950">{item.contact?.name ?? "Imported contact"}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-600">
                  {metadataText(item, "why_now") || item.recommended_action}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500">
                  <span>{metadataText(item, "stage_label") || "Pipeline follow-up"}</span>
                  {metadataText(item, "next_step") ? <span>Next: {metadataText(item, "next_step")}</span> : null}
                  {item.contact?.owner_name ? <span>Owner: {item.contact.owner_name}</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>{statusLabels[item.status] ?? item.status}</Badge>
                <Badge tone={item.priority_score >= 70 ? "green" : "neutral"}>Score {item.priority_score}</Badge>
              </div>
            </div>
          </Link>
        ))}
        {items.length === 0 ? <p className="text-sm text-zinc-500">{empty}</p> : null}
      </div>
    </Card>
  );
}
