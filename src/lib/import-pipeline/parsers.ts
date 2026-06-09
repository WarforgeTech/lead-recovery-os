import Papa from "papaparse";
import readXlsxFile from "read-excel-file/node";
import mammoth from "mammoth";
import { extractText } from "unpdf";
import type { ParsedRecord } from "./types";

export async function parseImportBuffer(buffer: Buffer, filename: string, inputType?: string | null): Promise<ParsedRecord[]> {
  const extension = extensionFor(filename, inputType);

  if (["csv", "tsv", "psv"].includes(extension)) return parseDelimited(buffer.toString("utf8"), extension);
  if (extension === "xlsx") return parseWorkbook(buffer);
  if (extension === "xls") {
    const text = buffer.toString("utf8");
    if (looksDelimited(text)) return parseDelimited(text, "csv");
    throw new Error("Legacy binary .xls files are not supported yet. Export as .xlsx, CSV, or TSV.");
  }
  if (extension === "json") return parseJson(buffer.toString("utf8"));
  if (extension === "vcf") return parseVcf(buffer.toString("utf8"));
  if (extension === "docx") return parseDocx(buffer);
  if (extension === "pdf") return parsePdf(buffer);
  if (extension === "txt") return parseFreeText(buffer.toString("utf8"));

  const text = buffer.toString("utf8");
  if (looksDelimited(text)) return parseDelimited(text, "csv");
  return parseFreeText(text);
}

function extensionFor(filename: string, inputType?: string | null) {
  if (inputType && inputType !== "text") return inputType.replace(/^\./, "").toLowerCase();
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "txt";
}

function parseDelimited(text: string, extension: string): ParsedRecord[] {
  const delimiter = extension === "tsv" ? "\t" : extension === "psv" ? "|" : undefined;
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    delimiter,
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(parsed.errors[0]?.message ?? "Delimited parse failed");
  }

  return parsed.data.map((row, index) => ({
    rowNumber: index + 1,
    raw: row,
    text: Object.values(row).filter(Boolean).join(" | "),
  }));
}

async function parseWorkbook(buffer: Buffer): Promise<ParsedRecord[]> {
  const rows = (await readXlsxFile(buffer)) as unknown as unknown[][];
  const [headersRaw, ...body] = rows;
  const headers = headersRaw?.map((value, index) => String(value || `Column ${index + 1}`).trim()) ?? [];
  return body.map((cells, index) => {
    const raw: Record<string, unknown> = {};
    cells.forEach((cell, cellIndex) => {
      raw[headers[cellIndex] || `Column ${cellIndex + 1}`] = cell instanceof Date ? cell.toISOString().slice(0, 10) : cell ?? "";
    });
    return {
      rowNumber: index + 1,
      raw,
      text: Object.values(raw).filter(Boolean).join(" | "),
    };
  });
}

function parseJson(text: string): ParsedRecord[] {
  const data = JSON.parse(text) as unknown;
  const rows = Array.isArray(data) ? data : Array.isArray((data as { contacts?: unknown[] }).contacts) ? (data as { contacts: unknown[] }).contacts : [data];
  return rows.map((row, index) => {
    const raw = isRecord(row) ? row : { value: row };
    return {
      rowNumber: index + 1,
      raw,
      text: JSON.stringify(raw),
    };
  });
}

function parseVcf(text: string): ParsedRecord[] {
  const cards = text.split(/BEGIN:VCARD/i).map((card) => card.trim()).filter(Boolean);
  return cards.map((card, index) => {
    const raw: Record<string, string> = {};
    for (const line of card.split(/\r?\n/)) {
      const [key, ...rest] = line.split(":");
      if (!key || !rest.length) continue;
      const normalizedKey = key.split(";")[0].toLowerCase();
      raw[normalizedKey] = rest.join(":").trim();
    }
    return {
      rowNumber: index + 1,
      raw: {
        name: raw.fn || raw.n,
        email: raw.email,
        phone: raw.tel,
        notes: raw.note,
        source: "VCF import",
      },
      text: card,
    };
  });
}

async function parseDocx(buffer: Buffer): Promise<ParsedRecord[]> {
  const result = await mammoth.extractRawText({ buffer });
  return parseFreeText(result.value);
}

async function parsePdf(buffer: Buffer): Promise<ParsedRecord[]> {
  // unpdf is dependency-light and serverless-friendly (no native bindings),
  // unlike pdf-parse. mergePages returns the full document text as one string.
  const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });
  return parseFreeText(text);
}

function parseFreeText(text: string): ParsedRecord[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const source = paragraphs.length > 1 ? paragraphs : lines.length > 1 ? lines : paragraphs.length ? paragraphs : [];

  return source.map((chunk, index) => ({
    rowNumber: index + 1,
    raw: { notes: chunk },
    text: chunk,
  }));
}

function looksDelimited(text: string) {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join("\n");
  return /email|phone|name|status|source/i.test(firstLines) && (firstLines.includes(",") || firstLines.includes("\t") || firstLines.includes("|"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
