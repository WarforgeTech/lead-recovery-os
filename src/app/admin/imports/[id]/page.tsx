import Link from "next/link";
import { Badge, Card, Shell, Stat } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase-server";
import { requireAdmin } from "@/lib/data";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const admin = createAdminClient();
  const { data: importRow, error } = await admin
    .from("imports")
    .select("*, organization:organizations(id, name)")
    .eq("id", id)
    .single();
  if (error) throw error;

  return (
    <Shell title="Import summary">
      <div className="mb-5">
        <Link href={`/admin/organizations/${importRow.organization_id}`} className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          Back to {importRow.organization?.name}
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Total rows" value={String(importRow.total_rows)} />
        <Stat label="Processed contacts" value={String(importRow.processed_rows)} />
        <Stat label="Duplicates removed" value={String(importRow.duplicate_rows)} />
        <Stat label="Priority opportunities" value={String(importRow.priority_opportunities)} />
      </div>
      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{importRow.source_filename}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Missing contact rows: {importRow.missing_contact_rows}. Held for consent/source review: {importRow.held_for_review_rows}.
            </p>
          </div>
          <Badge tone={importRow.status === "processed" ? "green" : "neutral"}>{importRow.status}</Badge>
        </div>
        <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <div className="text-sm font-medium text-zinc-700">V1 processing rule</div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Pipeline Recovery OS normalizes, dedupes, segments, and drafts deterministic follow-up. Real outbound sending
            remains outside the product until a client explicitly approves a production integration.
          </p>
        </div>
      </Card>
    </Shell>
  );
}
