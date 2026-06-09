import { analyzeAndStageWork, parseImportWork, type ImportRefs } from "@/lib/import-pipeline/process";

// Durable, Vercel-native replacement for the former Railway import worker.
// Triggered with start(importWorkflow, [refs]) from the upload route. Each step
// has full Node.js access and is independently retried; progress and staged rows
// live in Supabase (source of truth), so the browser's progress view survives
// disconnects, refreshes, and function/instance restarts.

async function parseStep(refs: ImportRefs) {
  "use step";
  return parseImportWork(refs);
}

async function analyzeAndStageStep(refs: ImportRefs, parsed: Awaited<ReturnType<typeof parseImportWork>>) {
  "use step";
  await analyzeAndStageWork(refs, parsed);
}

export async function importWorkflow(refs: ImportRefs) {
  "use workflow";
  const parsed = await parseStep(refs);
  await analyzeAndStageStep(refs, parsed);
  return { importId: refs.importId, status: "ready_for_review" as const };
}
