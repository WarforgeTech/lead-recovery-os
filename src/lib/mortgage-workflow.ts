import type { OpportunityStatus } from "./types";
import { formatDate } from "./format";

export type WorkflowOutcome =
  | "mark_contacted"
  | "no_response"
  | "replied"
  | "application_submitted"
  | "appointment_set"
  | "needs_adam"
  | "snooze"
  | "not_now"
  | "do_not_contact";

export type WorkflowFilter =
  | "all"
  | "application"
  | "docs"
  | "dead"
  | "relationships"
  | "needs_adam";

type WorkflowMetadata = Record<string, unknown>;

const cadenceDays = [3, 7, 14];

export const workflowFilters: Array<{ id: WorkflowFilter; label: string }> = [
  { id: "all", label: "All due today" },
  { id: "application", label: "Application not completed" },
  { id: "docs", label: "Pre-approval / docs stuck" },
  { id: "dead", label: "Past declined / dead deal" },
  { id: "relationships", label: "Referral partner / past client" },
  { id: "needs_adam", label: "Escalated to Adam" },
];

export const mortgageStageLabels: Record<string, string> = {
  new_inbound_referral: "New inbound / referral",
  contacted_app_not_sent: "Contacted, application not sent",
  application_sent_not_started: "Application sent, not started",
  application_started_not_submitted: "Application started, not submitted",
  application_submitted: "Application submitted",
  pre_qualified: "Pre-qualified",
  docs_needed_preapproval_stuck: "Docs needed / pre-approval stuck",
  preapproval_declined_not_ready: "Pre-approval declined / not ready",
  loan_process_dead: "Loan process dead / could not fund",
  past_client_referral_partner: "Past client / referral partner",
  needs_consent: "Do not contact / needs consent",
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isDue(nextFollowUpAt?: string | null, status?: string) {
  if (["do_not_contact", "closed_lost", "closed_won", "appointment_set"].includes(status ?? "")) return false;
  if (!nextFollowUpAt) return true;
  return nextFollowUpAt <= todayIso();
}

export function stageLabel(stage?: string | null) {
  return mortgageStageLabels[stage ?? ""] ?? stage ?? "Pipeline follow-up";
}

export function filterForStage(stage?: string | null): WorkflowFilter {
  if (["contacted_app_not_sent", "application_sent_not_started", "application_started_not_submitted", "new_inbound_referral"].includes(stage ?? "")) return "application";
  if (["docs_needed_preapproval_stuck", "pre_qualified"].includes(stage ?? "")) return "docs";
  if (["preapproval_declined_not_ready", "loan_process_dead"].includes(stage ?? "")) return "dead";
  if (stage === "past_client_referral_partner") return "relationships";
  return "all";
}

export function matchesWorkflowFilter(item: { pipeline_metadata?: WorkflowMetadata | null }, filter: WorkflowFilter) {
  if (filter === "all") return true;
  const metadata = item.pipeline_metadata ?? {};
  if (filter === "needs_adam") return metadata.needs_escalation === true || metadata.assigned_owner === "Adam";
  return filterForStage(String(metadata.pipeline_stage ?? "")) === filter;
}

export function cadenceLabel(metadata?: WorkflowMetadata | null) {
  const touchCount = Number(metadata?.touch_count ?? 0);
  const nextDue = String(metadata?.next_due_at ?? "");
  if (!touchCount) return "Touch 1";
  if (nextDue) return `Touch ${Math.min(touchCount + 1, 4)} due ${formatDate(nextDue)}`;
  return String(metadata?.cadence_state ?? "No active cadence");
}

export function applyWorkflowOutcome({
  currentMetadata,
  currentStatus,
  outcome,
  snoozeDays,
}: {
  currentMetadata: WorkflowMetadata | null;
  currentStatus: OpportunityStatus;
  outcome: WorkflowOutcome;
  snoozeDays?: number;
}): {
  status: OpportunityStatus;
  nextFollowUpAt: string | null;
  metadata: WorkflowMetadata;
  eventLabel: string;
} {
  const metadata: WorkflowMetadata = { ...(currentMetadata ?? {}) };
  const previousTouchCount = Number(metadata.touch_count ?? 0);
  const nextTouchCount = ["mark_contacted", "no_response", "replied", "application_submitted", "appointment_set"].includes(outcome)
    ? previousTouchCount + 1
    : previousTouchCount;
  const today = todayIso();

  metadata.last_touch_at = ["mark_contacted", "no_response", "replied", "application_submitted", "appointment_set"].includes(outcome)
    ? today
    : metadata.last_touch_at ?? null;
  metadata.touch_count = nextTouchCount;
  metadata.last_outcome = outcome;

  if (outcome === "no_response" || outcome === "mark_contacted") {
    const delay = cadenceDays[Math.min(nextTouchCount - 1, cadenceDays.length - 1)];
    const exhausted = nextTouchCount >= 4;
    metadata.cadence_state = exhausted ? "long_term_nurture" : "active";
    metadata.next_due_at = exhausted ? addDaysIso(30) : addDaysIso(delay);
    return {
      status: exhausted ? "not_now" : "contacted",
      nextFollowUpAt: String(metadata.next_due_at),
      metadata,
      eventLabel: outcome === "no_response" ? "No reply; next follow-up scheduled" : "Outreach logged; next follow-up scheduled",
    };
  }

  if (outcome === "replied") {
    metadata.cadence_state = "replied";
    metadata.next_due_at = null;
    return { status: "replied", nextFollowUpAt: null, metadata, eventLabel: "Borrower replied" };
  }

  if (outcome === "application_submitted") {
    metadata.cadence_state = "application_submitted";
    metadata.pipeline_stage = "application_submitted";
    metadata.stage_label = stageLabel("application_submitted");
    metadata.next_due_at = null;
    return { status: "contacted", nextFollowUpAt: null, metadata, eventLabel: "Application submitted" };
  }

  if (outcome === "appointment_set") {
    metadata.cadence_state = "appointment_set";
    metadata.next_due_at = null;
    return { status: "appointment_set", nextFollowUpAt: null, metadata, eventLabel: "Appointment set" };
  }

  if (outcome === "needs_adam") {
    metadata.needs_escalation = true;
    metadata.assigned_owner = "Adam";
    metadata.next_due_at = today;
    metadata.cadence_state = "needs_adam";
    return { status: "ready_to_contact", nextFollowUpAt: today, metadata, eventLabel: "Escalated to Adam" };
  }

  if (outcome === "snooze") {
    const days = snoozeDays && snoozeDays > 0 ? snoozeDays : 3;
    metadata.cadence_state = "snoozed";
    metadata.next_due_at = addDaysIso(days);
    return { status: currentStatus, nextFollowUpAt: String(metadata.next_due_at), metadata, eventLabel: `Follow-up moved ${days} days out` };
  }

  if (outcome === "not_now") {
    metadata.cadence_state = "not_now";
    metadata.next_due_at = addDaysIso(14);
    return { status: "not_now", nextFollowUpAt: String(metadata.next_due_at), metadata, eventLabel: "Paused for 14 days" };
  }

  metadata.cadence_state = "do_not_contact";
  metadata.next_due_at = null;
  return { status: "do_not_contact", nextFollowUpAt: null, metadata, eventLabel: "Marked do not contact" };
}
