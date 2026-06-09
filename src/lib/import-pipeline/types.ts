// Shared types for the Vercel-native import pipeline. Ported verbatim from the
// former Railway worker; the pipeline now runs as a durable Vercel Workflow.

export type SourceKind = "lead_file" | "closed_leads" | "do_not_contact" | "mixed";

export type ImportRecord = {
  id: string;
  organization_id: string;
  source_filename: string | null;
  raw_file_path: string | null;
  raw_file_url: string | null;
  raw_storage_provider: string | null;
  input_type: string | null;
  source_kind: SourceKind | string | null;
};

export type ParsedRecord = {
  rowNumber: number;
  raw: Record<string, unknown>;
  text: string;
};

export type NormalizedLead = {
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string | null;
  owner: string | null;
  notes: string | null;
  lastContactAt: string | null;
  consent: "ok" | "review" | "do_not_contact";
  estimatedValue: number | null;
  stage: string;
};

export type LeadGroup = {
  dedupeKey: string;
  rows: ParsedRecord[];
  normalized: NormalizedLead;
  matchedContactId: string | null;
};

export type JourneyResult = {
  summary: string;
  stage: string;
  nextStep: string;
  riskFlags: string[];
  events: Array<{
    eventDate: string | null;
    eventType: string;
    source: string | null;
    summary: string;
    confidence: "high" | "medium" | "low";
  }>;
  confidence: "high" | "medium" | "low";
  modelUsed: string | null;
  aiRunId: string | null;
};

export type StagedImportRow = {
  row_number: number;
  raw_record: Record<string, unknown>;
  normalized_record: Record<string, unknown>;
  journey: Record<string, unknown>;
  proposed_action: "create" | "merge" | "skip" | "exclude";
  confidence: "high" | "medium" | "low";
  dedupe_key: string;
  matched_contact_id: string | null;
  review_status: "ready" | "needs_review" | "suppressed";
  problem_reason: string | null;
  suppression_reason: string | null;
};
