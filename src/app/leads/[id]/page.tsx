import { notFound, redirect } from "next/navigation";
import { updateOpportunity } from "@/app/actions";
import { Badge, Card, Shell } from "@/components/ui";
import { createClient } from "@/lib/supabase-server";
import { getActiveOrganizationId, requireUser } from "@/lib/data";
import { segmentLabels, statusLabels } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const { id } = await params;
  const supabase = await createClient();
  const { data: opportunity, error } = await supabase
    .from("lead_opportunities")
    .select("*, contact:contacts(*), drafts:message_drafts(*)")
    .eq("organization_id", organizationId)
    .eq("id", id)
    .single();
  if (error || !opportunity) notFound();
  const draft = opportunity.drafts?.[0];

  return (
    <Shell title={opportunity.contact?.name ?? "Lead detail"}>
      <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue">{segmentLabels[opportunity.segment]}</Badge>
            <Badge>{statusLabels[opportunity.status]}</Badge>
            <Badge>Score {opportunity.priority_score}</Badge>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {[
              ["Source", opportunity.contact?.source],
              ["Lead type", opportunity.contact?.lead_type],
              ["Area", opportunity.contact?.area],
              ["Price range", opportunity.contact?.price_range],
              ["Timeline", opportunity.contact?.timeline],
              ["Last contact", opportunity.contact?.last_contact_at],
              ["Consent", opportunity.contact?.consent],
              ["Owner", opportunity.contact?.owner_name],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-sm text-zinc-500">{label}</div>
                <div className="mt-1 font-medium text-zinc-950">{value || "Not provided"}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-medium text-zinc-500">Conversation summary</div>
            <p className="mt-2 text-sm leading-6 text-zinc-700">{opportunity.contact?.normalized_summary}</p>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Human-approved follow-up</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            This system drafts copy. It does not send messages. The client edits and approves before exporting.
          </p>
          <form action={updateOpportunity} className="mt-5 space-y-4">
            <input type="hidden" name="opportunity_id" value={opportunity.id} />
            <input type="hidden" name="draft_id" value={draft?.id ?? ""} />
            <label className="block text-sm font-medium text-zinc-700" htmlFor="edited_text">
              Draft
            </label>
            <textarea
              id="edited_text"
              name="edited_text"
              rows={8}
              defaultValue={draft?.edited_text || draft?.draft_text || "No draft generated because this record needs consent review."}
              className="w-full rounded-md border border-zinc-300 p-3 text-sm leading-6 outline-none focus:border-zinc-900"
            />
            <label className="block text-sm font-medium text-zinc-700" htmlFor="status">
              Status
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
            <button className="h-11 w-full rounded-md bg-zinc-950 text-sm font-medium text-white hover:bg-zinc-800">
              Save review state
            </button>
          </form>
        </Card>
      </div>
    </Shell>
  );
}
