import {
  draftFor,
  recommendedAction,
  scoreContact,
  segmentContact,
  statusFor,
  type ImportContact,
} from "./lead-processing";
import { stageLabel } from "./mortgage-workflow";
import type { LeadSegment, OpportunityStatus } from "./types";

export type PipelineTemplateId = "real_estate_default" | "mortgage_growth";

export type PipelineTemplate = {
  id: PipelineTemplateId;
  name: string;
  entityLabel: string;
  entityPluralLabel: string;
  primaryGoalLabel: string;
  segmentLabels: Record<LeadSegment, string>;
  defaultSettings: Record<string, number | string>;
};

export type PipelineClassification = {
  segment: LeadSegment;
  status: OpportunityStatus;
  priorityScore: number;
  estimatedValueCents: number;
  recommendedAction: string;
  draftText: string;
  contactMetadata: Record<string, string | number | boolean | null>;
  opportunityMetadata: Record<string, string | number | boolean | null>;
};

export const pipelineTemplates: Record<PipelineTemplateId, PipelineTemplate> = {
  real_estate_default: {
    id: "real_estate_default",
    name: "Real estate / local sales",
    entityLabel: "lead",
    entityPluralLabel: "leads",
    primaryGoalLabel: "Recoverable commission",
    segmentLabels: {
      hot_reactivation: "Hot reactivation",
      old_buyer: "Old buyers",
      old_seller: "Old sellers",
      past_client: "Past clients",
      referral_ask: "Referral asks",
      needs_consent: "Needs consent",
    },
    defaultSettings: {
      default_transaction_value_cents: 830000,
    },
  },
  mortgage_growth: {
    id: "mortgage_growth",
    name: "Mortgage growth",
    entityLabel: "borrower",
    entityPluralLabel: "borrowers",
    primaryGoalLabel: "Applications and loan volume",
    segmentLabels: {
      hot_reactivation: "Application conversion",
      old_buyer: "14/21-day rescue",
      old_seller: "Loan review path",
      past_client: "Past clients",
      referral_ask: "Referral partners",
      needs_consent: "Needs consent",
    },
    defaultSettings: {
      monthly_volume_goal_cents: 300000000,
      annual_volume_goal_cents: 2200000000,
      applications_per_day_target: 2,
      applications_per_week_target: 10,
      loans_per_month_target: 8,
      default_transaction_value_cents: 42000000,
    },
  },
};

export function getPipelineTemplate(id?: string | null) {
  if (id === "mortgage_growth") return pipelineTemplates.mortgage_growth;
  return pipelineTemplates.real_estate_default;
}

export function getPipelineTemplateId(id?: string | null): PipelineTemplateId {
  return id === "mortgage_growth" ? "mortgage_growth" : "real_estate_default";
}

export function defaultOrganizationSettings(templateId: PipelineTemplateId) {
  return pipelineTemplates[templateId].defaultSettings;
}

