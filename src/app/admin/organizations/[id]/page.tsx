import Link from "next/link";
import { addOrganizationMember } from "@/app/actions";
import { Badge, Card, PrimaryLink, Shell, Stat } from "@/components/ui";
import { getOrganizationSummary, requireAdmin } from "@/lib/data";
import { getPipelineTemplate } from "@/lib/pipeline-templates";

export const dynamic = "force-dynamic";

export default async function OrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const summary = await getOrganizationSummary(id);
  const template = getPipelineTemplate(summary.organization.pipeline_template);
  const ready = summary.opportunities.filter((item) => item.status === "ready_to_contact").length;
  const approved = summary.opportunities.filter((item) => item.status === "approved").length;
  const held = summary.contacts.filter((item) => item.consent !== "ok").length;

  return (
    <Shell title={summary.organization.name}>
      <div className="mb-5 flex flex-wrap gap-3">
        <PrimaryLink href={`/admin/imports/new?organization_id=${id}`}>Import contacts</PrimaryLink>
        <Link href="/admin" className="inline-flex h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium">
          Back to admin
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Contacts" value={String(summary.contacts.length)} />
        <Stat label="Ready" value={String(ready)} />
        <Stat label="Approved" value={String(approved)} />
        <Stat label="Held for review" value={String(held)} />
      </div>
      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Pipeline template</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              This workspace is configured as <span className="font-medium text-zinc-900">{template.name}</span>. Labels,
              dashboard metrics, queues, and import rules adapt from this template.
            </p>
          </div>
          <Badge tone={template.id === "mortgage_growth" ? "blue" : "neutral"}>{template.id}</Badge>
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Members</h2>
          <div className="mt-4 space-y-2">
            {summary.organization.organization_members?.map((member: { email: string; role: string }) => (
              <div key={member.email} className="flex items-center justify-between rounded-md border border-zinc-200 p-3 text-sm">
                <span>{member.email}</span>
                <Badge>{member.role}</Badge>
              </div>
            ))}
          </div>
          <form action={addOrganizationMember} className="mt-5 flex gap-2">
            <input type="hidden" name="organization_id" value={id} />
            <input name="email" type="email" required placeholder="client@example.com" className="h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm" />
            <select name="role" className="h-10 rounded-md border border-zinc-300 px-3 text-sm">
              <option value="client">Client</option>
              <option value="admin">Admin</option>
            </select>
            <button className="h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white">Add</button>
          </form>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold tracking-tight">Imports</h2>
          <div className="mt-4 space-y-2">
            {summary.imports.map((item) => (
              <Link key={item.id} href={`/admin/imports/${item.id}`} className="block rounded-md border border-zinc-200 p-3 hover:bg-zinc-50">
                <div className="font-medium">{item.source_filename}</div>
                <div className="mt-1 text-sm text-zinc-500">
                  {item.processed_rows} processed · {item.priority_opportunities} priority · {item.status}
                </div>
              </Link>
            ))}
            {summary.imports.length === 0 ? <p className="text-sm text-zinc-500">No imports yet.</p> : null}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
