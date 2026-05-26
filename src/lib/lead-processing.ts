import type { ConsentStatus, LeadSegment } from "./types";

export type ImportContact = {
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  leadType: string | null;
  area: string | null;
  priceRange: string | null;
  timeline: string | null;
  lastContactAt: string | null;
  consent: ConsentStatus;
  ownerName: string | null;
  rawNotes: string | null;
  normalizedSummary: string;
};

export function normalizePhone(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email.includes("@") ? email : null;
}

export function consentFrom(value: unknown): ConsentStatus {
  const text = String(value ?? "").toLowerCase();
  if (/(do not|dnc|unsubscribe|opt.?out|no consent|stop)/.test(text)) return "do_not_contact";
  if (/(yes|ok|opt.?in|consent|subscribed|client|past)/.test(text)) return "ok";
  return "review";
}

export function segmentContact(contact: ImportContact): LeadSegment {
  if (contact.consent === "do_not_contact" || contact.consent === "review") return "needs_consent";
  const haystack = `${contact.leadType ?? ""} ${contact.source ?? ""} ${contact.rawNotes ?? ""}`.toLowerCase();
  if (/(past|closed|client|review|referral)/.test(haystack)) return "past_client";
  if (/(loan|lender|partner|referral)/.test(haystack)) return "referral_ask";
  if (/(seller|valuation|listing|home value)/.test(haystack)) return "old_seller";
  if (/(buyer|zillow|realtor|open house|showing)/.test(haystack)) return "old_buyer";
  return "hot_reactivation";
}

export function scoreContact(contact: ImportContact, segment: LeadSegment) {
  let score = 45;
  if (contact.email) score += 10;
  if (contact.phone) score += 10;
  if (contact.timeline) score += 10;
  if (contact.priceRange) score += 10;
  if (segment === "hot_reactivation") score += 15;
  if (segment === "needs_consent") score = Math.min(score, 35);
  return Math.max(5, Math.min(100, score));
}

export function recommendedAction(segment: LeadSegment, consent: ConsentStatus) {
  if (consent === "do_not_contact") return "Do not message. Keep this record suppressed unless consent is re-confirmed.";
  if (consent === "review") return "Review consent/source before adding this contact to an outbound queue.";
  switch (segment) {
    case "old_buyer":
      return "Ask whether they are still looking, paused, or already bought.";
    case "old_seller":
      return "Offer a fresh home-value check-in and current inventory read.";
    case "past_client":
      return "Send a personal check-in, then ask for a review or trusted referral.";
    case "referral_ask":
      return "Send a relationship-first partner check-in without referral-compensation language.";
    case "needs_consent":
      return "Confirm consent and source before drafting outbound copy.";
    default:
      return "Call first, then send a soft re-entry message after human approval.";
  }
}

export function draftFor(contact: ImportContact, segment: LeadSegment) {
  if (contact.consent === "do_not_contact" || contact.consent === "review") {
    return "";
  }

  const firstName = contact.name.split(/\s+/)[0] || "there";
  const agent = contact.ownerName || "Avery";
  const area = contact.area ? ` around ${contact.area}` : "";

  if (segment === "old_seller") {
    return `Hi ${firstName}, ${agent} here. You had asked about selling${area}. Inventory has shifted since then, and I can run a fresh quick value check if that is still on your mind.`;
  }
  if (segment === "past_client") {
    return `Hi ${firstName}, ${agent} here. I wanted to check in and see how the home has been treating you. Also, if anyone you trust is starting to think about a move, I would be grateful for the intro.`;
  }
  if (segment === "referral_ask") {
    return `Hey ${firstName}, ${agent} here. I am tightening my follow-up process for buyers and sellers who go quiet. If you have anyone stalled out right now, I can help re-engage them and keep you in the loop.`;
  }
  return `Hi ${firstName}, it is ${agent}. I was looking back at my notes and saw you were exploring a move${area}. Are you still looking, or did you decide to pause?`;
}

export function statusFor(segment: LeadSegment, consent: ConsentStatus) {
  if (consent === "do_not_contact") return "do_not_contact";
  if (consent === "review" || segment === "needs_consent") return "needs_review";
  return "ready_to_contact";
}
