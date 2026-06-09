import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: RouteContext<"/api/imports/[id]/status">) {
  const { id } = await context.params;
  const supabase = await createClient();

  const { data: importRow, error: importError } = await supabase
    .from("imports")
    .select("id, workflow_status, workflow_phase, workflow_percent, workflow_eta_seconds, review_summary, ready_rows, problem_rows, suppressed_rows, error_message")
    .eq("id", id)
    .single();
  if (importError) return NextResponse.json({ error: "Import not found" }, { status: 404 });

  const { data: job } = await supabase
    .from("import_jobs")
    .select("status, phase, percent, eta_seconds, counts, error_message")
    .eq("import_id", id)
    .maybeSingle();

  return NextResponse.json({
    import: importRow,
    job,
    ready: importRow.workflow_status === "ready_for_review",
    failed: importRow.workflow_status === "failed" || job?.status === "failed",
    reviewUrl: `/imports/${id}/review`,
  });
}
