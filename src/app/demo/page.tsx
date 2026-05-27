import Image from "next/image";
import { Badge, Card, PrimaryLink, SecondaryLink, Stat } from "@/components/ui";
import { demoLeads, demoSegments, grossCommissionSide, pilotPrice } from "@/lib/demo-data";
import { segmentLabels } from "@/lib/types";

const scenarios = [
  { label: "Conservative", closeRate: "0.5%", deals: 7, commission: "$58,100" },
  { label: "Standard", closeRate: "1.0%", deals: 14, commission: "$116,200" },
  { label: "Upside", closeRate: "2.0%", deals: 28, commission: "$232,400" },
];

export default function DemoPage() {
  const firstLead = demoLeads[0];

  return (
    <main className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <div className="font-semibold tracking-tight text-zinc-950">Pipeline Recovery OS</div>
            <div className="text-xs text-zinc-500">Synthetic demo. No client data.</div>
          </div>
          <div className="flex gap-3">
            <SecondaryLink href="/">Home</SecondaryLink>
            <SecondaryLink href="/demo/mortgage">Mortgage demo</SecondaryLink>
            <PrimaryLink href="mailto:mark@warforge.tech?subject=Pipeline%20Recovery%20OS%20workflow%20call">
              Book a 15-minute workflow call
            </PrimaryLink>
          </div>
        </div>
      </header>

      <section className="border-b border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1fr_360px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">Public pitch demo</p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-zinc-950">Lead Recovery and Follow-Up OS</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-zinc-600">
              Built for agents, brokers, loan officers, and local sales teams that already paid for or earned the
              relationships sitting in their CRM. The system finds recoverable conversations, drafts human-approved
              follow-up, and tracks replies, appointments, and estimated commission.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Badge tone="blue">Human-approved messages only</Badge>
              <Badge>Directional ROI, not guaranteed</Badge>
              <Badge>No outbound sending in v1</Badge>
            </div>
          </div>
          <Card>
            <div className="flex items-center gap-4">
              <Image
                src="/demo-agent.png"
                alt="Synthetic agent profile"
                width={88}
                height={88}
                className="rounded-full border border-zinc-200 object-cover"
                priority
              />
              <div>
                <div className="text-lg font-semibold text-zinc-950">Avery Morgan</div>
                <div className="text-sm leading-6 text-zinc-600">Synthetic real estate team profile</div>
              </div>
            </div>
            <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-700">
              The demo models a 3,000-contact CRM import with Houston assumptions: about $
              {grossCommissionSide.toLocaleString()} gross commission per median transaction side and a $
              {pilotPrice.toLocaleString()} pilot.
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-10">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat label="Contacts analyzed" value="3,000" note="Preloaded synthetic CRM import" />
          <Stat label="Reachable stale leads" value="1,410" note="Consent present and not recently touched" />
          <Stat label="Priority opportunities" value="318" note="Highest-score records for week-one follow-up" />
          <Stat label="Recoverable commission scenario" value="$58K-$232K" note="0.5%-2.0% close-rate model" />
        </div>
      </section>

      <section className="border-y border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Import cleanup</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Mark uploads the client export. Pipeline Recovery OS normalizes the messy fields before the client ever
              sees the queue.
            </p>
            <div className="mt-5 space-y-3 text-sm">
              {[
                ["3,000", "raw contacts loaded"],
                ["214", "duplicates removed"],
                ["312", "missing phone or email flagged"],
                ["181", "invalid, no-consent, or cold records held"],
                ["6", "lead categories inferred"],
              ].map(([value, label]) => (
                <div key={label} className="flex items-center justify-between border-b border-zinc-100 pb-3">
                  <span className="text-zinc-600">{label}</span>
                  <span className="font-semibold text-zinc-950">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Recovery dashboard</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              The math is intentionally visible. One median Houston transaction side at 2.5% is modeled as roughly $
              {grossCommissionSide.toLocaleString()} gross commission.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {scenarios.map((scenario) => (
                <div key={scenario.label} className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <div className="text-sm font-medium text-zinc-600">{scenario.label}</div>
                  <div className="mt-2 text-2xl font-semibold">{scenario.commission}</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    {scenario.closeRate} of reachable stale leads, about {scenario.deals} sides.
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-[1fr_420px]">
        <Card>
          <h2 className="text-2xl font-semibold tracking-tight">Lead segments</h2>
          <div className="mt-5 grid gap-3">
            {demoSegments.map((segment) => (
              <div key={segment.id} className="grid gap-3 rounded-md border border-zinc-200 p-4 md:grid-cols-[180px_1fr_170px]">
                <div>
                  <div className="font-medium text-zinc-950">{segment.label}</div>
                  <div className="mt-1 text-sm text-zinc-500">{segment.count} records</div>
                </div>
                <div className="text-sm leading-6 text-zinc-600">
                  <div>{segment.action}</div>
                  <div className="mt-1 text-zinc-500">{segment.compliance}</div>
                </div>
                <div className="text-right font-semibold text-zinc-950">{segment.estimatedValue}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">Lead detail</h2>
            <Badge tone="green">{segmentLabels[firstLead.segment]}</Badge>
          </div>
          <div className="mt-5 space-y-4 text-sm leading-6">
            <div>
              <div className="text-zinc-500">Lead</div>
              <div className="font-medium text-zinc-950">{firstLead.name}</div>
            </div>
            <div>
              <div className="text-zinc-500">Timeline</div>
              <div>{firstLead.timeline}</div>
            </div>
            <div>
              <div className="text-zinc-500">Conversation summary</div>
              <div>{firstLead.summary}</div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Draft for approval</div>
              <p>{firstLead.draft}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="h-10 rounded-md border border-zinc-300 text-sm font-medium">Edit draft</button>
              <button className="h-10 rounded-md bg-zinc-950 text-sm font-medium text-white">Approve</button>
            </div>
          </div>
        </Card>
      </section>

      <section className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-10 lg:grid-cols-2">
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Follow-up queue</h2>
            <div className="mt-5 space-y-3">
              {["Soft re-entry", "Still looking?", "Home value check-in", "Referral/review ask", "Loan pre-approval follow-up"].map(
                (item, index) => (
                  <div key={item} className="flex items-center justify-between rounded-md border border-zinc-200 p-3">
                    <div>
                      <div className="font-medium">{item}</div>
                      <div className="text-sm text-zinc-500">Requires human approval before export</div>
                    </div>
                    <Badge tone={index < 2 ? "green" : "neutral"}>{index < 2 ? "Ready" : "Review"}</Badge>
                  </div>
                ),
              )}
            </div>
          </Card>
          <Card>
            <h2 className="text-2xl font-semibold tracking-tight">Pilot economics</h2>
            <div className="mt-5 grid gap-3">
              <Stat label="One-week pilot" value="$1,500" note="Run on 100-500 old leads." />
              <Stat label="Median Houston side GCI" value="$8,300" note="Directional estimate at 2.5%." />
              <Stat label="Break-even" value="18% of one side" note="A fraction of one recovered deal pays back the pilot." />
            </div>
            <p className="mt-5 text-xs leading-5 text-zinc-500">
              Synthetic demo data. ROI estimates are directional, not guaranteed. Source anchor: HAR April 2026 market
              update for Houston median single-family price.
            </p>
          </Card>
        </div>
      </section>
    </main>
  );
}
