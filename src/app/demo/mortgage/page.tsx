import Image from "next/image";
import { Badge, Card, PrimaryLink, SecondaryLink, Stat } from "@/components/ui";
import { mortgageBorrowers, mortgageDemo, mortgageQueues } from "@/lib/mortgage-demo-data";

export default function MortgageDemoPage() {
  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="font-semibold tracking-tight text-zinc-950">Pipeline Recovery OS</div>
            <div className="text-xs text-zinc-500">Mortgage growth template. Synthetic demo.</div>
          </div>
          <div className="flex gap-3">
            <SecondaryLink href="/demo">General demo</SecondaryLink>
            <SecondaryLink href="/reviewer-login">Open interactive sandbox</SecondaryLink>
            <PrimaryLink href="mailto:mark@warforge.tech?subject=Mortgage%20Pipeline%20Recovery%20pilot">
              Book a 15-minute workflow call
            </PrimaryLink>
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Public pitch demo</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight text-zinc-950">
              Pipeline Recovery OS configured for mortgage growth
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
              A template-based pipeline system for broker owners and loan officers. It turns scattered borrower,
              application, document, and referral contacts into a daily action system tied to applications per day and
              monthly loan-volume goals.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="blue">2 applications/day target</Badge>
              <Badge>14/21-day rescue</Badge>
              <Badge>No outbound sending in v1</Badge>
              <Badge tone="green">Interactive sandbox available</Badge>
            </div>
          </div>
          <Card>
            <div className="flex items-center gap-4">
              <Image
                src="/demo-agent.png"
                alt="Synthetic broker profile"
                width={88}
                height={88}
                className="rounded-full border border-zinc-200 object-cover"
                priority
              />
              <div>
                <div className="text-lg font-semibold text-zinc-950">Adam Chen</div>
                <div className="text-sm leading-6 text-zinc-600">Synthetic broker-owner profile</div>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
              This demo models a brokerage pilot with thousands of stale contacts, referral partners, borrowers who
              talked but never applied, and assistant-driven document follow-up.
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Monthly loan-volume goal" value={mortgageDemo.monthlyGoal} note={`${mortgageDemo.applicationsPerDay} applications/day target`} />
          <Stat label="Active pipeline volume" value={mortgageDemo.activePipeline} note="Synthetic active borrower opportunities" />
          <Stat label="Gap to monthly goal" value={mortgageDemo.gapToGoal} note="Visible target gap for the broker owner" />
          <Stat label="Borrowers at risk" value={mortgageDemo.borrowersAtRisk} note="14+ days since meaningful contact" />
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Goal dashboard</h2>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["Annual loan-volume goal", mortgageDemo.annualGoal],
                ["Applications per week target", mortgageDemo.applicationsPerWeek],
                ["Follow-ups due today", mortgageDemo.followUpsDue],
                ["CEO-ready pilot report", "Included"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="text-zinc-600">{label}</span>
                  <span className="font-semibold text-zinc-950">{value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Mortgage pipeline queues</h2>
            <div className="mt-5 grid gap-3">
              {mortgageQueues.map((queue) => (
                <div key={queue.name} className="grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 md:grid-cols-[180px_1fr_120px]">
                  <div>
                    <div className="font-medium text-zinc-950">{queue.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{queue.count} records</div>
                  </div>
                  <div className="text-sm leading-6 text-zinc-600">{queue.action}</div>
                  <div className="font-semibold text-zinc-950 md:text-right">{queue.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Next-best-action queue</h2>
          <div className="mt-5 space-y-3">
            {mortgageBorrowers.map((borrower) => (
              <div key={borrower.name} className="rounded-md border border-zinc-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-zinc-950">{borrower.name}</div>
                    <div className="mt-1 text-sm text-zinc-500">{borrower.stage} · {borrower.loanAmount} · Owner: {borrower.owner}</div>
                  </div>
                  <Badge tone={borrower.lastContact.includes("24") ? "red" : "yellow"}>{borrower.lastContact}</Badge>
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-600">{borrower.whyNow}</p>
                <p className="mt-2 text-sm font-medium text-zinc-900">Next step: {borrower.nextStep}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Human-approved draft</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Every message is reviewed by Adam or Janine. The system does not send SMS or email in v1.
          </p>
          <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
            {mortgageBorrowers[0].draft}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="h-10 rounded-md border border-zinc-300 text-sm font-medium">Edit draft</button>
            <button className="h-10 rounded-md bg-zinc-950 text-sm font-medium text-white">Approve</button>
          </div>
        </Card>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-2">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">CEO / broker rollup</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              A pilot report that shows applications created, stale borrowers recovered, follow-ups completed, active
              opportunities, and where loan officers are leaking borrowers before application.
            </p>
          </Card>
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Pilot economics</h2>
            <div className="mt-5 grid gap-3">
              <Stat label="Founding broker pilot" value="$2,500" note="7-day pilot on 100-500 contacts." />
              <Stat label="Team rollout credit" value="100%" note="Credited toward $10K-$15K rollout if expanded within 14 days." />
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-500">
              Synthetic demo data. ROI and loan-volume estimates are directional, not guaranteed. No real borrower data
              appears on this page.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
