import { get } from "@vercel/blob";
import type { ImportAdmin } from "./admin";
import type { ImportRecord } from "./types";

// Download the archived raw import from Vercel Blob (private), with fallbacks to
// Supabase Storage or a recorded URL. Runs inside a Workflow step (full Node).
export async function downloadRawImport(admin: ImportAdmin, record: ImportRecord) {
  if (record.raw_storage_provider === "vercel_blob" && record.raw_file_path) {
    const result = await get(record.raw_file_path, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) throw new Error("Raw import blob was not found");
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  if (record.raw_storage_provider === "supabase" && record.raw_file_path) {
    const { data, error } = await admin.storage.from("raw-imports").download(record.raw_file_path);
    if (error || !data) throw new Error(error?.message ?? "Raw import storage object was not found");
    return Buffer.from(await data.arrayBuffer());
  }

  if (record.raw_file_url) {
    const response = await fetch(record.raw_file_url);
    if (!response.ok) throw new Error(`Raw import URL fetch failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Import has no raw file archive");
}
