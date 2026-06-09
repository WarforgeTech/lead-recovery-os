import { createImportAdmin, numberEnv, type ImportAdmin } from "./admin";
import { downloadRawImport } from "./blob";
import { reconstructJourney } from "./reconstruct-journey";
import { identityKey, normalizeRecord, problemReason, suppressionReason } from "./normalize";
import { parseImportBuffer } from "./parsers";
import type { ImportRecord, LeadGroup, NormalizedLead, ParsedRecord, SourceKind, StagedImportRow } from "./types";

export type ImportRefs = { importId: string; jobId: string; organizationId: string };

type ParsePhaseResult = {
  records: ParsedRecord[];
  sourceKind: SourceKind;
  parsedCount: number;
  limitedCount: number;
};

type ExistingContact = { id: string; name: string; email: string | null; phone: string | null };
type ExistingExclusion = { email: string | null; phone: string | null; normalized_name: string | null; reason: string; kind: string };

// ---- Phase 1: download + parse -------------------------------------------------
// Returns serializable parsed records so the workflow can hand them to phase 2.
export async function parseImportWork(refs: ImportRefs): Promise<ParsePhaseResult> {
  const admin = createImportAdmin();
  try {
    await setProgress(admin, refs.jobId, "processing", "reading_file", 8, 180);
    const importRecord = await loadImport(admin, refs.importId);
    const sourceKind = normalizeSourceKind(importRecord.source_kind);
    const raw = await downloadRawImport(admin, importRecord);
    const maxBytes = numberEnv("IMPORT_MAX_BYTES", 10_000_000);
    if (raw.byteLength > maxBytes) throw new Error(`Import exceeds limit of ${maxBytes} bytes`);

    await setProgress(admin, refs.jobId, "processing", "parsing", 18, 150);
    const parsed = await parseImportBuffer(raw, importRecord.source_filename ?? "import.txt", importRecord.input_type);
    const limit = numberEnv("FREE_IMPORT_ROW_LIMIT", 5000);
    const records = parsed.slice(0, limit);

    await setProgress(admin, refs.jobId, "processing", "normalizing", 34, 120, { total: parsed.length, limited: records.length });
    return { records, sourceKind, parsedCount: parsed.length, limitedCount: records.length };
  } catch (error) {
    await markFailed(admin, refs.jobId, error);
    throw error;
  }
}

// ---- Phase 2: normalize, dedupe, AI reconstruct, stage, finalize ---------------
export async function analyzeAndStageWork(refs: ImportRefs, phase: ParsePhaseResult): Promise<void> {
  const admin = createImportAdmin();
  try {
    const normalized = phase.records.map((row) => ({ row, lead: normalizeRecord(row, phase.sourceKind) }));

    const [contacts, exclusions] = await Promise.all([
      loadExistingContacts(admin, refs.organizationId),
      loadExistingExclusions(admin, refs.organizationId),
    ]);

    await setProgress(admin, refs.jobId, "processing", "deduping", 48, 90, { total: phase.parsedCount });
    const groups = groupLeads(normalized, contacts);

    await setProgress(admin, refs.jobId, "processing", "scrubbing_exclusions", 62, 70, { groups: groups.length });
    const stagedRows: StagedImportRow[] = [];

    await setProgress(admin, refs.jobId, "processing", "ai_reconstructing", 75, 45, { groups: groups.length });
    for (const [index, group] of groups.entries()) {
      const journey = await reconstructJourney({ admin, organizationId: refs.organizationId, importId: refs.importId, group });
      stagedRows.push(classifyGroup(group, journey as unknown as Record<string, unknown>, phase.sourceKind, exclusions, index + 1));
      if (index > 0 && index % 25 === 0) {
        const percent = Math.min(90, 75 + Math.round((index / groups.length) * 15));
        await setProgress(admin, refs.jobId, "processing", "ai_reconstructing", percent, Math.max(10, groups.length - index));
      }
    }

    const counts = countsFor(stagedRows);
    await setProgress(admin, refs.jobId, "processing", "preparing_review", 94, 10, counts);
    await admin.from("import_rows").delete().eq("import_id", refs.importId);
    for (const chunk of chunks(stagedRows, 500)) {
      const { error } = await admin.from("import_rows").insert(
        chunk.map((row) => ({ import_id: refs.importId, organization_id: refs.organizationId, ...row })),
      );
      if (error) throw error;
    }

    const { error: importError } = await admin
      .from("imports")
      .update({
        status: "processed",
        workflow_status: "ready_for_review",
        workflow_phase: "ready_for_review",
        workflow_percent: 100,
        total_rows: phase.parsedCount,
        processed_rows: stagedRows.length,
        duplicate_rows: Math.max(0, phase.limitedCount - groups.length),
        held_for_review_rows: counts.needs_review,
        ready_rows: counts.ready,
        problem_rows: counts.needs_review,
        suppressed_rows: counts.suppressed,
        merged_rows: counts.merge,
        priority_opportunities: counts.ready,
        review_summary: counts,
        parser_version: "vercel-workflow-v1",
        ai_pipeline_version: "journey-v1",
        ai_model: "anthropic/claude-sonnet-4.6",
        processed_at: new Date().toISOString(),
      })
      .eq("id", refs.importId);
    if (importError) throw importError;

    await setProgress(admin, refs.jobId, "ready_for_review", "ready_for_review", 100, null, counts);
  } catch (error) {
    await markFailed(admin, refs.jobId, error);
    throw error;
  }
}

