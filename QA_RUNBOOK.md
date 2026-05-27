# Pipeline Recovery OS QA Runbook

This repo has a browser-driven human QA harness. After any feature, fix, import change, auth change, route change, or deploy, run the flow before calling the work done.

## Command

```bash
npm run qa:human
```

The harness acts like a real user:

1. Opens the public demo and verifies the pitch math.
2. Opens the mortgage public demo and verifies application, rescue, and rollup framing.
3. Opens the login page.
4. Uses reviewer access-code login to verify the mortgage dashboard, pipeline, rescue, tasks, partners, and rollup.
5. Generates and clicks a Supabase magic link for the admin user.
6. Creates a QA client organization through the admin UI.
7. Imports a sample CRM CSV through the admin UI.
8. Generates and clicks a Supabase magic link for the invited client.
9. Checks the client dashboard.
10. Opens the leads list and a lead detail page.
11. Edits and approves a human-reviewed follow-up draft.
12. Exports the approved queue to CSV.
13. Verifies saved rows directly in Supabase.
14. Cleans up the QA organization unless `QA_KEEP_DATA=1`.
15. Writes a Markdown report and screenshots under `qa/reports/`.

## Required Env

The script reads `.env.local` first and then process env.

```bash
APP_URL=https://lead-recovery-os.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
QA_ADMIN_EMAIL=mark@warforge.tech
QA_LOGIN_SECRET=
VERCEL_AUTOMATION_BYPASS_SECRET=
REVIEWER_ACCESS_CODE=
BLOB_READ_WRITE_TOKEN=
ENABLE_AI_DRAFT_REFINEMENT=0
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is not required by the QA script. `QA_LOGIN_SECRET` is used by the protected `/auth/qa-login` route so browser QA can create real Supabase sessions without manual email.
`VERCEL_AUTOMATION_BYPASS_SECRET` is optional locally and required when QA targets a protected Vercel Preview deployment.
`REVIEWER_ACCESS_CODE` enables the reviewer-login check against `/reviewer-login`.

## Useful Flags

```bash
HEADLESS=0 npm run qa:human
QA_KEEP_DATA=1 npm run qa:human
APP_URL=http://localhost:3000 npm run qa:human
```

## Pass Criteria

- Public demo loads with the 3,000-contact story, 1,410 stale leads, 318 opportunities, and pilot economics.
- Mortgage demo loads with 2 applications/day, 14/21-day rescue, CEO rollup, and synthetic-only disclaimer.
- Reviewer access-code login reaches the synthetic `Vercel Reviewer Demo Team` mortgage workspace when configured.
- Reviewer mortgage workspace exposes application conversion, rescue, assistant task, referral partner, and rollup views.
- Admin magic-link login reaches `/admin`.
- Organization creation persists and opens the organization page.
- Import summary shows `4` total rows and `4` processed rows.
- Import summary shows private archive/audit metadata.
- Client magic-link login reaches `/dashboard`.
- Client sees the imported workspace and leads.
- Lead detail saves an approved draft.
- Exported CSV includes the approved lead and edited draft text.
- Supabase contains the created organization, import, contacts, opportunities, and approved draft.
- The run report says `PASS`.

If the run fails, fix the product or test harness before shipping feature work.
