import { redirect } from "next/navigation";
import { createSelfServeWorkspace } from "@/app/actions";
import { Card } from "@/components/ui";
import { getMemberships, requireUser } from "@/lib/data";

export default async function OnboardingProfilePage() {
  await requireUser();
  const memberships = await getMemberships();
  if (memberships.length) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">Workspace setup</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">Set up your workspace</h1>
        <p className="mt-4 text-sm leading-6 text-zinc-600">
          This lets Pipeline Recovery OS label the queue in language your team already uses. You can change these settings later.
        </p>
        <Card className="mt-6">
          <form action={createSelfServeWorkspace} className="space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">Workspace name</span>
              <input
                name="name"
                required
                placeholder="Example: Adam Mortgage Team"
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-zinc-800">Business type</span>
                <select name="pipeline_template" className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3">
                  <option value="real_estate_default">Real estate / local sales</option>
                  <option value="mortgage_growth">Mortgage growth</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium text-zinc-800">Your role</span>
                <select name="client_type" className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3">
                  <option value="agent">Agent</option>
                  <option value="broker">Broker / team lead</option>
                  <option value="loan_officer">Loan officer</option>
                  <option value="assistant">Assistant</option>
                  <option value="local_sales">Local sales</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm font-medium text-zinc-800">Market / location</span>
              <input
                name="market"
                placeholder="Houston, TX"
                className="mt-2 h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
              />
            </label>
            <button className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800">
              Continue to import
            </button>
          </form>
        </Card>
      </div>
    </main>
  );
}
