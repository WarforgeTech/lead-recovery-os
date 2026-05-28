import { notFound, redirect } from "next/navigation";
import { refineDraftWithAi, updateOpportunity } from "@/app/actions";
import { CopyDraftButton } from "@/components/copy-draft-button";
import { OutcomePanel } from "@/components/lead-work-card";
import { Badge, Card, Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase-server";
import { getActiveOrganizationId, getMemberships, requireUser } from "@/lib/data";
import { statusLabels, type LeadSegment } from "@/lib/types";
import { aiDraftsEnabled } from "@/lib/ai-drafts";
import { getPipelineTemplate } from "@/lib/pipeline-templates";
import { cadenceLabel, stageLabel } from "@/lib/mortgage-workflow";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const memberships = await getMemberships();
  const organization = memberships[0]?.organization as { pipeline_template?: string } | undefined;
  const template = getPipelineTemplate(organization?.pipeline_template);
  const { id } = await params;
  const supabase = await createClient();
  const { data: opportunity, error } = await supabase
    .from("lead_opportunities")
    .select("*, contact:contacts(*)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single();
  if (error || !opportunity) notFound();
  const { data: draft, error: draftError } = await supabase
    .from("message_drafts")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("opportunity_id", opportunity.id)
    .maybeSingle();
  if (draftError) throw draftError;
  const { data: activity, error: activityError } = await supabase
    .from("activity_log")
    .select("event, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("metadata->>opportunity_id", opportunity.id)
    .order("created_at", { ascending: false })
    .limit(8);
  if (activityError) throw activityError;

  const metadata = opportunity.pipeline_metadata ?? {};
  const draftText = draft?.edited_text || draft?.draft_text || "";
  const aiEnabled = aiDraftsEnabled();

  return (
    <Shell title={opportunity.contact?.name ?? "Contact"}>
      <div className="grid gap-6 xl:grid-cols-[1fr_430px]">
        <div className="space-y-6">
          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="blue">{template.segmentLabels[opportunity.segment as LeadSegment] ?? opportunity.segment}</Badge>
              <Badge>{statusLabels[opportunity.status]}</Badge>
              <Badge>{stageLabel(metadataText(metadata, "pipeline_stage"))}</Badge>
              {metadata.needs_escalation === true ? <Badge tone="yellow">Escalated to Adam</Badge> : null}
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Info label="Source" value={opportunity.contact?.source} />
              <Info label="Current stage" value={stageLabel(metadataText(metadata, "pipeline_stage"))} />
              <Info label="Last meaningful contact" value={formatDate(metadataText(metadata, "last_meaningful_contact") || opportunity.contact?.last_contact_at)} />
              <Info label="Cadence" value={cadenceLabel(metadata)} />
              <Info label="Owner" value={metadataText(metadata, "assigned_owner") || opportunity.contact?.owner_name} />
              <Info label="Next step" value={metadataText(metadata, "next_step")} />
            </div>
            <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-500">Why this is here today</div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{metadataText(metadata, "why_now") || opportunity.recommended_action}</p>
            </div>
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-500">Last message summary</div>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{opportunity.contact?.normalized_summary || "No summary available yet."}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-xl font-semibold tracking-tight">Activity timeline</h2>
            <div className="mt-5 space-y-3">
              {(activity ?? []).map((item) => (
                <div key={`${item.event}-${item.created_at}`} className="rounded-md border border-zinc-200 p-3 text-sm">
                  <div className="font-medium text-zinc-950">{eventLabel(item.event)}</div>
                  <div className="mt-1 text-zinc-500">{formatDateTime(item.created_at)}</div>
                  {activityNote(item.metadata) ? <div className="mt-2 text-zinc-700">{activityNote(item.metadata)}</div> : null}
                </div>
              ))}
              {activity?.length === 0 ? <p className="text-sm text-zinc-500">No activity logged yet.</p> : null}
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Follow-up work card</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Review, copy, contact through the normal channel, then click the outcome. Nothing sends from this app.
          </p>
          <form action={updateOpportunity} className="mt-5 space-y-4">
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <input type="hidden" name="draft_id" value={draft?.id ?? ""} />
            <label className="block text-sm font-medium text-zinc-700" htmlFor="edited_text">
              Suggested message
            </label>
            <textarea
              id="edited_text"
              name="edited_text"
              rows={7}
              defaultValue={draftText || "No draft generated because this record needs consent review."}
              className="w-full rounded-md border border-zinc-300 p-3 text-sm leading-6 outline-none focus:border-zinc-900"
            />
            <label className="block text-sm font-medium text-zinc-700" htmlFor="status">
              Manual status override
            </label>
            <select
              id="status"
              name="status"
              defaultValue={opportunity.status}
              className="h-11 w-full rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
            >
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <CopyDraftButton targetId="edited_text" />
              {aiEnabled ? (
                <button
                  formAction={refineDraftWithAi}
                  className="h-11 rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                >
                  Refine draft
                </button>
              ) : null}
              <button className="h-11 rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800 sm:col-span-2">
                Save text/status only
              </button>
            </div>
          </form>
          <div className="mt-5 border-t border-zinc-200 pt-5">
            <OutcomePanel opportunityId={opportunity.id} draft={draftText} />
          </div>
        </Card>
      </div>
    </Shell>
  );
}

function Info({ label, value }: Readonly<{ label: string; value?: string | null }>) {
  return (
    <div>
      <div className="text-sm text-zinc-500">{label}</div>
      <div className="mt-1 font-medium text-zinc-950">{value || "Not provided"}</div>
    </div>
  );
}

function metadataText(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function eventLabel(event: string) {
  return event.replaceAll("_", " ");
}

function activityNote(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  return String(record.note ?? record.label ?? record.outcome ?? "").trim();
}
