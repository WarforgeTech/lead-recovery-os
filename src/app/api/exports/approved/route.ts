import { NextResponse } from "next/server";
import { appUrl } from "@/lib/env";
import { getActiveOrganizationId, getClientOpportunities, requireUser } from "@/lib/data";
import { traceAsync } from "@/lib/tracing";

function cell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) return NextResponse.redirect(new URL("/no-workspace", appUrl()));
  return traceAsync("export.approved_csv", { organization_id: organizationId }, async () => {
    const opportunities = await getClientOpportunities(organizationId);
    const rows = opportunities
      .filter((item) => item.status === "approved")
      .map((item) => {
        const draft = item.drafts?.[0];
        return [
          item.contact?.name,
          item.contact?.email,
          item.contact?.phone,
          item.segment,
          item.recommended_action,
          draft?.edited_text || draft?.draft_text,
        ].map(cell).join(",");
      });
    const csv = ["name,email,phone,segment,recommended_action,approved_message", ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="approved-follow-up-queue.csv"',
      },
    });
  });
}
