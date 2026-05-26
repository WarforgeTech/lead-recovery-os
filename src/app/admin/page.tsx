import Link from "next/link";
import { Badge, Card, PrimaryLink, Shell } from "@/components/ui";
import { getAdminOrganizations, requireAdmin } from "@/lib/data";

export default async function AdminPage() {
  await requireAdmin();
  const organizations = await getAdminOrganizations();

  return (
    <Shell title="Admin">
      <div className="mb-5 flex flex-wrap gap-3">
        <PrimaryLink href="/admin/organizations/new">Create organization</PrimaryLink>
        <PrimaryLink href="/admin/imports/new">Import contacts</PrimaryLink>
      </div>
      <Card>
        <h2 className="text-xl font-semibold tracking-tight">Client organizations</h2>
        <div className="mt-5 space-y-3">
          {organizations.map((org) => (
            <Link key={org.id} href={`/admin/organizations/${org.id}`} className="block rounded-md border border-zinc-200 p-4 hover:bg-zinc-50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-zinc-950">{org.name}</div>
                  <div className="mt-1 text-sm text-zinc-500">{org.market || "Market not set"} · {org.client_type}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{org.status}</Badge>
                  <Badge tone="blue">{org.imports?.length ?? 0} imports</Badge>
                </div>
              </div>
            </Link>
          ))}
          {organizations.length === 0 ? <p className="text-sm text-zinc-500">No organizations yet.</p> : null}
        </div>
      </Card>
    </Shell>
  );
}
