# Pipeline Recovery OS

A lead-recovery product for mortgage brokers, loan officers, and real-estate teams. It ingests messy, inactive lead exports (old CRM dumps, open-house lists, referral notes, dead files), cleans and reconstructs them, and turns the recoverable people into a prioritized, human-approved daily follow-up queue.

> **Built as a Vercel Solutions Architect take-home.** The interesting parts are the architecture choices, not the feature count: durable stateful ingestion on Vercel, deliberate rendering/caching decisions, an AI step that's an assist (not a dependency), and tenant-isolated multi-tenant data. A full architecture write-up lives in [`docs/ARCHITECTURE_INTERVIEW_BRIEF.html`](docs/ARCHITECTURE_INTERVIEW_BRIEF.html).

**Live:** https://lead-recovery-os.vercel.app — sign in with **any email** (demo provisioning, no password/verification); you get your own isolated, pre-seeded workspace.

---

## Architecture at a glance

```
Browser ──> Next.js (App Router, RSC, Server Actions, Route Handlers)
              │  upload + archive + start()         │ live progress (poll)
              ▼                                      ▼
        Vercel Blob (private raw file)         Supabase Postgres (source of truth:
              │                                  RLS tenancy, job/progress state,
              ▼                                  staged rows, canonical records)
        Vercel Workflow (durable, step-based, Fluid Compute)
        parse → normalize → dedupe → suppress → AI reconstruct → stage
                                                   │
                                          AI SDK + Vercel AI Gateway
                                          (Claude Sonnet, deterministic fallback)
```

| Layer | Choice | Why |
|---|---|---|
| App + compute | **Next.js 16 on Vercel** | App Router, Server Components, Server Actions, route handlers, streaming |
| **Ingestion** | **Vercel Workflows** (Workflow DevKit) on Fluid Compute | File ingestion is long-running, multi-phase, and stateful. A durable Workflow gives step-level retries and **survives client disconnects, refreshes, and instance restarts** — without a separate worker service or a wall-clock timeout. This is the headline decision; see [`src/workflows/import-workflow.ts`](src/workflows/import-workflow.ts). |
| State of record | **Supabase Postgres + RLS** | Multi-tenant isolation, queryable progress + staged rows (the human-review UI needs them), audit trail. Progress lives here, not in workflow storage, which is why the browser survives disconnects. |
| File archive | **Vercel Blob** (private) | Raw imports archived for audit/reprocessing; Postgres isn't a file store. |
| AI | **AI SDK + Vercel AI Gateway** (`anthropic/claude-sonnet-4.6`) | One-line provider/model swap; an **assist with a deterministic fallback**, never a hard dependency. Sonnet over Opus is a deliberate cost choice for this high-volume step. |
| Observability | **OpenTelemetry + Analytics + Speed Insights** | Named business spans (`src/lib/tracing.ts`) surfaced in Vercel Observability. |

### The import flow (and the staged → Accept boundary)
Upload → archive to Blob → create job → `start(importWorkflow)`. The workflow's steps parse (CSV/TSV/XLSX/JSON/VCF/DOCX/PDF), normalize, dedupe, suppress DNC/opt-out, optionally AI-reconstruct each lead's journey, and write **staged** rows. Nothing enters the live queue until a human clicks **Accept** on the review screen — the UI makes that boundary explicit ("Not imported yet" until accepted). You can upload **multiple files at once**, each tagged with its own source type.

### Performance (Track A)
The authenticated surfaces are genuinely per-user real-time data — there's no shared shell to cache, so the win is **removing redundant round-trips and streaming**, not caching:
- Sessions verify **locally** via `getClaims()` (cached JWKS) instead of an Auth-server round-trip on every navigation.
- `React.cache()` dedupes per-render queries; the middleware matcher excludes API/asset paths.
- Dashboard filters run **client-side** (no refetch); every action button shows instant pending state; `loading.tsx` streams the shell.
- The import-accept commit was parallelized (bounded concurrency) — large imports went from ~10s to ~1–2s.
- Functions are pinned to `iad1` to colocate with the Supabase `us-east-1` database.

---

## Run locally

```bash
npm install
cp .env.local.example .env.local   # then fill in the values below
npm run dev
```

Required environment variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_EMAILS=you@example.com
AI_GATEWAY_API_KEY=          # Vercel AI Gateway key (vck_...); omit to use the deterministic fallback
BLOB_READ_WRITE_TOKEN=       # optional; falls back to Supabase Storage if absent
REVIEWER_ACCESS_CODE=        # optional reviewer sandbox
```

Apply the schema (Supabase):

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Evaluation

A lightweight eval runs against the same `src/lib/import-pipeline` modules the production Workflow uses, so they can't drift:

```bash
npm run eval          # parser fixtures + AI journey/hallucination regression (pass/fail table)
npm run eval:parsers  # format coverage only
npm run eval:ai       # stage classification + hallucination guard only
```

It checks that every supported file format parses, and that journey reconstruction lands the right stage, preserves required context, and **never invents outcomes** (appointments, closings, funding). Details in [`docs/AI_IMPORT_EVALS.md`](docs/AI_IMPORT_EVALS.md).

```bash
npm run build && npm run lint   # both green
```

## Code map

| Area | Path |
|---|---|
| Durable import workflow (orchestrator + steps) | `src/workflows/import-workflow.ts` |
| Pipeline logic (parse/normalize/dedupe/suppress/AI/stage) | `src/lib/import-pipeline/` |
| Upload route (archive + `start()`) | `src/app/api/imports/route.ts` |
| Multi-file import UI | `src/components/import-launcher.tsx` |
| Review + Accept (human commit boundary) | `src/app/imports/[id]/review/page.tsx`, `acceptStagedImport` in `src/app/actions.ts` |
| Auth + seeded workspace provisioning | `src/app/auth/demo-login/route.ts`, `src/lib/provision.ts` |
| Performance layer (local session verify + dedup) | `src/lib/supabase-server.ts`, `src/lib/data.ts`, `src/lib/middleware.ts` |
| Instant-feedback UI | `src/components/submit-button.tsx`, `src/components/dashboard-queue.tsx` |
| Eval suite | `evals/run.mts` |
| Schema + RLS | `supabase/migrations/` |

Comments throughout call out the deliberate decisions (the *why*, not the *what*).

## Deliberate non-goals

- **No outbound sending.** The product generates drafts and a queue; a human approves. It never sends SMS/email/DMs.
- **Suppression-first.** DNC/opt-out/closed records are held out *before* any draft is created.
- **No heavy test suite.** A small, defensible eval (parser fixtures + AI hallucination regression) over broad-but-shallow coverage.
- **Demo-grade auth.** Frictionless email provisioning for evaluation; production would layer SSO and promote RLS to the primary gate.
