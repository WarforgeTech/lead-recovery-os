import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { provisionSeededWorkspaceForEmail } from "@/lib/provision";
import { traceAsync } from "@/lib/tracing";

function safeNextPath(value: FormDataEntryValue | null) {
  // We auto-provision a seeded workspace on first login, so the manual onboarding
  // form is skipped — default (and the legacy onboarding path) land on /dashboard.
  const raw = String(value ?? "/dashboard");
  if (!raw.startsWith("/") || raw.startsWith("//") || raw === "/onboarding/profile") return "/dashboard";
  return raw;
}

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(formData.get("next"));

  if (!email || !email.includes("@")) {
    return NextResponse.redirect(new URL(`/signup?error=invalid-email`, requestUrl.origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL(next, requestUrl.origin), { status: 303 });
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

  return traceAsync("demo.login", { has_email: Boolean(email), next_path: next }, async () => {
    const admin = createAdminClient();
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

    if (linkError || !data.properties?.email_otp) {
      return NextResponse.redirect(new URL(`/signup?error=demo-login`, requestUrl.origin), { status: 303 });
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: data.properties.email_otp,
      type: "email",
    });

    if (verifyError || !data.user?.id) {
      return NextResponse.redirect(new URL(`/signup?error=demo-login`, requestUrl.origin), { status: 303 });
    }

    // First-time emails get their own seeded workspace; returning emails resolve
    // to the same workspace and see only their data. Then land on the populated
    // dashboard — no manual setup step.
    await provisionSeededWorkspaceForEmail({ userId: data.user.id, email });

    return response;
  });
}
