import { redirect } from "next/navigation";
import { Card, Shell } from "@/components/ui";
import { getActiveOrganizationId, getClientOpportunities, requireUser } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/no-workspace");
  const opportunities = await getClientOpportunities(organizationId);
  const approved = opportunities.filter((item) => item.status === "approved").length;

  return (
    <Shell title="Exports">
      <Card>
        <h2 className="text-xl font-semibold tracking-tight">Approved follow-up queue</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Export approved records to CSV for manual import into the client&apos;s CRM, email workflow, or task system.
          Pipeline Recovery OS does not send outbound messages in v1.
        </p>
        <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <div className="text-zinc-500">Approved records</div>
          <div className="mt-1 text-3xl font-semibold">{approved}</div>
        </div>
        <a
          href="/api/exports/approved"
          className="mt-5 inline-flex h-11 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Download approved CSV
        </a>
      </Card>
    </Shell>
  );
}
