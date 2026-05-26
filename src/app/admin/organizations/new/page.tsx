import { createOrganization } from "@/app/actions";
import { Card, Shell } from "@/components/ui";
import { requireAdmin } from "@/lib/data";

export default async function NewOrganizationPage() {
  await requireAdmin();
  return (
    <Shell title="Create organization">
      <Card className="max-w-2xl">
        <form action={createOrganization} className="space-y-5">
          <Field label="Organization name" name="name" placeholder="Avery Morgan Team" required />
          <Field label="Client email" name="email" type="email" placeholder="client@example.com" />
          <Field label="Market" name="market" placeholder="Houston, TX" />
          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Client type</span>
            <select name="client_type" className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3">
              <option value="agent">Agent</option>
              <option value="broker">Broker / team</option>
              <option value="loan_officer">Loan officer</option>
              <option value="local_sales_team">Local sales team</option>
            </select>
          </label>
          <button className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
            Create workspace
          </button>
        </form>
      </Card>
    </Shell>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
}: Readonly<{ label: string; name: string; type?: string; placeholder?: string; required?: boolean }>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 outline-none focus:border-zinc-900"
      />
    </label>
  );
}
