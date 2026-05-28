import {
  draftFor,
  recommendedAction,
  scoreContact,
  segmentContact,
  statusFor,
  type ImportContact,
} from "./lead-processing";
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
  const stageLabel = mortgageStageLabel(stage);

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
      stage_label: stageLabel,
      queue: mortgageQueue(stage),
      why_now: mortgageWhyNow(stage, days, loanAmount),
      next_step: nextStep,
      days_since_last_meaningful_contact: days,
      rescue_bucket: rescueBucket(days),
      assigned_owner: contact.ownerName,
      referral_source: stringValue(metadata.referral_source),
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

  if (/(doc|document|bank statement|signature|stips|condition|missing)/.test(haystack)) return "docs_missing";
  if (/(partner|referral partner|realtor|agent partner|attorney)/.test(haystack)) return "referral_partner";
  if (/(past client|closed client|closed loan|review|annual)/.test(haystack)) return "past_client";
  if (/(pre.?approved|preapproval)/.test(haystack)) return "pre_approved";
  if (/(pre.?qualified|prequal)/.test(haystack)) return "pre_qualified";
  if (/(credit|underwriting|review)/.test(haystack)) return "credit_doc_review";
  if (/(completed application|application completed|app complete)/.test(haystack)) return "application_completed";
  if (/(application started|started app|incomplete application|app started|1003 started)/.test(haystack)) return "application_started";
  if (/(lost|stale|ghosted|went quiet|no response)/.test(haystack)) return "lost_stale";
  if (/(new referral|referred|intro)/.test(haystack)) return "new_referral";
  return "talked_no_application";
}

function mortgageSegment(stage: string, contact: ImportContact): LeadSegment {
  if (contact.consent !== "ok") return "needs_consent";
  if (stage === "referral_partner") return "referral_ask";
  if (stage === "past_client") return "past_client";
  if (stage === "lost_stale") return "old_buyer";
  if (stage === "docs_missing" || stage === "credit_doc_review" || stage === "pre_qualified" || stage === "pre_approved") return "old_seller";
  return "hot_reactivation";
}

function mortgageStatus(stage: string, contact: ImportContact): OpportunityStatus {
  if (contact.consent === "do_not_contact") return "do_not_contact";
  if (contact.consent === "review" || stage === "needs_consent") return "needs_review";
  if (stage === "pre_approved" || stage === "application_completed") return "contacted";
  return "ready_to_contact";
}

function mortgagePriorityScore(contact: ImportContact, stage: string, days: number | null, loanAmount: number) {
  let score = 45;
  if (contact.email) score += 8;
  if (contact.phone) score += 8;
  if (loanAmount >= 400000) score += 10;
  if (stage === "talked_no_application" || stage === "application_started") score += 20;
  if (stage === "docs_missing") score += 15;
  if (stage === "referral_partner") score += 12;
  if (days !== null && days >= 8 && days <= 21) score += 15;
  if (days !== null && days > 21) score += 8;
  if (contact.consent !== "ok") score = Math.min(score, 35);
  return Math.max(5, Math.min(100, score));
}

function mortgageRecommendedAction(stage: string, nextStep: string, days: number | null) {
  if (stage === "needs_consent") return "Review contact source and consent before drafting outbound follow-up.";
  if (stage === "referral_partner") return "Send a relationship-first partner check-in without referral-compensation language.";
  if (stage === "past_client") return "Send a personal check-in and ask whether they know anyone who needs lending guidance.";
  if (stage === "docs_missing") return `Have assistant follow up on ${nextStep.toLowerCase()} and offer hand-holding.`;
  if (stage === "application_started") return "Push the borrower back to the incomplete application before the 14/21-day drop-off window.";
  if (stage === "talked_no_application") return "Ask whether they want the application link again and offer help finishing the first step.";
  if (days !== null && days >= 15) return "Rescue now; this borrower is in the 15-21+ day drop-off zone.";
  return "Send the next-best-action follow-up and keep the borrower moving toward application.";
}

function mortgageDraft(contact: ImportContact, stage: string, nextStep: string) {
  if (contact.consent !== "ok") return "";
  const firstName = contact.name.split(/\s+/)[0] || "there";
  const owner = contact.ownerName || "Adam";
  if (stage === "referral_partner") {
    return `Hey ${firstName}, ${owner} here. I am tightening up how I help borrowers who stall before application or docs. If anyone in your world is stuck or unsure what to do next, I am happy to help them get clear on the next step.`;
  }
  if (stage === "past_client") {
    return `Hi ${firstName}, ${owner} here. I wanted to check in and see how everything has been since closing. If you or someone you trust has mortgage questions this year, I am happy to be a resource.`;
  }
  if (stage === "docs_missing") {
    return `Hi ${firstName}, ${owner} here. I saw the next step is ${nextStep.toLowerCase()}. If anything about the upload or signatures is confusing, we can walk through it with you.`;
  }
  if (stage === "application_started") {
    return `Hi ${firstName}, ${owner} here. It looks like the application was started but not finished. Want me to resend the link and help you get the remaining step knocked out?`;
  }
  return `Hi ${firstName}, ${owner} here. We talked about your loan path, but I do not see the application finished yet. Are you still moving forward, or did timing change?`;
}

function mortgageStageLabel(stage: string) {
  const labels: Record<string, string> = {
    new_referral: "New referral",
    talked_no_application: "Talked, no application",
    application_started: "Application started",
    application_completed: "Application completed",
    pre_qualified: "Pre-qualified",
    docs_missing: "Docs missing",
    credit_doc_review: "Credit/doc review",
    pre_approved: "Pre-approved",
    lost_stale: "Lost or stale",
    referral_partner: "Referral partner",
    past_client: "Past client",
    needs_consent: "Needs consent",
  };
  return labels[stage] ?? "Pipeline follow-up";
}

function mortgageQueue(stage: string) {
  if (stage === "referral_partner") return "referral_partner";
  if (stage === "docs_missing" || stage === "credit_doc_review") return "assistant_task";
  if (stage === "lost_stale") return "rescue";
  if (stage === "talked_no_application" || stage === "application_started" || stage === "new_referral") return "application_conversion";
  return "next_best_action";
}

function mortgageWhyNow(stage: string, days: number | null, loanAmount: number) {
  if (stage === "application_started") return "The application is started but incomplete, which is the highest-leverage conversion leak.";
  if (stage === "talked_no_application") return "Borrower has had a conversation but has not crossed into application.";
  if (stage === "docs_missing") return "The borrower needs hand-holding before the file can advance.";
  if (stage === "referral_partner") return "Referral-driven pipeline needs consistent relationship touches.";
  if (days !== null && days >= 15) return `${days} days since meaningful contact; this is inside the 14/21-day danger zone.`;
  return `${formatCurrency(loanAmount * 100)} estimated loan amount in active pipeline.`;
}

function nextStepForMortgageStage(stage: string) {
  if (stage === "docs_missing") return "missing documents";
  if (stage === "application_started") return "complete application";
  if (stage === "talked_no_application") return "finish application";
  if (stage === "referral_partner") return "relationship check-in";
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
