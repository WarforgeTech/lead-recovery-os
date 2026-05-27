import { PipelineList } from "@/components/pipeline-list";
import { Card, Shell, Stat } from "@/components/ui";
import { activeQueueItems, getActiveWorkspaceView, metadataText } from "@/lib/workspace-view";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const { template, opportunities } = await getActiveWorkspaceView();
  const items = template.id === "mortgage_growth"
    ? opportunities.filter((item) => metadataText(item, "queue") === "referral_partner")
    : opportunities.filter((item) => item.segment === "referral_ask" || item.segment === "past_client");
  const partners = items.filter((item) => metadataText(item, "pipeline_stage") === "referral_partner").length;
  const pastClients = items.filter((item) => item.segment === "past_client").length;

  return (
    <Shell title={template.id === "mortgage_growth" ? "Referral partner queue" : "Relationship queue"}>
      {template.id === "mortgage_growth" ? (
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Stat label="Referral partners" value={String(partners)} note="Agents, attorneys, and trusted introducers" />
          <Stat label="Past clients" value={String(pastClients)} note="Review, check-in, and trusted referral opportunities" />
          <Stat label="Ready touches" value={String(items.length)} note="No referral-compensation language" />
        </div>
      ) : (
        <Card className="mb-6">
          <p className="text-sm leading-6 text-zinc-600">Past-client and referral relationship records for human-approved follow-up.</p>
        </Card>
      )}
      <PipelineList
        title={template.id === "mortgage_growth" ? "Relationship nurture" : "Referral and past-client follow-up"}
        description={
          template.id === "mortgage_growth"
            ? "Referral-driven mortgage growth needs consistent partner touches without paid-referral or compensation language."
            : "Contacts who can restart conversations through trust, referrals, and past-client check-ins."
        }
        items={activeQueueItems(items)}
        empty="No referral partner records are available yet."
      />
    </Shell>
  );
}
