import Link from "next/link";
import { Card, PrimaryLink, Shell } from "@/components/ui";
import { getActiveOrganizationId, requireUser } from "@/lib/data";
import { createClient } from "@/lib/supabase-server";
import { formatDateTime } from "@/lib/format";
import { redirect } from "next/navigation";

export default async function ImportsPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/onboarding/profile");
  const supabase = await createClient();
  const { data: imports, error } = await supabase
    .from("imports")
    .select("id, source_filename, source_kind, workflow_status, workflow_percent, ready_rows, problem_rows, suppressed_rows, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <Shell title="Imports" actions={<PrimaryLink href="/imports/new">Import leads</PrimaryLink>}>
      <Card>
        <div className="divide-y divide-zinc-100">
          {(imports ?? []).map((item) => (
            <Link key={item.id} href={`/imports/${item.id}`} className="grid gap-2 py-4 hover:bg-zinc-50 md:grid-cols-[1fr_auto]">
              <div>
                <div className="font-medium text-zinc-950">{item.source_filename ?? "Untitled import"}</div>
                <div className="mt-1 text-sm text-zinc-600">
                  {item.source_kind} · {item.workflow_status} · {formatDateTime(item.created_at)}
                </div>
              </div>
              <div className="text-sm text-zinc-600">
                {item.ready_rows} ready · {item.problem_rows} review · {item.suppressed_rows} suppressed
              </div>
            </Link>
          ))}
          {imports?.length ? null : <p className="py-8 text-sm text-zinc-600">No imports yet. Start by uploading or pasting inactive leads.</p>}
        </div>
      </Card>
    </Shell>
  );
}
