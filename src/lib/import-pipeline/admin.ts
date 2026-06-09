import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for the import pipeline. Kept free of next/headers
// so it can be imported inside Workflow step functions (which run outside the
// request scope). Steps create their own client because Supabase clients are not
// serializable and cannot cross the workflow/step boundary.
export function createImportAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export type ImportAdmin = ReturnType<typeof createImportAdmin>;

export function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}
