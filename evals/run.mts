/**
 * Lightweight eval suite for the import pipeline. Two checks, one command:
 *   1. Parser fixtures   — every supported file format parses to >= N rows of text.
 *   2. Journey regression — the deterministic journey reconstruction lands the
 *      right stage, preserves required context, and never invents outcomes
 *      (a hallucination regression guard for the AI step's fallback contract).
 *
 * Run with: npm run eval  (also: npm run eval:parsers / npm run eval:ai)
 * Exits non-zero on any failure so it can gate CI.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseImportBuffer } from "../src/lib/import-pipeline/parsers";
import { fallbackJourney } from "../src/lib/import-pipeline/reconstruct-journey";
import { identityKey, normalizeRecord } from "../src/lib/import-pipeline/normalize";
import type { LeadGroup, ParsedRecord } from "../src/lib/import-pipeline/types";

const root = process.cwd();
const only = process.argv[2]; // "parsers" | "ai" | undefined (both)

type Row = { name: string; ok: boolean; detail: string };
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

function printSection(title: string, rows: Row[]) {
  console.log(`\n${title}`);
  for (const row of rows) {
    const tag = row.ok ? green("PASS") : red("FAIL");
    console.log(`  ${tag}  ${row.name.padEnd(34)} ${row.detail}`);
  }
}

async function runParserFixtures(): Promise<Row[]> {
  const fixtures: Array<[string, number]> = [
    ["messy-crm.csv", 5],
    ["messy-notes.txt", 4],
    ["repeat-import.csv", 2],
    ["suppression.csv", 3],
    ["contacts.json", 1],
    ["contact.vcf", 1],
  ];
  const rows: Row[] = [];
  for (const [filename, minimumRows] of fixtures) {
    const buffer = await readFile(path.resolve(root, "evals/fixtures", filename));
    const parsed = await parseImportBuffer(buffer, filename);
    const hasText = parsed.every((r) => r.text.trim());
    const ok = parsed.length >= minimumRows && hasText;
    rows.push({
      name: filename,
      ok,
      detail: ok ? `${parsed.length} rows (>=${minimumRows})` : `got ${parsed.length} rows (>=${minimumRows}), text:${hasText}`,
    });
  }
  return rows;
}

type EvalCase = {
  id: string;
  inputRows: string[];
  expected: { stage: string; mustMention: string[]; mustNotInvent: string[] };
};

async function runJourneyRegression(): Promise<Row[]> {
  const cases = JSON.parse(await readFile(path.resolve(root, "evals/import-journey-regression.json"), "utf8")) as EvalCase[];
  const rows: Row[] = [];
  for (const item of cases) {
    const parsedRows: ParsedRecord[] = item.inputRows.map((text, index) => ({ rowNumber: index + 1, raw: { notes: text }, text }));
    const leads = parsedRows.map((row) => normalizeRecord(row, "lead_file"));
    const group: LeadGroup = {
      dedupeKey: identityKey(leads[0]),
      rows: parsedRows,
      normalized: leads.reduce((current, next) => ({
        ...current,
        email: current.email ?? next.email,
        phone: current.phone ?? next.phone,
        notes: [current.notes, next.notes].filter(Boolean).join("\n"),
        stage: next.stage || current.stage,
        consent: current.consent === "do_not_contact" || next.consent === "do_not_contact" ? "do_not_contact" : current.consent,
      })),
      matchedContactId: null,
    };
    const result = fallbackJourney(group);
    const haystack = `${result.stage} ${result.summary} ${result.nextStep} ${result.riskFlags.join(" ")}`.toLowerCase();

    const problems: string[] = [];
    if (result.stage !== item.expected.stage) problems.push(`stage=${result.stage}≠${item.expected.stage}`);
    for (const phrase of item.expected.mustMention) if (!haystack.includes(phrase.toLowerCase())) problems.push(`missing "${phrase}"`);
    for (const phrase of item.expected.mustNotInvent) if (haystack.includes(phrase.toLowerCase())) problems.push(`hallucinated "${phrase}"`);

    rows.push({ name: item.id, ok: problems.length === 0, detail: problems.length ? problems.join(", ") : `stage=${result.stage}` });
  }
  return rows;
}

const sections: Array<[string, Row[]]> = [];
if (only !== "ai") sections.push(["Parser fixtures (format coverage)", await runParserFixtures()]);
if (only !== "parsers") sections.push(["Journey regression (stage + hallucination guard)", await runJourneyRegression()]);

console.log("Pipeline Recovery OS — import eval suite");
let passed = 0;
let total = 0;
for (const [title, rows] of sections) {
  printSection(title, rows);
  passed += rows.filter((r) => r.ok).length;
  total += rows.length;
}

const allPass = passed === total;
console.log(`\n${allPass ? green("✓") : red("✗")} ${passed}/${total} checks passed\n`);
process.exit(allPass ? 0 : 1);
