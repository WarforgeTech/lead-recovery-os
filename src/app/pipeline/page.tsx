import { PipelineList } from "@/components/pipeline-list";
import { Shell, Stat } from "@/components/ui";
import { activeQueueItems, getActiveWorkspaceView, metadataText } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const { template, opportunities } = await getActiveWorkspaceView();
  const items = template.id === "mortgage_growth"
    ? opportunities.filter((item) => metadataText(item, "queue") === "application_follow_up")
    : activeQueueItems(opportunities).slice(0, 50);
  const notStarted = opportunities.filter((item) => metadataText(item, "pipeline_stage") === "application_sent_not_started").length;
  const started = opportunities.filter((item) => metadataText(item, "pipeline_stage") === "application_started_not_submitted").length;
  const completed = opportunities.filter((item) => metadataText(item, "pipeline_stage") === "application_submitted").length;

  return (
    <Shell title={template.id === "mortgage_growth" ? "Application conversion" : "Pipeline"}>
      {template.id === "mortgage_growth" ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Stat label="Application sent, not started" value={String(notStarted)} note="Primary pre-application leak" />
          <Stat label="Application started, not submitted" value={String(started)} note="Needs completion push" />
          <Stat label="Applications submitted" value={String(completed)} note="Moved through first conversion step" />
        </div>
      ) : null}
      <PipelineList
        title={template.id === "mortgage_growth" ? "Application Conversion Queue" : "Pipeline queue"}
        description={
          template.id === "mortgage_growth"
            ? "Borrowers who talked to the loan officer but have not completed the application step."
            : "Prioritized opportunities for human-approved follow-up."
        }
        items={items}
        empty="No application conversion records are available yet."
      />
    </Shell>
  );
}
