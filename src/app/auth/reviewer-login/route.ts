import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-server";
import { ensureReviewerDemoWorkspace, reviewerEmail } from "@/lib/reviewer-demo";
import { traceAsync } from "@/lib/tracing";

export async function POST(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  const suppliedCode = String(formData.get("access_code") ?? "").trim();
  const expectedCode = process.env.REVIEWER_ACCESS_CODE;

  if (!expectedCode || suppliedCode !== expectedCode) {
    return NextResponse.redirect(new URL("/reviewer-login?error=1", requestUrl.origin), { status: 303 });
  }

  const response = NextResponse.redirect(new URL("/dashboard", requestUrl.origin), { status: 303 });
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

  return traceAsync("reviewer.login", { reviewer_workspace: true }, async () => {
    const admin = createAdminClient();
    await ensureReviewerDemoWorkspace(admin);

    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: reviewerEmail,
    });

    if (linkError || !data.properties?.email_otp) {
      return NextResponse.redirect(new URL("/reviewer-login?error=1", requestUrl.origin), { status: 303 });
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: reviewerEmail,
      token: data.properties.email_otp,
      type: "email",
    });

    if (verifyError) {
      return NextResponse.redirect(new URL("/reviewer-login?error=1", requestUrl.origin), { status: 303 });
    }

    return response;
  });
}
