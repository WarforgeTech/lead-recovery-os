import { importContacts } from "@/app/actions";
import { Card, Shell } from "@/components/ui";
import { getAdminOrganizations, requireAdmin } from "@/lib/data";

const sampleCsv = `name,email,phone,source,lead type,area,price range,timeline,last contact,consent,agent,notes
Maria Gutierrez,maria@example.com,7135550101,Open house,buyer,Cypress,$390K-$460K,Before school year,2026-02-10,opt-in,Avery,Asked about schools and lender intro then went quiet
Daniel Brooks,daniel@example.com,2815550102,Website valuation,seller,Katy,$515K,After repairs,2026-01-08,opt-in,Avery,Requested home value estimate and roof timing
Priya Shah,priya@example.com,8325550103,Zillow inquiry,buyer,Energy Corridor,$310K-$360K,Six to nine months,2025-10-12,review,Avery,Asked about townhomes and HOA comparison
Lisa Nguyen,lisa@example.com,3465550104,Closed client,past client,Spring Branch,$8.3K referral scenario,Past client,2025-03-15,opt-in,Avery,No review or annual check-in logged`;

export default async function NewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ organization_id?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const organizations = await getAdminOrganizations();

  return (
    <Shell title="Import contacts">
      <Card>
        <form action={importContacts} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Organization</span>
            <select
              name="organization_id"
              required
              defaultValue={params.organization_id ?? organizations[0]?.id}
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Source filename</span>
            <input
              name="source_filename"
              defaultValue="crm-export.csv"
              className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">CSV contents</span>
            <textarea
              name="csv"
              rows={12}
              required
              defaultValue={sampleCsv}
              className="mt-2 w-full rounded-md border border-zinc-300 p-3 font-mono text-sm leading-6"
            />
          </label>
          <details className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
            <summary className="cursor-pointer text-sm font-medium">Optional column mapping overrides</summary>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ["map_name", "Name"],
                ["map_email", "Email"],
                ["map_phone", "Phone"],
                ["map_source", "Source"],
                ["map_lead_type", "Lead type"],
                ["map_area", "Area"],
                ["map_price_range", "Price range"],
                ["map_timeline", "Timeline"],
                ["map_last_contact", "Last contact"],
                ["map_consent", "Consent"],
                ["map_owner", "Owner"],
                ["map_notes", "Notes"],
              ].map(([name, label]) => (
                <label key={name} className="block">
                  <span className="text-xs font-medium text-zinc-500">{label}</span>
                  <input name={name} placeholder="CSV header" className="mt-1 h-9 w-full rounded-md border border-zinc-300 px-2 text-sm" />
                </label>
              ))}
            </div>
          </details>
          <button className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Process import
          </button>
        </form>
      </Card>
    </Shell>
  );
}
