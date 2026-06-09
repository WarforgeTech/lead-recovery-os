# Self-Serve Import QA 20260604180139

Status: **PASS**
App URL: https://lead-recovery-os.vercel.app
Email: qa-selfserve+20260604180139@pipeline-recovery.test
Organization id: a236b9a6-820d-43c5-a12f-ff438b52f87a
Import ids: 9a237fa5-3a62-446a-915b-c7cdafb10f20, 31797fe5-569f-48dc-80d5-792324ae53b7, f9ef6b8a-b26d-48c6-ab2b-f52b974819f7, 46685ebe-b73c-470a-89b5-9231c7bc2efc, f06b8794-cab8-489e-ad81-f170db2907bf, 3167aa37-3a37-4484-88d0-39b2ade6f5fb
Cleanup: deleted QA data

## Steps

1. **PASS - QA login** (2026-06-04T18:01:42.977Z)
   Created session for qa-selfserve+20260604180139@pipeline-recovery.test.
2. **PASS - Create workspace** (2026-06-04T18:01:44.838Z)
   Workspace id a236b9a6-820d-43c5-a12f-ff438b52f87a.
3. **PASS - Import accepted** (2026-06-04T18:01:54.134Z)
   raw-exclusions-dnc-closed.txt: {"ready":0,"needs_review":0,"suppressed":9,"merge":0,"create":0}
4. **PASS - Import accepted** (2026-06-04T18:02:10.885Z)
   crm-export-40.csv: {"ready":28,"needs_review":0,"suppressed":12,"merge":0,"create":28}
5. **PASS - Import accepted** (2026-06-04T18:02:26.926Z)
   facebook-open-house-30.csv: {"ready":21,"needs_review":0,"suppressed":9,"merge":0,"create":21}
6. **PASS - Import accepted** (2026-06-04T18:02:41.476Z)
   text-message-notes-20.txt: {"ready":14,"needs_review":0,"suppressed":6,"merge":0,"create":14}
7. **PASS - Import accepted** (2026-06-04T18:02:52.407Z)
   seller-valuation-notes-10.txt: {"ready":7,"needs_review":0,"suppressed":3,"merge":0,"create":7}
8. **PASS - Import accepted** (2026-06-04T18:03:09.495Z)
   journey-update-import-35.csv: {"ready":25,"needs_review":0,"suppressed":10,"merge":17,"create":8}
9. **PASS - Dashboard and contacts** (2026-06-04T18:03:13.616Z)
   Imported contacts are visible in daily workspace views.
10. **PASS - Outcome button** (2026-06-04T18:03:19.915Z)
   No reply persisted status=contacted, touch_count=1, next_due_at=2026-06-07.
11. **PASS - Daily dump** (2026-06-04T18:03:24.741Z)
   One-paragraph recap applied no-response, escalation, appointment, and unmatched review outcomes.
12. **PASS - Persistence assertions** (2026-06-04T18:03:24.957Z)
   78 contacts, 78 opportunities, 49 exclusions.
13. **PASS - Mobile smoke** (2026-06-04T18:03:29.919Z)
   Dashboard and imports render on mobile viewport.
14. **PASS - Cleanup** (2026-06-04T18:03:30.092Z)
   Deleted QA organization a236b9a6-820d-43c5-a12f-ff438b52f87a.

## Artifacts

- Screenshots: `screenshots/`