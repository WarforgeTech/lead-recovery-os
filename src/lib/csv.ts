import Papa from "papaparse";
import { consentFrom, normalizeEmail, normalizePhone, type ImportContact } from "./lead-processing";

export type Mapping = {
  name?: string;
  email?: string;
  phone?: string;
  source?: string;
  leadType?: string;
  area?: string;
  priceRange?: string;
  timeline?: string;
  lastContactAt?: string;
  consent?: string;
  ownerName?: string;
  notes?: string;
  currentStatus?: string;
  loanIntent?: string;
  estimatedLoanAmount?: string;
  referralSource?: string;
  missingNextStep?: string;
  lastMeaningfulContact?: string;
  docsMissing?: string;
};

const synonyms: Record<keyof Mapping, string[]> = {
  name: ["name", "full name", "contact", "client name", "borrower", "borrower name"],
  email: ["email", "email address"],
  phone: ["phone", "mobile", "cell", "telephone"],
  source: ["source", "lead source", "origin", "channel"],
  leadType: ["lead type", "type", "category", "borrower type", "contact type"],
  area: ["area", "location", "market", "neighborhood"],
  priceRange: ["price", "budget", "price range", "value", "loan amount", "estimated loan amount"],
  timeline: ["timeline", "timeframe", "when"],
  lastContactAt: ["last contact", "last contacted", "last contact date", "last meaningful contact"],
  consent: ["consent", "opt in", "opt-in", "subscribed", "contact risk"],
  ownerName: ["owner", "agent", "assigned agent", "assigned owner", "loan officer", "assistant"],
  notes: ["notes", "summary", "last note", "description", "conversation notes"],
  currentStatus: ["current status", "status", "pipeline status", "application status", "loan status"],
  loanIntent: ["loan goal", "loan intent", "purchase/refi intent", "intent", "purchase or refi"],
  estimatedLoanAmount: ["estimated loan amount", "loan amount", "target loan amount", "volume"],
  referralSource: ["referral source", "referral partner", "partner", "referred by"],
  missingNextStep: ["missing next step", "next step", "missing item", "needed item"],
  lastMeaningfulContact: ["last meaningful contact", "last meaningful contact date", "meaningful contact"],
  docsMissing: ["docs missing", "missing docs", "documents missing", "bank statements"],
};

export function parseCsv(csv: string) {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors[0]?.message ?? "CSV parse failed");
  }
  return parsed.data;
}

export function inferMapping(headers: string[]): Mapping {
  const normalized = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  const mapping: Mapping = {};
  for (const key of Object.keys(synonyms) as Array<keyof Mapping>) {
    const match = synonyms[key].map((candidate) => normalized.get(candidate)).find(Boolean);
    if (match) mapping[key] = match;
  }
  return mapping;
}

export function applyMapping(rows: Record<string, string>[], mapping: Mapping): ImportContact[] {
  return rows.map((row, index) => {
    const value = (key: keyof Mapping) => {
      const column = mapping[key];
      return column ? row[column] : "";
    };
    const name = String(value("name") || value("email") || value("phone") || `Imported Contact ${index + 1}`).trim();
    const email = normalizeEmail(value("email"));
    const phone = normalizePhone(value("phone"));
    const rawNotes = String(value("notes") ?? "").trim() || null;
    const source = String(value("source") ?? "").trim() || null;
    const leadType = String(value("leadType") ?? "").trim() || null;
    const timeline = String(value("timeline") ?? "").trim() || null;
    const lastContactAt = normalizeDate(value("lastMeaningfulContact")) || normalizeDate(value("lastContactAt"));
    const pipelineMetadata = {
      current_status: String(value("currentStatus") ?? "").trim() || null,
      loan_intent: String(value("loanIntent") ?? "").trim() || null,
      estimated_loan_amount: normalizeMoney(value("estimatedLoanAmount")) ?? normalizeMoney(value("priceRange")),
      referral_source: String(value("referralSource") ?? "").trim() || null,
      missing_next_step: String(value("missingNextStep") ?? "").trim() || null,
      last_meaningful_contact: lastContactAt,
      docs_missing: String(value("docsMissing") ?? "").trim() || null,
    };

    return {
      name,
      email,
      phone,
      source,
      leadType,
      area: String(value("area") ?? "").trim() || null,
      priceRange: String(value("priceRange") ?? "").trim() || null,
      timeline,
      lastContactAt,
      consent: consentFrom(value("consent")),
      ownerName: String(value("ownerName") ?? "").trim() || null,
      rawNotes,
      normalizedSummary: rawNotes || [source, leadType, timeline].filter(Boolean).join(" / ") || "Imported lead record.",
      pipelineMetadata,
    };
  });
}

function normalizeDate(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeMoney(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const digits = text.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? Math.round(amount) : null;
}
