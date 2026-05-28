import Link from "next/link";
import { updateLeadOutcome } from "@/app/actions";
import { Badge } from "@/components/ui";
import { CopyValueButton } from "@/components/copy-value-button";
import { cadenceLabel, stageLabel } from "@/lib/mortgage-workflow";
import { statusLabels } from "@/lib/types";
import { formatDate } from "@/lib/format";

type LeadWorkCardOpportunity = {
  id: string;
  status: string;
  priority_score: number;
  recommended_action: string | null;
  next_follow_up_at?: string | null;
  pipeline_metadata: Record<string, unknown> | null;
  contact?: {
    name?: string | null;
    source?: string | null;
    owner_name?: string | null;
    last_contact_at?: string | null;
    normalized_summary?: string | null;
  } | null;
  drafts?: Array<{ draft_text?: string | null; edited_text?: string | null }> | null;
};

export function LeadWorkCard({ item, compact = false }: Readonly<{ item: LeadWorkCardOpportunity; compact?: boolean }>) {
  const metadata = item.pipeline_metadata ?? {};
  const draft = item.drafts?.[0]?.edited_text || item.drafts?.[0]?.draft_text || "";
  const stage = String(metadata.pipeline_stage ?? "");
  const whyNow = String(metadata.why_now ?? item.recommended_action ?? "");
  const nextStep = String(metadata.next_step ?? "");
  const owner = String(metadata.assigned_owner ?? item.contact?.owner_name ?? "Unassigned");

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/leads/${item.id}`} className="text-lg font-semibold tracking-tight text-zinc-950 hover:underline">
              {item.contact?.name ?? "Imported contact"}
            </Link>
            <Badge tone={priorityTone(item.priority_score)}>Priority {item.priority_score}</Badge>
            <Badge>{statusLabels[item.status] ?? item.status}</Badge>
            {metadata.needs_escalation === true ? <Badge tone="yellow">Escalated to Adam</Badge> : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
            <span>{item.contact?.source ?? "Unknown source"}</span>
            <span>{stageLabel(stage)}</span>
            <span>Owner: {owner}</span>
            <span>{cadenceLabel(metadata)}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{whyNow}</p>
          {nextStep ? <p className="mt-1 text-sm font-medium text-zinc-950">Next step: {nextStep}</p> : null}
        </div>
        <div className="min-w-[180px] rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
          <div className="text-zinc-500">Last contact</div>
          <div className="mt-1 font-medium text-zinc-950">{formatDate(item.contact?.last_contact_at) || "Not provided"}</div>
          <div className="mt-3 text-zinc-500">Next due</div>
          <div className="mt-1 font-medium text-zinc-950">{formatDate(String(metadata.next_due_at ?? item.next_follow_up_at ?? "")) || "Today"}</div>
        </div>
      </div>

      {!compact ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
            {draft || "No draft generated because this record needs review before outreach."}
          </div>
          <OutcomePanel opportunityId={item.id} draft={draft} />
        </div>
      ) : null}
    </article>
  );
}

export function OutcomePanel({ opportunityId, draft }: Readonly<{ opportunityId: string; draft: string }>) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">After outreach</div>
      <div className="grid grid-cols-2 gap-2">
        <CopyValueButton value={draft} />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="mark_contacted"
          label="Outreach done"
          help="Use after Adam or Janine actually called, emailed, or texted. Schedules the next follow-up."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="no_response"
          label="No reply"
          help="Use after outreach when nobody answered. Moves this into the next cadence touch."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="replied"
          label="They replied"
          help="Use when the borrower or partner responds. Stops the no-response cadence."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="application_submitted"
          label="App submitted"
          help="Use when the borrower completed the application. Removes them from recovery follow-up."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="appointment_set"
          label="Call booked"
          help="Use when a consult, review call, or appointment is scheduled."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="needs_adam"
          label="Escalate to Adam"
          help="Use when Janine cannot resolve it and Adam needs to personally handle the conversation."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="snooze"
          label="Follow up in 3 days"
          snoozeDays={3}
          help="Use when now is not the right moment, but this should come back soon."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="not_now"
          label="Pause 14 days"
          help="Use when the person is not ready but should not be discarded."
        />
        <OutcomeButton
          opportunityId={opportunityId}
          outcome="do_not_contact"
          label="Opt out / DNC"
          help="Use for opt-outs, consent problems, or records that should not be messaged."
          danger
        />
      </div>
    </div>
  );
}

function OutcomeButton({
  opportunityId,
  outcome,
  label,
  help,
  snoozeDays,
  danger = false,
}: Readonly<{ opportunityId: string; outcome: string; label: string; help: string; snoozeDays?: number; danger?: boolean }>) {
  return (
    <form action={updateLeadOutcome}>
      <input type="hidden" name="opportunity_id" value={opportunityId} />
      <input type="hidden" name="outcome" value={outcome} />
      {snoozeDays ? <input type="hidden" name="snooze_days" value={snoozeDays} /> : null}
      <button
        title={help}
        className={`h-9 w-full rounded-md border px-2 text-xs font-medium ${
          danger
            ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
            : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
        }`}
      >
        {label}
      </button>
    </form>
  );
}

function priorityTone(score: number) {
  if (score >= 85) return "green";
  if (score >= 70) return "yellow";
  return "neutral";
}
