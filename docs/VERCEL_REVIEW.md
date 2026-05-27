# Pipeline Recovery OS - Vercel Review Notes

## Product Value

Pipeline Recovery OS helps agents, brokers, loan officers, and local sales teams recover old leads and past-client opportunities already sitting in their CRM. The product turns imported contacts into a prioritized queue with draft follow-up messages that humans review before export.

The current sprint focused on customer-useful platform improvements:

- Raw CRM imports are archived privately for audit and reprocessing.
- Import summaries show a clearer audit trail for operators.
- The app is instrumented for performance, traffic, and workflow tracing.
- AI draft refinement is implemented behind a feature flag and ready for AI Gateway once team billing verification is complete.

## Vercel Services Used

- **Next.js on Vercel**: App Router, React Server Components, Server Actions, preview deployments, production aliasing.
- **Vercel Web Analytics**: Prospect/demo traffic visibility without third-party analytics.
- **Vercel Speed Insights**: Core Web Vitals visibility for the public demo and private app surfaces.
- **Vercel OpenTelemetry**: Non-PII traces for organization creation, imports, draft updates, exports, AI refinement, and QA login.
- **Vercel Blob**: Private archive of raw CRM import CSVs. Supabase remains the relational source of truth.
- **Vercel AI Gateway**: Draft refinement code path is present and feature-flagged. Local verification reached Gateway but the team requires billing verification before requests are served.

## What Was Deliberately Deferred

- **Vercel Queues**: Useful for 100K-1M row async import later, but current pilots use small admin-run imports. Synchronous import is simpler and safer today.
- **v0 Platform API**: Interesting for custom broker dashboards later, but not required to close the next pilot.
- **Sandbox**: Appropriate for broker-specific CRM connectors later. Current MVP uses operator-imported CSV.
- **MCP/outbound sending**: Deferred because the v1 compliance posture is human-approved export, not automatic messaging.

## Safety and Privacy

- Supabase RLS remains the tenant isolation boundary.
- No outbound SMS/email is sent by the product.
- The public demo uses synthetic data only.
- Vercel traces intentionally avoid names, emails, phone numbers, note bodies, and draft text.
- Raw imports are archived privately; archive URLs are operator-only and not exposed to clients.

## How To Verify

Local:

```bash
vercel env pull .env.local --environment=production --scope warforgetechs-projects --yes
npm run lint
npm run build
npm run dev
APP_URL=http://localhost:3000 npm run qa:human
```

Preview:

```bash
git push -u origin feat/vercel-customer-readiness
vercel --yes --scope warforgetechs-projects
export VERCEL_AUTOMATION_BYPASS_SECRET=<preview-bypass-secret>
APP_URL=<preview-url> npm run qa:human
```

Production is not promoted until local and preview QA pass.

## Current URLs

- Production demo: https://lead-recovery-os.vercel.app/demo
- Production app: https://lead-recovery-os.vercel.app
- GitHub repo: https://github.com/WarforgeTech/lead-recovery-os
