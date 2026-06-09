import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { start } from "workflow/api";
import { archiveImportContent } from "@/lib/import-archive";
import { createAdminClient, getUser } from "@/lib/supabase-server";
import { importWorkflow } from "@/workflows/import-workflow";
import { traceAsync } from "@/lib/tracing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const sourceKind = normalizeSourceKind(String(formData.get("source_kind") ?? "lead_file"));
  const organizationId = String(formData.get("organization_id") ?? "");
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");
  const admin = createAdminClient();
  const organization = await writableOrganization(admin, user.id, user.email, organizationId);
  if (!organization) return NextResponse.json({ error: "No writable workspace found" }, { status: 403 });

  const payload = await importPayload(file, text);
  if (!payload) return NextResponse.json({ error: "Upload a file or paste lead data first." }, { status: 400 });

  const created = await traceAsync("import.enqueue", { source_kind: sourceKind, input_type: payload.inputType }, async () => {
    const { data: importRow, error: importError } = await admin
      .from("imports")
      .insert({
        organization_id: organization.organization_id,
        uploaded_by: user.id,
        source_filename: payload.filename,
        status: "uploaded",
        workflow_status: "queued",
        workflow_phase: "queued",
        workflow_percent: 0,
        input_type: payload.inputType,
        source_kind: sourceKind,
        raw_hash: crypto.createHash("sha256").update(payload.body).digest("hex"),
        idempotency_key: `${organization.organization_id}:${Date.now()}:${payload.filename}`,
        mapping: { source_kind: sourceKind, self_serve: true },
      })
      .select()
      .single();
    if (importError) throw importError;

    const archive = await archiveImportContent({
      admin,
      organizationId: organization.organization_id,
      importId: importRow.id,
      sourceFilename: payload.filename,
      body: payload.body,
      contentType: payload.contentType,
    });

    const { error: updateError } = await admin
      .from("imports")
      .update({
        raw_file_path: archive.path,
        raw_storage_provider: archive.provider,
        raw_file_url: archive.url,
        archived_at: archive.archivedAt,
        workflow_status: "archived",
        workflow_phase: "archived",
        workflow_percent: 3,
      })
      .eq("id", importRow.id);
    if (updateError) throw updateError;

    const { data: jobRow, error: jobError } = await admin
      .from("import_jobs")
      .insert({
        import_id: importRow.id,
        organization_id: organization.organization_id,
        status: "queued",
        phase: "queued",
        percent: 3,
        eta_seconds: 180,
        counts: { source_kind: sourceKind },
      })
      .select("id")
      .single();
    if (jobError) throw jobError;

    // Trigger the durable Vercel Workflow. start() returns immediately; the
    // workflow runs asynchronously and survives disconnects/restarts. This
    // replaces the former Railway polling worker.
    await start(importWorkflow, [
      {
        importId: importRow.id,
        jobId: jobRow.id,
        organizationId: organization.organization_id,
      },
    ]);

    await admin.from("activity_log").insert({
      organization_id: organization.organization_id,
      actor_user_id: user.id,
      event: "self_serve_import_enqueued",
      metadata: {
        import_id: importRow.id,
        source_kind: sourceKind,
        input_type: payload.inputType,
        archive_provider: archive.provider,
      },
    });

    return importRow;
  });

  return NextResponse.json({ importId: created.id, redirectTo: `/imports/${created.id}/processing` });
}

async function writableOrganization(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  email: string,
  preferredOrganizationId: string,
) {
  let query = admin
    .from("organization_members")
    .select("organization_id, role")
    .in("role", ["owner", "admin"])
    .order("created_at", { ascending: true });

  if (preferredOrganizationId) query = query.eq("organization_id", preferredOrganizationId);

  const { data, error } = await query.or(`user_id.eq.${userId},email.eq.${email.toLowerCase()}`);
  if (error) throw error;
  return data?.[0] ?? null;
}

async function importPayload(file: FormDataEntryValue | null, text: string) {
  if (file instanceof File && file.size > 0) {
    const body = Buffer.from(await file.arrayBuffer());
    return {
      body,
      filename: file.name || "lead-file.txt",
      contentType: file.type || "application/octet-stream",
      inputType: inputTypeFromFilename(file.name),
    };
  }

  if (!text) return null;
  return {
    body: text,
    filename: "pasted-leads.txt",
    contentType: "text/plain",
    inputType: "txt",
  };
}

function normalizeSourceKind(value: string) {
  if (value === "closed_leads" || value === "do_not_contact" || value === "mixed") return value;
  return "lead_file";
}

function inputTypeFromFilename(filename: string) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "txt";
}
