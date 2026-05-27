import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { traceAsync } from "@/lib/tracing";

export async function GET(request: NextRequest) {
  const secret = process.env.QA_LOGIN_SECRET;
  const requestUrl = new URL(request.url);
  const suppliedSecret = requestUrl.searchParams.get("secret");
  const email = requestUrl.searchParams.get("email")?.trim().toLowerCase();
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (!secret || suppliedSecret !== secret || !email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const redirectTarget = new URL(next, requestUrl.origin);
  const response = NextResponse.redirect(redirectTarget);
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  return traceAsync("qa.login", { has_email: Boolean(email), next_path: next }, async () => {
    const admin = createAdminClient();
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !data.properties?.email_otp) {
      return NextResponse.json({ error: "Could not create QA session" }, { status: 500 });
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: data.properties.email_otp,
      type: "email",
    });

    if (verifyError) {
      return NextResponse.json({ error: "Could not verify QA session" }, { status: 500 });
    }

    return response;
  });
}
