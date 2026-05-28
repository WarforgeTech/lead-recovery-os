import { PipelineList } from "@/components/pipeline-list";
import { Card, Shell, Stat } from "@/components/ui";
import { activeQueueItems, getActiveWorkspaceView, metadataNumber, metadataText } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

const buckets = ["0-7 days", "8-14 days", "15-21 days", "22+ days", "No contact date"];

export default async function RescuePage() {
  const { template, opportunities } = await getActiveWorkspaceView();
  const items = template.id === "mortgage_growth"
    ? opportunities.filter((item) => metadataText(item, "queue") === "dead_deal" || (metadataNumber(item, "days_since_last_meaningful_contact") ?? 0) >= 8)
    : activeQueueItems(opportunities).filter((item) => item.priority_score >= 70);
  const counts = Object.fromEntries(buckets.map((bucket) => [bucket, items.filter((item) => metadataText(item, "rescue_bucket") === bucket).length]));

  return (
    <Shell title={template.id === "mortgage_growth" ? "14/21-day rescue" : "Rescue queue"}>
      {template.id === "mortgage_growth" ? (
        <div className="mb-6 grid gap-4 md:grid-cols-5">
          {buckets.map((bucket) => (
            <Stat key={bucket} label={bucket} value={String(counts[bucket] ?? 0)} />
          ))}
        </div>
      ) : (
        <Card className="mb-6">
          <p className="text-sm leading-6 text-zinc-600">High-priority records that should not sit untouched.</p>
        </Card>
      )}
      <PipelineList
        title={template.id === "mortgage_growth" ? "Borrower falloff risk" : "High-priority rescue"}
        description={
          template.id === "mortgage_growth"
            ? "Borrowers close to or beyond the 14/21-day window where incomplete applications and next steps usually disappear."
            : "The highest-score opportunities from the current pipeline."
        }
        items={items}
        empty="No rescue records are available yet."
      />
    </Shell>
  );
}
