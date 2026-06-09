import { redirect } from "next/navigation";
import { Card, PrimaryLink, Shell } from "@/components/ui";
import { ImportsList, type ImportRow } from "@/components/imports-list";
import { getActiveOrganizationId, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/onboarding/profile");
  const supabase = await createClient();
  const { data: imports, error } = await supabase
    .from("imports")
    .select("id, source_filename, source_kind, workflow_status, workflow_percent, workflow_eta_seconds, ready_rows, problem_rows, suppressed_rows, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <Shell title="Imports" actions={<PrimaryLink href="/imports/new">Import leads</PrimaryLink>}>
      <p className="mb-4 text-sm leading-6 text-zinc-600">
        Each file shows live status — <span className="font-medium text-zinc-900">Importing</span> while it’s being
        cleaned, <span className="font-medium text-amber-800">Ready to review</span> when it needs your approval, and
        a green <span className="font-medium text-emerald-700">✓ Imported</span> once its leads are in Today’s queue.
      </p>
      <Card>
        {/* Client component: polls each working import so the cells update live. */}
        <ImportsList imports={(imports ?? []) as ImportRow[]} />
      </Card>
    </Shell>
  );
}
