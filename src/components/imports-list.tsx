"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

export type ImportRow = {
  id: string;
  source_filename: string | null;
  source_kind: string | null;
  workflow_status: string;
  workflow_percent: number | null;
  workflow_eta_seconds: number | null;
  ready_rows: number | null;
  problem_rows: number | null;
  suppressed_rows: number | null;
  created_at: string;
};

type Live = {
  workflow_status: string;
  percent: number;
  eta: number | null;
  ready_rows: number;
  problem_rows: number;
  suppressed_rows: number;
  error: string | null;
};

// Only these statuses mean the workflow is actively crunching the file — those
// are the ones we poll. Everything else is settled: ready_for_review waits on the
// human; accepted/failed are terminal; "processed" is seeded/legacy demo data
// that's already live. (Treating those as settled avoids an infinite spinner.)
function isWorking(status: string) {
  return ["queued", "archived", "processing"].includes(status);
}

function toLive(item: ImportRow): Live {
  return {
    workflow_status: item.workflow_status,
    percent: item.workflow_percent ?? 0,
    eta: item.workflow_eta_seconds ?? null,
    ready_rows: item.ready_rows ?? 0,
    problem_rows: item.problem_rows ?? 0,
    suppressed_rows: item.suppressed_rows ?? 0,
    error: null,
  };
}

function formatEta(eta: number | null) {
  if (eta == null || eta <= 0) return null;
  if (eta >= 60) return `~${Math.ceil(eta / 60)} min left`;
  return `~${Math.ceil(eta)} sec left`;
}

// Live view of an organization's imports. Each cell self-updates by polling the
// per-import status endpoint until it settles, so the user can watch each file
// go from "Importing" (spinner + ETA) → "Ready to review" → "Imported" (✓)
// without refreshing.
export function ImportsList({ imports }: { imports: ImportRow[] }) {
  const [live, setLive] = useState<Record<string, Live>>(() =>
    Object.fromEntries(imports.map((item) => [item.id, toLive(item)])),
  );

  useEffect(() => {
    let cancelled = false;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    async function poll(id: string) {
      try {
        const res = await fetch(`/api/imports/${id}/status`, { cache: "no-store" });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as {
          import?: Partial<ImportRow> & { error_message?: string | null };
          job?: { eta_seconds: number | null; error_message: string | null } | null;
        };
        const imp = data.import;
        if (!imp) return;
        setLive((prev) => ({
          ...prev,
          [id]: {
            workflow_status: imp.workflow_status ?? "queued",
            percent: imp.workflow_percent ?? 0,
            eta: imp.workflow_eta_seconds ?? data.job?.eta_seconds ?? null,
            ready_rows: imp.ready_rows ?? 0,
            problem_rows: imp.problem_rows ?? 0,
            suppressed_rows: imp.suppressed_rows ?? 0,
            error: imp.error_message ?? data.job?.error_message ?? null,
          },
        }));
        if (isWorking(imp.workflow_status ?? "queued")) timers.push(setTimeout(() => poll(id), 2000));
      } catch {
        if (!cancelled) timers.push(setTimeout(() => poll(id), 4000));
      }
    }

    imports.forEach((item) => {
      if (isWorking(item.workflow_status)) void poll(item.id);
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [imports]);

  if (imports.length === 0) {
    return <p className="py-8 text-sm text-zinc-600">No imports yet. Start by uploading or pasting inactive leads.</p>;
  }

  return (
    <div className="divide-y divide-zinc-100">
      {imports.map((item) => {
        const status = live[item.id] ?? toLive(item);
        return (
          <Link
            key={item.id}
            href={`/imports/${item.id}`}
            className="grid items-center gap-2 py-4 hover:bg-zinc-50 md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="font-medium text-zinc-950">{item.source_filename ?? "Untitled import"}</div>
              <div className="mt-1 text-sm text-zinc-600">
                {item.source_kind} · {formatDateTime(item.created_at)}
              </div>
            </div>
            <StatusCell status={status} />
          </Link>
        );
      })}
    </div>
  );
}

function StatusCell({ status }: { status: Live }) {
  if (status.workflow_status === "failed") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-800">
        <span aria-hidden>⚠</span> Import failed
      </span>
    );
  }

  if (status.workflow_status === "ready_for_review") {
    return (
      <div className="text-right">
        <span className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-900">
          Ready to review →
        </span>
        <div className="mt-1 text-xs text-zinc-500">
          {status.ready_rows} ready · {status.problem_rows} review · {status.suppressed_rows} suppressed
        </div>
      </div>
    );
  }

  // Actively working: spinner + "Importing" + percent and (if known) ETA.
  if (isWorking(status.workflow_status)) {
    const eta = formatEta(status.eta);
    return (
      <div className="text-right">
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700">
          <Spinner /> Importing
        </span>
        <div className="mt-1 text-xs text-zinc-500">
          {Math.max(1, Math.min(100, status.percent))}%{eta ? ` · ${eta}` : ""}
        </div>
      </div>
    );
  }

  // Settled and live: accepted, or seeded/legacy "processed" demo data.
  return (
    <div className="text-right">
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800">
        <CheckIcon /> Imported
      </span>
      <div className="mt-1 text-xs text-zinc-500">
        {status.ready_rows} in queue · {status.suppressed_rows} suppressed
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z" clipRule="evenodd" />
    </svg>
  );
}
