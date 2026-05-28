"use client";

import { useActionState } from "react";
import { processDailyDump, type DailyDumpState } from "@/app/actions";

const initialState: DailyDumpState = {
  status: "idle",
  message: "",
  updated: 0,
  unmatched: 0,
};

export function DailyDumpBox({ organizationId }: Readonly<{ organizationId: string }>) {
  const [state, action, pending] = useActionState(processDailyDump, initialState);

  return (
    <form action={action} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <input type="hidden" name="organization_id" value={organizationId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">End-of-day update</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Paste the messy recap. The system will match known contacts, update outcomes, schedule follow-ups, and log anything it cannot match.
          </p>
        </div>
        <button
          disabled={pending}
          className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Updating..." : "Apply updates"}
        </button>
      </div>
      <textarea
        name="daily_dump"
        rows={5}
        placeholder="Example: Taylor did not respond after I sent the application link. Nina replied and needs Adam to call tomorrow. Monica booked a review call. Andre is not ready yet."
        className="mt-4 w-full rounded-md border border-zinc-300 p-3 text-sm leading-6 outline-none focus:border-zinc-900"
      />
      {state.status !== "idle" ? (
        <div className={`mt-3 rounded-md border p-3 text-sm ${state.status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          {state.message}
        </div>
      ) : null}
    </form>
  );
}
