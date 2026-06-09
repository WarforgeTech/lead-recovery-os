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
  return archiveImportContent({
    admin,
    organizationId,
    sourceFilename,
    body: csvText,
    contentType: "text/csv",
  });
}

export async function archiveImportContent({
  admin,
  organizationId,
  sourceFilename,
  body,
  contentType,
  importId,
}: {
  admin: SupabaseClient;
  organizationId: string;
  sourceFilename: string;
  body: string | Buffer;
  contentType: string;
  importId?: string;
}): Promise<ImportArchiveResult> {
  const safeFilename = sourceFilename.replace(/[^a-z0-9._-]/gi, "-");
  const prefix = importId ? `${organizationId}/${importId}` : organizationId;
  const path = `${prefix}/${Date.now()}-${safeFilename}`;
  const archivedAt = new Date().toISOString();

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(path, body, {
        access: "private",
        contentType,
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

  const blobPart: BlobPart = typeof body === "string" ? body : body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  const { error } = await admin.storage.from("raw-imports").upload(path, new Blob([blobPart], { type: contentType }), {
    contentType,
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
