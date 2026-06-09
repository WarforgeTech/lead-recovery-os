"use client";

import { useState } from "react";
import Link from "next/link";
import type { WorkspaceOpportunity } from "@/lib/workspace-view";
import { matchesWorkflowFilter, workflowFilters, type WorkflowFilter } from "@/lib/mortgage-workflow";
import { LeadWorkCard } from "@/components/lead-work-card";
import { Card } from "@/components/ui";

// Filters the already-loaded due list entirely in the browser. Clicking a filter
// pill is instant — no navigation, no server round-trip, no data refetch. The
// data is fetched once on the server and passed in as props.
export function DashboardQueue({ items }: Readonly<{ items: WorkspaceOpportunity[] }>) {
  const [filter, setFilter] = useState<WorkflowFilter>("all");
  const filtered = items.filter((item) => matchesWorkflowFilter(item, filter));

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Work this list first</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              These are the people most likely to disappear unless someone follows up today.
            </p>
          </div>
          <Link
            href="/leads"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Search contacts
          </Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {workflowFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              aria-pressed={filter === item.id}
              className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                filter === item.id
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.map((item) => (
        <LeadWorkCard key={item.id} item={item} />
      ))}
      {filtered.length === 0 ? (
        <Card>
          <p className="text-sm text-zinc-500">No contacts match this daily filter right now.</p>
        </Card>
      ) : null}
    </div>
  );
}
