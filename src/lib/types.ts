export type LeadSegment =
  | "hot_reactivation"
  | "old_buyer"
  | "old_seller"
  | "past_client"
  | "referral_ask"
  | "needs_consent";

export type ConsentStatus = "ok" | "review" | "do_not_contact";

export type OpportunityStatus =
  | "new"
  | "needs_review"
  | "ready_to_contact"
  | "approved"
  | "contacted"
  | "replied"
  | "appointment_set"
  | "not_now"
  | "do_not_contact"
  | "closed_won"
  | "closed_lost";

export const segmentLabels: Record<string, string> = {
  hot_reactivation: "Hot reactivation",
  old_buyer: "Old buyers",
  old_seller: "Old sellers",
  past_client: "Past clients",
  referral_ask: "Referral asks",
  needs_consent: "Needs consent",
};

export const statusLabels: Record<string, string> = {
  new: "New",
  needs_review: "Needs review",
  ready_to_contact: "Ready to contact",
  approved: "Approved",
  contacted: "Contacted",
  replied: "Replied",
  appointment_set: "Appointment set",
  not_now: "Not now",
  do_not_contact: "Do not contact",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};
