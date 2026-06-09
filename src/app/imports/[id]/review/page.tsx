import { acceptStagedImport } from "@/app/actions";
import { Badge, Card, Shell, Stat } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase-server";

export default async function ImportReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .select("*")
    .eq("id", id)
    .single();
  if (importError) throw importError;

  const { data: rows, error: rowsError } = await supabase
    .from("import_rows")
    .select("*")
    .eq("import_id", id)
    .order("review_status", { ascending: true })
    .order("row_number", { ascending: true });
  if (rowsError) throw rowsError;

  const ready = rows?.filter((row) => row.review_status === "ready") ?? [];
  const needsReview = rows?.filter((row) => row.review_status === "needs_review") ?? [];
  const suppressed = rows?.filter((row) => row.review_status === "suppressed") ?? [];

  const accepted = importRow.workflow_status === "accepted";

  return (
    <Shell title="Review cleaned import">
      {accepted ? (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-emerald-300 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 text-lg leading-none text-emerald-600">✓</span>
            <div>
              <p className="text-sm font-semibold text-emerald-800">Imported — {ready.length} leads are now in your queue</p>
              <p className="mt-1 text-sm leading-6 text-emerald-700">These contacts are live in your workspace.</p>
            </div>
          </div>
          <a
            href="/dashboard"
            className="h-11 shrink-0 whitespace-nowrap rounded-md bg-emerald-600 px-5 text-sm font-semibold leading-[44px] text-white hover:bg-emerald-700"
          >
            View in dashboard
          </a>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span aria-hidden className="mt-0.5 text-lg leading-none text-red-600">⚠</span>
            <div>
              <p className="text-sm font-semibold text-red-800">Not imported yet — {ready.length} ready, 0 in your queue</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                These leads are staged for your review only. Nothing is added to your workspace until you click
                <span className="font-semibold"> Accept import</span> below. If you leave this page now, nothing is saved.
              </p>
            </div>
          </div>
          <form action={acceptStagedImport} className="shrink-0">
            <input type="hidden" name="import_id" value={id} />
            <SubmitButton
              pendingLabel="Adding to your queue…"
              className="h-11 w-full whitespace-nowrap rounded-md bg-red-600 px-5 text-sm font-semibold text-white hover:bg-red-700 sm:w-auto"
            >
              Accept import &amp; add {ready.length} to queue
            </SubmitButton>
          </form>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Ready to work" value={String(ready.length)} note={accepted ? "Now in Today’s Follow-Up Queue." : "Not in your queue until you accept."} />
        <Stat label="Needs review" value={String(needsReview.length)} note="Missing contact info, unclear consent, or ambiguous status." />
        <Stat label="Suppressed" value={String(suppressed.length)} note="Held out for DNC, opt-out, closed, duplicate, or invalid records." />
        <Stat label="Original rows" value={String(importRow.total_rows ?? 0)} note={importRow.source_filename ?? "Uploaded import"} />
      </div>

      {accepted ? null : (
        <Card className="mt-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">Ready to add these to your workspace?</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                This is the final step. Ready leads become active contacts in Today’s queue. Problem and suppressed records
                stay out of the queue; suppressed records are saved for audit and to scrub future imports.
              </p>
            </div>
            <form action={acceptStagedImport}>
              <input type="hidden" name="import_id" value={id} />
              <SubmitButton
                pendingLabel="Adding to your queue…"
                className="h-11 rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700"
              >
                Accept import and start work
              </SubmitButton>
            </form>
          </div>
        </Card>
      )}

      <ReviewSection title="Ready" description="These can become active contacts and queue items after you accept." rows={ready} tone="green" />
      <ReviewSection title="Needs review" description="These stay staged because the worker could not safely queue them." rows={needsReview} tone="yellow" />
      <ReviewSection title="Suppressed" description="These are held out and will not receive drafts or queue items." rows={suppressed} tone="red" />
    </Shell>
  );
}

function ReviewSection({
  title,
  description,
  rows,
  tone,
}: {
  title: string;
  description: string;
  rows: Array<Record<string, unknown>>;
  tone: "green" | "yellow" | "red";
}) {
  return (
    <Card className="mt-6 overflow-hidden">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{title}</h2>
          <p className="mt-1 text-sm text-zinc-600">{description}</p>
        </div>
        <Badge tone={tone}>{rows.length}</Badge>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-[0.12em] text-zinc-500">
            <tr>
              <th className="py-3 pr-4">Contact</th>
              <th className="py-3 pr-4">Source</th>
              <th className="py-3 pr-4">Stage found</th>
              <th className="py-3 pr-4">Action</th>
              <th className="py-3 pr-4">Why</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.slice(0, 20).map((row) => {
              const normalized = row.normalized_record as Record<string, unknown>;
              const journey = row.journey as Record<string, unknown>;
              return (
                <tr key={String(row.id)}>
                  <td className="py-3 pr-4">
                    <div className="font-medium text-zinc-950">{String(normalized.name ?? "Unknown")}</div>
                    <div className="text-xs text-zinc-500">{[normalized.email, normalized.phone].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="py-3 pr-4 text-zinc-600">{String(normalized.source ?? "Imported")}</td>
                  <td className="py-3 pr-4 text-zinc-600">{String(normalized.stage ?? normalized.status ?? "Unclear")}</td>
                  <td className="py-3 pr-4">
                    <Badge tone={row.proposed_action === "exclude" ? "red" : row.proposed_action === "merge" ? "blue" : "green"}>
                      {String(row.proposed_action)}
                    </Badge>
                  </td>
                  <td className="max-w-md py-3 pr-4 text-zinc-600">
                    {String(row.problem_reason ?? row.suppression_reason ?? journey.nextStep ?? journey.summary ?? "Ready for queue")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 20 ? <p className="mt-3 text-sm text-zinc-500">Showing first 20 rows for review speed.</p> : null}
    </Card>
  );
}
