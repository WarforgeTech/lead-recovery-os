# AI Import Evaluation

Pipeline Recovery OS uses AI SDK structured output (Vercel AI Gateway → `anthropic/claude-sonnet-4.6`) for messy import journey reconstruction, but deterministic parsing, dedupe, and suppression rules own final import decisions.

The lightweight eval suite lives at the repo root and runs in one command:

```bash
npm run eval            # parser fixtures + journey regression
npm run eval:parsers    # format coverage only
npm run eval:ai         # journey / hallucination regression only
```

It runs against the same `src/lib/import-pipeline` modules the production Vercel Workflow uses, so the eval and the live pipeline can never drift.

## What it checks

1. **Parser fixtures** (`evals/fixtures/`) — every supported format (CSV, TSV, TXT, JSON, VCF, repeat/suppression CSVs) parses to at least the expected number of non-empty rows.
2. **Journey regression** (`evals/import-journey-regression.json`) — for representative mortgage-recovery inputs:
   - **Stage classification** stays stable (e.g. `application_sent_not_started`, `needs_consent`, `docs_needed_preapproval_stuck`).
   - **Required context** from the imported rows remains present in the recommended journey.
   - **Hallucination guard:** the reconstruction never invents high-value outcomes — appointments, closed deals, funding, or submitted applications.

The regression exercises the **deterministic fallback** path, so it is cheap and stable in CI with no model calls or credentials. The production AI path feeds the same normalized input shape through AI SDK + Vercel AI Gateway and falls back to this exact deterministic reconstruction if Gateway credentials are missing or the model fails — so the contract the eval enforces holds in both modes.

## Interview talking points

- **Model choice:** Sonnet via AI Gateway gives stronger messy-text reasoning than a tiny model, while deterministic preprocessing limits token use.
- **Cost control:** parse and normalize first; call AI only for duplicate touchpoints, long notes, or ambiguous statuses.
- **Safety:** AI cannot write active contacts or send messages; human review and suppression rules gate the queue (the staged → Accept boundary).
- **Fallback:** imports remain usable without AI, with lower-confidence journey summaries — and the eval proves the fallback still meets the stage/hallucination contract.