// ---- Pure helpers (also reused by the eval harness) ----------------------------

export function groupLeads(
  rows: Array<{ row: ParsedRecord; lead: NormalizedLead }>,
  contacts: ExistingContact[],
): LeadGroup[] {
  const existingByEmail = new Map(contacts.filter((c) => c.email).map((c) => [c.email, c.id]));
  const existingByPhone = new Map(contacts.filter((c) => c.phone).map((c) => [c.phone, c.id]));
  const grouped = new Map<string, LeadGroup>();

  for (const item of rows) {
    const key = identityKey(item.lead);
    const current = grouped.get(key);
    const matchedContactId = item.lead.email
      ? existingByEmail.get(item.lead.email) ?? null
      : item.lead.phone
        ? existingByPhone.get(item.lead.phone) ?? null
        : null;
    if (current) {
      current.rows.push(item.row);
      current.normalized = mergeLead(current.normalized, item.lead);
      current.matchedContactId = current.matchedContactId ?? matchedContactId;
    } else {
      grouped.set(key, { dedupeKey: key, rows: [item.row], normalized: item.lead, matchedContactId });
    }
  }

  return Array.from(grouped.values());
}

export function classifyGroup(
  group: LeadGroup,
  journey: Record<string, unknown>,
  sourceKind: SourceKind,
  exclusions: ExistingExclusion[],
  rowNumber: number,
): StagedImportRow {
  const lead = group.normalized;
  const sourceSuppression = suppressionReason(lead, sourceKind);
  const existingSuppression = matchingExclusion(lead, exclusions);
  const problem = problemReason(lead);
  const suppression = sourceSuppression ?? existingSuppression;

  const review_status: StagedImportRow["review_status"] = suppression ? "suppressed" : problem ? "needs_review" : "ready";
  const proposed_action: StagedImportRow["proposed_action"] = suppression ? "exclude" : group.matchedContactId ? "merge" : "create";

  return {
    row_number: rowNumber,
    raw_record: { rows: group.rows.map((row) => ({ rowNumber: row.rowNumber, raw: row.raw, text: row.text })) },
    normalized_record: { ...lead, sourceKind },
    journey,
    proposed_action,
    confidence: review_status === "ready" && group.rows.length > 1 ? "medium" : review_status === "ready" ? "high" : "medium",
    dedupe_key: group.dedupeKey,
    matched_contact_id: group.matchedContactId,
    review_status,
    problem_reason: problem,
    suppression_reason: suppression,
  };
}

