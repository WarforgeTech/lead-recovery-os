import { put } from "@vercel/blob";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportArchiveResult = {
  provider: "vercel_blob" | "supabase" | "none";
  path: string | null;
  url: string | null;
  archivedAt: string | null;
};

export async function archiveImportCsv({
  admin,
  organizationId,
  sourceFilename,
  csvText,
}: {
  admin: SupabaseClient;
  organizationId: string;
  sourceFilename: string;
  csvText: string;
}): Promise<ImportArchiveResult> {
  const safeFilename = sourceFilename.replace(/[^a-z0-9._-]/gi, "-");
  const path = `${organizationId}/${Date.now()}-${safeFilename}`;
  const archivedAt = new Date().toISOString();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(path, csvText, {
        access: "private",
        contentType: "text/csv",
        addRandomSuffix: false,
      });
      return {
        provider: "vercel_blob",
        path: blob.pathname,
        url: blob.url,
        archivedAt,
      };
    } catch {
      // Fall through to Supabase Storage so imports still work without Blob.
    }
  }

  const { error } = await admin.storage.from("raw-imports").upload(path, new Blob([csvText], { type: "text/csv" }), {
    contentType: "text/csv",
    upsert: true,
  });

  if (error) {
    return { provider: "none", path: null, url: null, archivedAt: null };
  }

  return {
    provider: "supabase",
    path,
    url: null,
    archivedAt,
  };
}
