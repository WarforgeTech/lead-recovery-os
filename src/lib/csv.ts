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
};

const synonyms: Record<keyof Mapping, string[]> = {
  name: ["name", "full name", "contact", "client name"],
  email: ["email", "email address"],
  phone: ["phone", "mobile", "cell", "telephone"],
  source: ["source", "lead source", "origin"],
  leadType: ["lead type", "type", "category"],
  area: ["area", "location", "market", "neighborhood"],
  priceRange: ["price", "budget", "price range", "value"],
  timeline: ["timeline", "timeframe", "when"],
  lastContactAt: ["last contact", "last contacted", "last contact date"],
  consent: ["consent", "opt in", "opt-in", "subscribed"],
  ownerName: ["owner", "agent", "assigned agent"],
  notes: ["notes", "summary", "last note", "description"],
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

    return {
      name,
      email,
      phone,
      source,
      leadType,
      area: String(value("area") ?? "").trim() || null,
      priceRange: String(value("priceRange") ?? "").trim() || null,
      timeline,
      lastContactAt: normalizeDate(value("lastContactAt")),
      consent: consentFrom(value("consent")),
      ownerName: String(value("ownerName") ?? "").trim() || null,
      rawNotes,
      normalizedSummary: rawNotes || [source, leadType, timeline].filter(Boolean).join(" / ") || "Imported lead record.",
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
