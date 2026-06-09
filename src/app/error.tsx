"use client";

import { useEffect } from "react";

// Root error boundary: keeps a failed Server Component render (e.g. a transient
// Supabase error) from crashing to a blank page mid-demo, and gives the user a
// one-click retry that re-runs the server render.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-950">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          We hit a temporary error loading this view. Your data is safe — try again.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium leading-10 text-zinc-700 hover:bg-zinc-50"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
