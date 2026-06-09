"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type ImportStatusResponse = {
  import?: {
    workflow_status: string;
    workflow_phase: string | null;
    workflow_percent: number;
    workflow_eta_seconds: number | null;
    ready_rows: number;
    problem_rows: number;
    suppressed_rows: number;
    error_message: string | null;
  };
  job?: {
    status: string;
    phase: string;
    percent: number;
    eta_seconds: number | null;
    counts: Record<string, unknown>;
    error_message: string | null;
  } | null;
  ready: boolean;
  failed: boolean;
  reviewUrl: string;
};

const phases = [
  ["queued", "Queued", "Waiting for the import workflow to pick up the file."],
  ["archived", "Archived", "Raw file archived privately for audit and reprocessing."],
  ["reading_file", "Reading file", "Finding rows, text, sheets, and source format."],
  ["parsing", "Parsing", "Extracting structured rows from the uploaded data."],
  ["normalizing", "Normalizing", "Cleaning names, phones, emails, dates, statuses, and notes."],
  ["deduping", "Removing duplicates", "Grouping repeated records into one lead journey."],
  ["scrubbing_exclusions", "Scrubbing exclusions", "Holding do-not-contact, opt-out, closed, and invalid records out of the queue."],
  ["ai_reconstructing", "Reconstructing journeys", "Using AI only where messy notes need context."],
  ["preparing_review", "Preparing review", "Building ready, problem, and suppressed lists."],
  ["ready_for_review", "Ready for review", "The cleaned import is ready for human approval."],
];

export function ImportProgress({ importId }: { importId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<ImportStatusResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const response = await fetch(`/api/imports/${importId}/status`, { cache: "no-store" });
        const result = await response.json() as ImportStatusResponse;
        if (cancelled) return;
        if (!response.ok) throw new Error("Could not load import status");
        setStatus(result);
        if (result.ready) {
          setTimeout(() => router.push(result.reviewUrl), 900);
          return;
        }
        if (!result.failed) setTimeout(poll, 1500);
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "Could not load import status");
          setTimeout(poll, 3000);
        }
      }
    }
    void poll();
    return () => {
      cancelled = true;
    };
  }, [importId, router]);

  const phase = status?.job?.phase ?? status?.import?.workflow_phase ?? "queued";
  const percent = status?.job?.percent ?? status?.import?.workflow_percent ?? 0;
  const eta = status?.job?.eta_seconds ?? status?.import?.workflow_eta_seconds ?? null;

  return (
    <div className="space-y-6">
      <div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full rounded-full bg-zinc-950 transition-all" style={{ width: `${Math.max(3, Math.min(100, percent))}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-sm text-zinc-600">
          <span>{percent}% complete</span>
          <span>{eta ? `About ${eta} seconds left` : "Estimating time"}</span>
        </div>
      </div>

      <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
        {phases.map(([id, label, description]) => {
          const currentIndex = phases.findIndex(([item]) => item === phase);
          const itemIndex = phases.findIndex(([item]) => item === id);
          const complete = itemIndex < currentIndex || phase === "ready_for_review";
          const active = id === phase && phase !== "ready_for_review";
          return (
            <div key={id} className="flex items-start gap-3 p-4">
              <div className={`mt-0.5 flex size-5 items-center justify-center rounded-full border text-xs ${complete ? "border-emerald-500 bg-emerald-500 text-white" : active ? "border-zinc-950" : "border-zinc-300 text-zinc-400"}`}>
                {complete ? "✓" : active ? <span className="size-2 animate-pulse rounded-full bg-zinc-950" /> : ""}
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-950">{label}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-600">{description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {status?.failed ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-800">
          Import failed: {status.job?.error_message ?? status.import?.error_message ?? "Unknown error"}
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
