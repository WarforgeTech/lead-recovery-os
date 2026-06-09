import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireEnv } from "./env";

export type SessionUser = { id: string; email: string | null };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components can be read-only; middleware refreshes cookies.
          }
        },
      },
    },
  );
}

export function createAdminClient() {
  return createServiceClient(
    process.env.SUPABASE_URL || requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

// Resolve the signed-in user from the request's JWT. We use getClaims() rather
// than getUser() so verification happens locally via the cached JWKS (asymmetric
// signing keys) instead of a network round-trip to the Auth server on every
// render — the single biggest per-navigation latency win. React cache() dedupes
// repeated calls within one request (requireUser, requireAdmin, workspace view).
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});
