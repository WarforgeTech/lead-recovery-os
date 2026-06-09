import type { NormalizedLead, ParsedRecord, SourceKind } from "./types";

const fieldSynonyms: Record<string, string[]> = {
  name: ["name", "full name", "contact", "client", "borrower", "borrower name", "lead"],
  email: ["email", "email address", "e-mail"],
  phone: ["phone", "mobile", "cell", "telephone", "number"],
  source: ["source", "lead source", "origin", "channel", "referred by", "referral source"],
  status: ["status", "current status", "pipeline status", "application status", "stage", "lead status"],
  owner: ["owner", "agent", "assigned owner", "loan officer", "assistant"],
  notes: ["notes", "summary", "description", "conversation", "last note", "comments"],
  lastContactAt: ["last contact", "last contacted", "last contact date", "last meaningful contact", "date"],
  consent: ["consent", "opt in", "opt-in", "subscribed", "contact risk", "permission"],
  estimatedValue: ["value", "budget", "loan amount", "estimated loan amount", "price range", "amount"],
};

export function normalizeRecord(record: ParsedRecord, sourceKind: SourceKind): NormalizedLead {
  const get = (key: keyof typeof fieldSynonyms) => pick(record.raw, fieldSynonyms[key]);
  const email = normalizeEmail(get("email") || record.text);
  const phone = normalizePhone(get("phone") || record.text);
  const notes = textOrNull(get("notes")) ?? textOrNull(record.text);
  const status = textOrNull(get("status")) ?? inferStatus(record.text);
  const consent = sourceKind === "do_not_contact" ? "do_not_contact" : consentFrom(`${get("consent") ?? ""} ${status ?? ""} ${notes ?? ""}`);
  const name = cleanName(textOrNull(get("name")) ?? inferName(record.text, email, phone) ?? `Imported Lead ${record.rowNumber}`);

  return {
    name,
    email,
    phone,
    source: textOrNull(get("source")),
    status,
    owner: textOrNull(get("owner")),
    notes,
    lastContactAt: normalizeDate(get("lastContactAt") ?? record.text),
    consent,
    estimatedValue: normalizeMoney(get("estimatedValue") ?? record.text),
    stage: inferStage(`${status ?? ""} ${notes ?? ""}`),
  };
}

export function identityKey(lead: NormalizedLead) {
  if (lead.email) return `email:${lead.email}`;
  if (lead.phone) return `phone:${lead.phone}`;
  return `name_source:${slug(lead.name)}:${slug(lead.source ?? "")}`;
}

export function suppressionReason(lead: NormalizedLead, sourceKind: SourceKind) {
  const text = `${lead.status ?? ""} ${lead.notes ?? ""}`.toLowerCase();
  if (sourceKind === "do_not_contact") return "Uploaded as do-not-contact list";
  if (/(do not contact|dnc|stop|unsubscribe|opt.?out|no consent)/i.test(text) || lead.consent === "do_not_contact") return "Do not contact / opt-out language";
  if (sourceKind === "closed_leads" && /(funded elsewhere|closed lost|dead|no follow|do not follow|not interested)/i.test(text)) return "Closed or no-follow-up scrub list";
  if (/(funded elsewhere|closed lost|loan process dead|bad number|invalid phone|invalid email)/i.test(text)) return "Closed, funded elsewhere, or invalid contact";
  return null;
}

export function problemReason(lead: NormalizedLead) {
  if (!lead.email && !lead.phone) return "No phone or email";
  if (lead.consent === "review") return "Consent unclear";
  if (!lead.name || /^imported lead/i.test(lead.name)) return "Name missing or unclear";
  return null;
}

export function normalizeEmail(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0].toLowerCase() : null;
}

export function normalizePhone(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits.length === 10 ? digits : null;
}

function pick(raw: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(raw);
  for (const candidate of candidates) {
    const exact = entries.find(([key]) => key.trim().toLowerCase() === candidate);
    if (exact) return exact[1];
  }
  for (const candidate of candidates) {
    const fuzzy = entries.find(([key]) => key.trim().toLowerCase().includes(candidate));
    if (fuzzy) return fuzzy[1];
  }
  return null;
}

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanName(value: string) {
  return value.replace(/[<>"']/g, "").replace(/\s+/g, " ").trim();
}

function inferName(text: string, email: string | null, phone: string | null) {
  let cleaned = text;
  if (email) cleaned = cleaned.replace(email, "");
  if (phone) cleaned = cleaned.replace(phone, "");
  const beforeDelimiter = cleaned.split(/[,|\t;-]/)[0]?.trim();
  if (beforeDelimiter && /^[A-Za-z][A-Za-z\s'.-]{2,60}$/.test(beforeDelimiter)) return beforeDelimiter;
  const match = cleaned.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
  return match?.[1] ?? null;
}

function consentFrom(value: string): NormalizedLead["consent"] {
  const text = value.toLowerCase();
  if (/(do not|dnc|unsubscribe|opt.?out|no consent|stop)/.test(text)) return "do_not_contact";
  if (/(yes|ok|opt.?in|consent|subscribed|client|past client|referred|inquiry|application|lead)/.test(text)) return "ok";
  return "review";
}

function inferStatus(text: string) {
  const value = text.toLowerCase();
  if (/(app.*sent|application link)/.test(value)) return "Application sent, not started";
  if (/(started.*app|incomplete app|abandoned)/.test(value)) return "Application started, not submitted";
  if (/(docs|bank statement|signature|stips|condition)/.test(value)) return "Docs needed / pre-approval stuck";
  if (/(declined|not ready|credit|income issue)/.test(value)) return "Pre-approval declined / not ready";
  if (/(closed|past client|funded)/.test(value)) return "Past client / closed";
  if (/(realtor|partner|referral)/.test(value)) return "Referral partner";
  return null;
}

function inferStage(text: string) {
  const value = text.toLowerCase();
  if (/(do not|dnc|unsubscribe|opt.?out|stop)/.test(value)) return "needs_consent";
  if (/(funded elsewhere|could not fund|loan process dead|dead)/.test(value)) return "loan_process_dead";
  if (/(declined|not ready|credit|income issue)/.test(value)) return "preapproval_declined_not_ready";
  if (/(docs|bank statement|signature|stips|condition|upload)/.test(value)) return "docs_needed_preapproval_stuck";
  if (/(submitted|completed application|app complete)/.test(value)) return "application_submitted";
  if (/(no application started|not started|never started|has not started|haven't started|did not start)/.test(value)) return "application_sent_not_started";
  if (/(started.*app|incomplete app|abandoned)/.test(value)) return "application_started_not_submitted";
  if (/(app.*sent|application link|sent application)/.test(value)) return "application_sent_not_started";
  if (/(past client|closed client|referral partner|realtor|agent partner)/.test(value)) return "past_client_referral_partner";
  return "contacted_app_not_sent";
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const dateMatch = text.match(/\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2})\b/);
  const date = new Date(dateMatch?.[0] ?? text);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeMoney(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/\$?\s?([0-9][0-9,]*(?:\.[0-9]+)?)(k|m)?/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(base)) return null;
  const suffix = match[2]?.toLowerCase();
  if (suffix === "m") return Math.round(base * 1_000_000);
  if (suffix === "k") return Math.round(base * 1_000);
  return Math.round(base);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
