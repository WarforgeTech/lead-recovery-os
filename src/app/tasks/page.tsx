import { PipelineList } from "@/components/pipeline-list";
import { Shell, Stat } from "@/components/ui";
import { activeQueueItems, getActiveWorkspaceView, metadataText } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const { template, opportunities } = await getActiveWorkspaceView();
  const items = template.id === "mortgage_growth"
    ? opportunities.filter((item) => metadataText(item, "queue") === "assistant_task")
    : activeQueueItems(opportunities).filter((item) => item.status === "needs_review");
  const docsMissing = items.filter((item) => metadataText(item, "pipeline_stage") === "docs_missing").length;
  const creditReview = items.filter((item) => metadataText(item, "pipeline_stage") === "credit_doc_review").length;
  const overdue = items.filter((item) => Number(item.pipeline_metadata?.days_since_last_meaningful_contact ?? 0) >= 14).length;

  return (
    <Shell title={template.id === "mortgage_growth" ? "Assistant task view" : "Review tasks"}>
      {template.id === "mortgage_growth" ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Stat label="Missing docs" value={String(docsMissing)} note="Bank statements, signatures, and upload help" />
          <Stat label="Credit/doc review" value={String(creditReview)} note="Needs handoff or next file action" />
          <Stat label="Overdue follow-up" value={String(overdue)} note="14+ days since meaningful contact" />
        </div>
      ) : null}
      <PipelineList
        title={template.id === "mortgage_growth" ? "Janine-style task queue" : "Needs review"}
        description={
          template.id === "mortgage_growth"
            ? "A lighter task surface for missing docs, bank statements, signature help, confused borrower hand-holding, and needs-loan-officer handoffs."
            : "Records that need source, consent, or data review before client outreach."
        }
        items={items}
        empty="No assistant task records are available yet."
      />
    </Shell>
  );
}
