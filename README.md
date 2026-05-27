# Pipeline Recovery OS

Pipeline Recovery OS is an AI-powered lead recovery and follow-up system for agents, brokers, loan officers, and local sales teams.

It finds old leads, past clients, open-house contacts, and referral opportunities sitting untouched, then turns them into a prioritized follow-up queue with human-approved messages.

## What ships in v1

- Public synthetic demo at `/demo`
- Mortgage growth demo at `/demo/mortgage`
- Access-code reviewer sandbox at `/reviewer-login`
- Template-aware workspaces for real estate/local sales and mortgage growth
- Supabase magic-link login
- Client workspace dashboard
- Lead list, lead detail, pipeline queues, rescue queues, task view, partner view, rollup, status review, and draft editing
- Admin-only organization creation
- Admin-only CSV import via pasted CSV text
- Private Vercel Blob archive for raw CRM imports when configured
- Deterministic normalization, dedupe, segmentation, scoring, and draft generation
- Approved queue CSV export
- Vercel Analytics, Speed Insights, and OpenTelemetry instrumentation
- Supabase Postgres RLS for tenant-scoped client data

## What v1 does not do

- No automated signup
- No Stripe
- No outbound SMS or email sending
- No real AI processing of client PII
- No public upload on `/demo`
- No analytics or tracking scripts

## Local setup

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=mark@warforge.tech
QA_LOGIN_SECRET=
REVIEWER_ACCESS_CODE=
BLOB_READ_WRITE_TOKEN=
AI_GATEWAY_API_KEY=
ENABLE_AI_DRAFT_REFINEMENT=0
```

## Supabase

Hosted project: `Pipeline Recovery OS`

Apply migrations:

```bash
supabase link --project-ref pozkwipdqywmytbfvkas
supabase db push --dns-resolver https
```

## Manual smoke test

- `/demo` loads publicly and shows synthetic 3,000-contact economics.
- `/demo/mortgage` loads publicly and shows mortgage pipeline goals, 14/21-day rescue, and CEO rollup.
- `/reviewer-login` opens the synthetic reviewer workspace with the configured access code.
- `/login` sends a Supabase magic link.
- Invited users can reach `/dashboard`.
- Users without a membership land on `/no-workspace`.
- Admin can create an organization.
- Admin can process a CSV import.
- Import summary shows private archive/audit metadata.
- Leads render in `/leads`.
- A lead detail draft can be edited and approved.
- `/exports` downloads approved records as CSV.