export function classifyPipelineOpportunity(contact: ImportContact, templateId: PipelineTemplateId): PipelineClassification {
  if (templateId === "mortgage_growth") return classifyMortgageOpportunity(contact);
  const segment = segmentContact(contact);
  return {
    segment,
    status: statusFor(segment, contact.consent) as OpportunityStatus,
    priorityScore: scoreContact(contact, segment),
    estimatedValueCents: 830000,
    recommendedAction: recommendedAction(segment, contact.consent),
    draftText: draftFor(contact, segment),
    contactMetadata: contact.pipelineMetadata ?? {},
    opportunityMetadata: { pipeline_stage: segment, stage_label: pipelineTemplates.real_estate_default.segmentLabels[segment] },
  };
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function daysSince(dateValue: string | null | undefined) {
  if (!dateValue) return null;
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return null;
  return Math.max(0, Math.floor((Date.now() - date.valueOf()) / 86400000));
}

export function rescueBucket(days: number | null) {
  if (days === null) return "No contact date";
  if (days <= 7) return "0-7 days";
  if (days <= 14) return "8-14 days";
  if (days <= 21) return "15-21 days";
  return "22+ days";
}

function classifyMortgageOpportunity(contact: ImportContact): PipelineClassification {
  const metadata = contact.pipelineMetadata ?? {};
  const stage = mortgageStage(contact);
  const segment = mortgageSegment(stage, contact);
  const status = mortgageStatus(stage, contact);
  const loanAmount = numberValue(metadata.estimated_loan_amount) ?? parseMoney(contact.priceRange) ?? 420000;
  const lastMeaningfulContact = stringValue(metadata.last_meaningful_contact) || contact.lastContactAt;
  const days = daysSince(lastMeaningfulContact);
  const nextStep = stringValue(metadata.missing_next_step) || nextStepForMortgageStage(stage);
  const priorityScore = mortgagePriorityScore(contact, stage, days, loanAmount);
  const action = mortgageRecommendedAction(stage, nextStep, days);
  const draftText = mortgageDraft(contact, stage, nextStep);
  const displayStage = stageLabel(stage);

  return {
    segment,
    status,
    priorityScore,
    estimatedValueCents: loanAmount * 100,
    recommendedAction: action,
    draftText,
    contactMetadata: {
      ...metadata,
      last_meaningful_contact: lastMeaningfulContact,
      estimated_loan_amount: loanAmount,
    },
    opportunityMetadata: {
      pipeline_stage: stage,
      stage_label: displayStage,
      queue: mortgageQueue(stage),
      why_now: mortgageWhyNow(stage, days, loanAmount),
      next_step: nextStep,
      days_since_last_meaningful_contact: days,
      rescue_bucket: rescueBucket(days),
      assigned_owner: contact.ownerName,
      referral_source: stringValue(metadata.referral_source),
      next_due_at: lastMeaningfulContact || new Date().toISOString().slice(0, 10),
      touch_count: 0,
      cadence_state: "active",
      last_outcome: null,
      needs_escalation: contact.ownerName === "Adam" && stage !== "past_client_referral_partner",
    },
  };
}

function mortgageStage(contact: ImportContact) {
  if (contact.consent !== "ok") return "needs_consent";
  const metadata = contact.pipelineMetadata ?? {};
  const haystack = [
    contact.leadType,
    contact.source,
    contact.rawNotes,
    metadata.current_status,
    metadata.loan_intent,
    metadata.referral_source,
    metadata.missing_next_step,
    metadata.docs_missing,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(dead loan|could not fund|bank.*(denied|declined)|loan process dead|funding fell through)/.test(haystack)) return "loan_process_dead";
  if (/(declined|not ready|credit issue|income issue|too low|pre.?qual.*fail|pre.?approval declined)/.test(haystack)) return "preapproval_declined_not_ready";
  if (/(doc|document|bank statement|signature|stips|condition|missing|upload)/.test(haystack)) return "docs_needed_preapproval_stuck";
  if (/(pre.?qualified|prequal)/.test(haystack)) return "pre_qualified";
  if (/(submitted application|application submitted|completed application|application completed|app complete)/.test(haystack)) return "application_submitted";
  if (/(application started|started app|incomplete application|app started|1003 started|abandoned)/.test(haystack)) return "application_started_not_submitted";
  if (/(application sent|sent application|sent app|link sent)/.test(haystack)) return "application_sent_not_started";
  if (/(contacted.*not sent|needs application link|send application|send app)/.test(haystack)) return "contacted_app_not_sent";
  if (/(new referral|referred|intro|facebook|imessage|text message|inbound)/.test(haystack)) return "new_inbound_referral";
  if (/(partner|referral partner|realtor|agent partner|attorney|past client|closed client|closed loan|review|annual)/.test(haystack)) return "past_client_referral_partner";
  return "contacted_app_not_sent";
}

function mortgageSegment(stage: string, contact: ImportContact): LeadSegment {
  if (contact.consent !== "ok") return "needs_consent";
  if (stage === "past_client_referral_partner") return /past client|closed client|annual|review/i.test(contact.leadType ?? "") ? "past_client" : "referral_ask";
  if (stage === "preapproval_declined_not_ready" || stage === "loan_process_dead") return "old_buyer";
  if (stage === "docs_needed_preapproval_stuck" || stage === "pre_qualified") return "old_seller";
  return "hot_reactivation";
}

function mortgageStatus(stage: string, contact: ImportContact): OpportunityStatus {
  if (contact.consent === "do_not_contact") return "do_not_contact";
  if (contact.consent === "review" || stage === "needs_consent") return "needs_review";
  if (stage === "application_submitted" || stage === "pre_qualified") return "contacted";
  return "ready_to_contact";
}

function mortgagePriorityScore(contact: ImportContact, stage: string, days: number | null, loanAmount: number) {
  let score = 45;
  if (contact.email) score += 8;
  if (contact.phone) score += 8;
  if (loanAmount >= 400000) score += 10;
  if (["contacted_app_not_sent", "application_sent_not_started", "application_started_not_submitted"].includes(stage)) score += 20;
  if (stage === "docs_needed_preapproval_stuck") score += 15;
  if (stage === "past_client_referral_partner") score += 12;
  if (stage === "loan_process_dead" || stage === "preapproval_declined_not_ready") score += 10;
  if (days !== null && days >= 8 && days <= 21) score += 15;
  if (days !== null && days > 21) score += 8;
  if (contact.consent !== "ok") score = Math.min(score, 35);
  return Math.max(5, Math.min(100, score));
}

function mortgageRecommendedAction(stage: string, nextStep: string, days: number | null) {
  if (stage === "needs_consent") return "Review contact source and consent before drafting outbound follow-up.";
  if (stage === "past_client_referral_partner") return "Send a relationship-first check-in without referral-compensation language.";
  if (stage === "docs_needed_preapproval_stuck") return `Have assistant follow up on ${nextStep.toLowerCase()} and offer hand-holding.`;
  if (stage === "application_started_not_submitted") return "Push the borrower back to the incomplete application before the 14/21-day drop-off window.";
  if (stage === "application_sent_not_started") return "Remind them the application link is waiting and offer help with the first step.";
  if (stage === "contacted_app_not_sent") return "Send the application link and offer to walk them through the first step.";
  if (stage === "preapproval_declined_not_ready") return "Check whether the blocker has changed and offer a fresh path review.";
  if (stage === "loan_process_dead") return "Resurface the dead file and ask whether timing or lender options have changed.";
  if (days !== null && days >= 15) return "Rescue now; this borrower is in the 15-21+ day drop-off zone.";
  return "Send the next-best-action follow-up and keep the borrower moving toward application.";
}

function mortgageDraft(contact: ImportContact, stage: string, nextStep: string) {
  if (contact.consent !== "ok") return "";
  const firstName = contact.name.split(/\s+/)[0] || "there";
  const owner = contact.ownerName || "Adam";
  if (stage === "past_client_referral_partner") {
    return `Hey ${firstName}, ${owner} here. I am tightening up how I help borrowers who stall before application or docs. If anyone in your world is stuck or unsure what to do next, I am happy to help them get clear on the next step.`;
  }
  if (stage === "docs_needed_preapproval_stuck") {
    return `Hi ${firstName}, ${owner} here. I saw the next step is ${nextStep.toLowerCase()}. If anything about the upload or signatures is confusing, we can walk through it with you.`;
  }
  if (stage === "application_started_not_submitted") {
    return `Hi ${firstName}, ${owner} here. It looks like the application was started but not finished. Want me to resend the link and help you get the remaining step knocked out?`;
  }
  if (stage === "application_sent_not_started") {
    return `Hi ${firstName}, ${owner} here. I sent the application link over, but I do not see it started yet. Want me to resend it and help with the first step?`;
  }
  if (stage === "preapproval_declined_not_ready" || stage === "loan_process_dead") {
    return `Hi ${firstName}, ${owner} here. I wanted to check back in because situations change. If you are still thinking about buying, I am happy to review where things stand and what the next best path might be.`;
  }
  return `Hi ${firstName}, ${owner} here. We talked about your loan path, but I do not see the application finished yet. Are you still moving forward, or did timing change?`;
}

function mortgageQueue(stage: string) {
  if (stage === "past_client_referral_partner") return "relationship";
  if (stage === "docs_needed_preapproval_stuck" || stage === "pre_qualified") return "docs_stuck";
  if (stage === "preapproval_declined_not_ready" || stage === "loan_process_dead") return "dead_deal";
  if (["contacted_app_not_sent", "application_sent_not_started", "application_started_not_submitted", "new_inbound_referral"].includes(stage)) return "application_follow_up";
  return "next_best_action";
}

function mortgageWhyNow(stage: string, days: number | null, loanAmount: number) {
  if (stage === "application_started_not_submitted") return "The application was started but never submitted, which is the highest-leverage conversion leak.";
  if (stage === "application_sent_not_started") return "The application link was sent, but the borrower never started it.";
  if (stage === "contacted_app_not_sent") return "The borrower had intent, but the application step never happened.";
  if (stage === "docs_needed_preapproval_stuck") return "The borrower needs hand-holding before pre-approval can move forward.";
  if (stage === "preapproval_declined_not_ready") return "This person was not ready before, but the blocker may have changed.";
  if (stage === "loan_process_dead") return "The deal died in process and was never put back into a recovery cadence.";
  if (stage === "past_client_referral_partner") return "Relationship-driven pipeline needs consistent useful touches.";
  if (days !== null && days >= 15) return `${days} days since meaningful contact; this is inside the 14/21-day danger zone.`;
  return `${formatCurrency(loanAmount * 100)} estimated loan amount in active pipeline.`;
}

function nextStepForMortgageStage(stage: string) {
  if (stage === "docs_needed_preapproval_stuck") return "missing documents";
  if (stage === "application_started_not_submitted") return "submit application";
  if (stage === "application_sent_not_started") return "start application";
  if (stage === "contacted_app_not_sent") return "send application link";
  if (stage === "preapproval_declined_not_ready") return "fresh path review";
  if (stage === "loan_process_dead") return "restart conversation";
  if (stage === "past_client_referral_partner") return "relationship check-in";
  return "next borrower follow-up";
}

function parseMoney(value: string | null) {
  if (!value) return null;
  const digits = value.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}
