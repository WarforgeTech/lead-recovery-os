import { PrimaryLink, SecondaryLink } from "@/components/ui";

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="font-semibold tracking-tight">Pipeline Recovery OS</div>
          <div className="flex gap-3">
            <SecondaryLink href="/login">Client login</SecondaryLink>
            <PrimaryLink href="/signup">Start free</PrimaryLink>
          </div>
        </div>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">White-glove lead recovery</p>
          <h1 className="mt-5 max-w-3xl text-5xl font-semibold tracking-tight text-zinc-950">
            Turn forgotten contacts into a prioritized follow-up queue.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Pipeline Recovery OS is an AI-powered lead recovery and follow-up system for agents, brokers, loan
            officers, and local sales teams. It finds old leads, past clients, open-house contacts, and referral
            opportunities sitting untouched, then turns them into human-approved messages.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <PrimaryLink href="/signup">Start with your lead file</PrimaryLink>
            <SecondaryLink href="/demo">View demo</SecondaryLink>
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6">
          <div className="grid grid-cols-2 gap-4">
            {[
              ["3,000", "contacts analyzed"],
              ["1,410", "reachable stale leads"],
              ["318", "priority opportunities"],
              ["$58K-$232K", "directional recovery scenario"],
            ].map(([value, label]) => (
              <div key={label} className="rounded-md border border-zinc-200 bg-white p-4">
                <div className="text-2xl font-semibold tracking-tight">{value}</div>
                <div className="mt-1 text-sm text-zinc-600">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-6 text-zinc-600">
            No outbound sending in v1. Upload the messy export, review the cleaned queue, then approve what your team should work.
          </p>
        </div>
      </section>
    </main>
  );
}
