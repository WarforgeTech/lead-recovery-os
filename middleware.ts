import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run session refresh only on page navigations. Excluding API routes keeps the
  // 1.5s import-status poll off the auth path, and excluding .well-known/workflow
  // prevents the matcher from intercepting the Workflow DevKit's internal routes.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.well-known/workflow|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
