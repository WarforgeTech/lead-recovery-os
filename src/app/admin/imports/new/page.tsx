import { importContacts } from "@/app/actions";
import { Card, Shell } from "@/components/ui";
import { getAdminOrganizations, requireAdmin } from "@/lib/data";

const sampleCsv = `name,email,phone,source,lead type,area,price range,timeline,last contact,consent,agent,notes
Maria Gutierrez,maria@example.com,7135550101,Open house,buyer,Cypress,$390K-$460K,Before school year,2026-02-10,opt-in,Avery,Asked about schools and lender intro then went quiet
Daniel Brooks,daniel@example.com,2815550102,Website valuation,seller,Katy,$515K,After repairs,2026-01-08,opt-in,Avery,Requested home value estimate and roof timing
Priya Shah,priya@example.com,8325550103,Zillow inquiry,buyer,Energy Corridor,$310K-$360K,Six to nine months,2025-10-12,review,Avery,Asked about townhomes and HOA comparison
Lisa Nguyen,lisa@example.com,3465550104,Closed client,past client,Spring Branch,$8.3K referral scenario,Past client,2025-03-15,opt-in,Avery,No review or annual check-in logged`;

const mortgageSampleCsv = `name,email,phone,source,current status,loan goal,estimated loan amount,referral source,missing next step,last meaningful contact,consent,assigned owner,notes
Jordan Miles,jordan@example.com,7135550201,Realtor referral,talked no application,purchase,520000,Elena Park,finish application,2026-05-14,opt-in,Adam,Had purchase consult and asked for application link but has not submitted
Taylor Reed,taylor@example.com,2815550202,Website lead,application started,purchase,410000,Google Ads,complete application,2026-05-08,opt-in,Janine,Application started but borrower got stuck on income section
Monica Patel,monica@example.com,8325550203,Past client,closed client,refi check-in,385000,Past client,annual mortgage review,2026-04-30,opt-in,Adam,Closed in 2023 and asked whether a refi review would make sense later
Chris Howard,chris@example.com,3465550204,Realtor partner,referral partner,partner nurture,0,Rachel Gomez,partner check-in,2026-05-01,opt-in,Adam,Agent sends first-time buyers but has not heard from Adam this month
Nina Alvarez,nina@example.com,7135550205,Phone consult,docs missing,purchase,610000,Open house partner,bank statements and signatures,2026-05-03,opt-in,Janine,Borrower is confused by bank statement upload and e-signature step
Andre Coleman,andre@example.com,2815550206,Old CRM,lost stale,purchase,455000,Facebook lead,restart application,2026-04-18,opt-in,Adam,Talked through FHA path then went quiet before submitting application`;

export default async function NewImportPage({
  searchParams,
}: {
  searchParams: Promise<{ organization_id?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const organizations = await getAdminOrganizations();
  const selectedOrganization = organizations.find((org) => org.id === params.organization_id) ?? organizations[0];
  const isMortgage = selectedOrganization?.pipeline_template === "mortgage_growth";

  return (
    <Shell title="Import contacts">
      <Card>
        <form action={importContacts} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Organization</span>
            <select
              name="organization_id"
              required
              defaultValue={selectedOrganization?.id}
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
              defaultValue={isMortgage ? mortgageSampleCsv : sampleCsv}
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
                ["map_current_status", "Current status"],
                ["map_loan_intent", "Loan goal / intent"],
                ["map_estimated_loan_amount", "Estimated loan amount"],
                ["map_referral_source", "Referral source"],
                ["map_missing_next_step", "Missing next step"],
                ["map_last_meaningful_contact", "Last meaningful contact"],
                ["map_docs_missing", "Docs missing"],
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