export function normalizeSourceKind(value: string | null | undefined): SourceKind {
  if (value === "closed_leads" || value === "do_not_contact" || value === "mixed") return value;
  return "lead_file";
}

function mergeLead(a: NormalizedLead, b: NormalizedLead): NormalizedLead {
  return {
    ...a,
    name: better(a.name, b.name),
    email: a.email ?? b.email,
    phone: a.phone ?? b.phone,
    source: a.source ?? b.source,
    status: b.status ?? a.status,
    owner: a.owner ?? b.owner,
    notes: [a.notes, b.notes].filter(Boolean).join("\n") || null,
    lastContactAt: latestDate(a.lastContactAt, b.lastContactAt),
    consent: a.consent === "do_not_contact" || b.consent === "do_not_contact" ? "do_not_contact" : a.consent === "ok" || b.consent === "ok" ? "ok" : "review",
    estimatedValue: a.estimatedValue ?? b.estimatedValue,
    stage: b.stage || a.stage,
  };
}

function matchingExclusion(lead: NormalizedLead, exclusions: ExistingExclusion[]) {
  const normalizedName = lead.name.toLowerCase();
  const match = exclusions.find((exclusion) => {
    if (lead.email && exclusion.email === lead.email) return true;
    if (lead.phone && exclusion.phone === lead.phone) return true;
    return Boolean(exclusion.normalized_name && exclusion.normalized_name === normalizedName);
  });
  return match ? match.reason || match.kind : null;
}

async function loadImport(admin: ImportAdmin, importId: string): Promise<ImportRecord> {
  const { data, error } = await admin.from("imports").select("*").eq("id", importId).single();
  if (error || !data) throw new Error(error?.message ?? "Import not found");
  return data as ImportRecord;
}

async function loadExistingContacts(admin: ImportAdmin, organizationId: string): Promise<ExistingContact[]> {
  const { data, error } = await admin.from("contacts").select("id, name, email, phone").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []) as ExistingContact[];
}

async function loadExistingExclusions(admin: ImportAdmin, organizationId: string): Promise<ExistingExclusion[]> {
  const { data, error } = await admin.from("contact_exclusions").select("email, phone, normalized_name, reason, kind").eq("organization_id", organizationId);
  if (error) throw error;
  return (data ?? []) as ExistingExclusion[];
}

async function setProgress(
  admin: ImportAdmin,
  jobId: string,
  status: string,
  phase: string,
  percent: number,
  etaSeconds?: number | null,
  counts: Record<string, unknown> = {},
  errorMessage?: string | null,
) {
  const { error } = await admin.rpc("set_import_job_progress", {
    p_job_id: jobId,
    p_status: status,
    p_phase: phase,
    p_percent: percent,
    p_eta_seconds: etaSeconds ?? null,
    p_counts: counts,
    p_error_message: errorMessage ?? null,
  });
  if (error) throw error;
}

async function markFailed(admin: ImportAdmin, jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  try {
    await setProgress(admin, jobId, "failed", "failed", 100, null, {}, message);
  } catch {
    // best-effort: don't mask the original error
  }
}

function countsFor(rows: StagedImportRow[]) {
  return {
    ready: rows.filter((row) => row.review_status === "ready").length,
    needs_review: rows.filter((row) => row.review_status === "needs_review").length,
    suppressed: rows.filter((row) => row.review_status === "suppressed").length,
    create: rows.filter((row) => row.proposed_action === "create").length,
    merge: rows.filter((row) => row.proposed_action === "merge").length,
    exclude: rows.filter((row) => row.proposed_action === "exclude").length,
  };
}

function chunks<T>(items: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) output.push(items.slice(index, index + size));
  return output;
}

function better(a: string, b: string) {
  if (/^imported lead/i.test(a)) return b;
  if (/^imported lead/i.test(b)) return a;
  return a.length >= b.length ? a : b;
}

function latestDate(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
