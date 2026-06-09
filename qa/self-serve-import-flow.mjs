import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
loadDotEnv(path.join(root, ".env.local"));

const appUrl = cleanUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keepData = process.env.QA_KEEP_DATA === "1";
const headless = process.env.HEADLESS !== "0";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `qa-selfserve+${runId}@pipeline-recovery.test`;
const reportDir = path.join(root, "qa", "reports", `selfserve-${runId}`);
const screenshotsDir = path.join(reportDir, "screenshots");
const dataDir = path.join(root, "demo-import-data", "pipeline-recovery-os-demo");
const report = [];
const created = { organizationId: "", importIds: [] };

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase URL/service role.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await fs.mkdir(screenshotsDir, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();

  await qaLogin(page);
  await createWorkspace(page);
  await importAndAccept(page, "do_not_contact", "raw-exclusions-dnc-closed.txt", { suppressedMin: 7, readyMin: 0 });
  await importAndAccept(page, "lead_file", "crm-export-40.csv", { readyMin: 20, suppressedMin: 2 });
  await importAndAccept(page, "lead_file", "facebook-open-house-30.csv", { readyMin: 20 });
  await importAndAccept(page, "lead_file", "text-message-notes-20.txt", { readyMin: 10 });
  await importAndAccept(page, "lead_file", "seller-valuation-notes-10.txt", { readyMin: 5 });
  await importAndAccept(page, "lead_file", "journey-update-import-35.csv", { readyMin: 8, mergedMin: 10 });
  await dashboardAndContactSmoke(page);
  await outcomeButtonSmoke(page);
  await dailyDumpSmoke(page);
  await persistenceAssertions();
  await mobileSmoke(context);
  await cleanup();
  await writeReport("PASS");
  console.log(`PASS: Self-serve import QA report written to ${path.relative(root, path.join(reportDir, "REPORT.md"))}`);
} catch (error) {
  await writeStep("Failure", "fail", error instanceof Error ? error.message : String(error));
  await cleanup().catch((cleanupError) => report.push({
    name: "Cleanup",
    status: "fail",
    detail: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
    at: new Date().toISOString(),
  }));
  await writeReport("FAIL");
  console.error(`FAIL: Self-serve import QA report written to ${path.relative(root, path.join(reportDir, "REPORT.md"))}`);
  throw error;
} finally {
  await browser?.close();
}

async function qaLogin(page) {
  await page.goto(await loginUrl(email, "/onboarding/profile"), { waitUntil: "networkidle" });
  await page.waitForURL(/\/onboarding\/profile(?:$|\?)/, { timeout: 30000 });
  await screenshot(page, "01-onboarding-profile.png");
  await writeStep("QA login", "pass", `Created session for ${email}.`);
}

async function magicLink(email, nextPath) {
  const redirectTo = `${appUrl}/auth/callback?next=${nextPath}`;
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo },
  });
  if (error) throw error;
  const actionLink = data.properties?.action_link;
  if (!actionLink) throw new Error(`Supabase did not return a magic-link action URL for ${email}.`);
  const url = new URL(actionLink);
  url.searchParams.set("redirect_to", redirectTo);
  return url.toString();
}

async function loginUrl(email, nextPath) {
  // Logs in via a real Supabase magic-link action URL (no app backdoor route).
  return magicLink(email, nextPath);
}

async function createWorkspace(page) {
  await page.getByLabel("Workspace name").fill(`Scattered Demo Mortgage Team ${runId}`);
  await page.getByLabel("Business type").selectOption("mortgage_growth");
  await page.getByLabel("Your role").selectOption("broker");
  await page.getByLabel("Market / location").fill("Houston, TX");
  await page.getByRole("button", { name: "Continue to import" }).click();
  await page.waitForURL(/\/onboarding\/import(?:$|\?)/, { timeout: 30000 });
  const { data } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("email", email)
    .single();
  created.organizationId = data?.organization_id ?? "";
  if (!created.organizationId) throw new Error("Workspace was not persisted.");
  await screenshot(page, "02-onboarding-import.png");
  await writeStep("Create workspace", "pass", `Workspace id ${created.organizationId}.`);
}

async function importAndAccept(page, sourceKind, filename, expectations = {}) {
  await page.goto(`${appUrl}/imports/new`, { waitUntil: "networkidle" });
  await page.locator(`input[name="source_kind"][value="${sourceKind}"]`).check({ force: true });
  await page.locator('input[type="file"]').setInputFiles(path.join(dataDir, filename));
  await page.getByRole("button", { name: "Clean and review leads" }).click();
  await page.waitForURL(/\/imports\/[0-9a-f-]+\/processing$/, { timeout: 30000 });
  const importId = page.url().match(/\/imports\/([^/]+)\/processing/)?.[1];
  if (!importId) throw new Error(`Could not parse import id for ${filename}.`);
  created.importIds.push(importId);
  await screenshot(page, `processing-${filename}.png`);

  await page.waitForURL(new RegExp(`/imports/${importId}/review$`), { timeout: 180000 });
  await page.waitForLoadState("networkidle");
  await screenshot(page, `review-${filename}.png`);

  const counts = await importCounts(importId);
  if (expectations.readyMin !== undefined && counts.ready < expectations.readyMin) {
    throw new Error(`${filename}: expected at least ${expectations.readyMin} ready rows, got ${counts.ready}`);
  }
  if (expectations.suppressedMin !== undefined && counts.suppressed < expectations.suppressedMin) {
    throw new Error(`${filename}: expected at least ${expectations.suppressedMin} suppressed rows, got ${counts.suppressed}`);
  }
  if (expectations.mergedMin !== undefined && counts.merge < expectations.mergedMin) {
    throw new Error(`${filename}: expected at least ${expectations.mergedMin} merge rows, got ${counts.merge}`);
  }

  await page.getByRole("button", { name: "Accept import and start work" }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 60000 });
  await waitForImportAccepted(importId);
  await writeStep("Import accepted", "pass", `${filename}: ${JSON.stringify(counts)}`);
}

async function dashboardAndContactSmoke(page) {
  await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  let text = await page.locator("body").innerText();
  expectIncludes(text, "Today’s Follow-Up Queue", "dashboard title");
  expectIncludes(text, "Scattered Demo Mortgage Team", "workspace name");
  await screenshot(page, "dashboard-after-imports.png");

  await page.getByRole("link", { name: "Contacts", exact: true }).click();
  await page.waitForURL(/\/leads(?:$|\?)/, { timeout: 30000 });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Jordan", "imported contacts");
  await screenshot(page, "contacts-after-imports.png");
  await writeStep("Dashboard and contacts", "pass", "Imported contacts are visible in daily workspace views.");
}

async function outcomeButtonSmoke(page) {
  await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  const firstHref = await page.locator('article a[href^="/leads/"]').first().getAttribute("href");
  const opportunityId = firstHref?.match(/\/leads\/([^/?#]+)/)?.[1];
  if (!opportunityId) throw new Error("Could not identify first opportunity for outcome smoke test.");
  const before = await opportunitySnapshot(opportunityId);

  await page.getByRole("button", { name: "No reply" }).first().click();
  await page.waitForTimeout(2500);
  const after = await opportunitySnapshot(opportunityId);
  const beforeTouchCount = Number(before.pipeline_metadata?.touch_count ?? 0);
  const afterTouchCount = Number(after.pipeline_metadata?.touch_count ?? 0);

  if (after.status !== "contacted") throw new Error(`No reply did not set contacted status; got ${after.status}.`);
  if (after.pipeline_metadata?.last_outcome !== "no_response") throw new Error("No reply did not persist last_outcome=no_response.");
  if (afterTouchCount !== beforeTouchCount + 1) throw new Error(`No reply did not increment touch count from ${beforeTouchCount} to ${beforeTouchCount + 1}; got ${afterTouchCount}.`);
  if (!after.pipeline_metadata?.next_due_at || !after.next_follow_up_at) throw new Error("No reply did not schedule the next follow-up.");

  await screenshot(page, "outcome-no-reply.png");
  await writeStep("Outcome button", "pass", `No reply persisted status=${after.status}, touch_count=${afterTouchCount}, next_due_at=${after.pipeline_metadata.next_due_at}.`);
}

async function dailyDumpSmoke(page) {
  await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  const startedAt = new Date().toISOString();
  await page.locator('textarea[name="daily_dump"]').fill([
    "Drew Foster did not respond after I sent the app link.",
    "Jordan Irwin needs Adam to call tomorrow.",
    "Skyler Lopez booked a call for Monday.",
    "Unknown Borrower asked about a loan but I cannot match them.",
  ].join(" "));
  await page.getByRole("button", { name: "Apply updates" }).click();
  await expectText(page, "Applied 3 updates. 1 item need review.", 10000);

  const { data: updates, error: updatesError } = await supabase
    .from("activity_log")
    .select("metadata, created_at")
    .eq("organization_id", created.organizationId)
    .eq("event", "daily_dump_update_applied")
    .gte("created_at", startedAt)
    .order("created_at", { ascending: true });
  if (updatesError) throw updatesError;

  const outcomes = new Set((updates ?? []).map((row) => row.metadata?.outcome));
  for (const expectedOutcome of ["no_response", "needs_adam", "appointment_set"]) {
    if (!outcomes.has(expectedOutcome)) throw new Error(`Daily dump did not persist ${expectedOutcome}; got ${Array.from(outcomes).join(", ")}`);
  }

  const { data: unmatched, error: unmatchedError } = await supabase
    .from("activity_log")
    .select("metadata, created_at")
    .eq("organization_id", created.organizationId)
    .eq("event", "daily_dump_unmatched")
    .gte("created_at", startedAt)
    .order("created_at", { ascending: false })
    .limit(1);
  if (unmatchedError) throw unmatchedError;
  if (!unmatched?.[0]?.metadata?.items?.length) throw new Error("Daily dump did not log unmatched items.");

  await screenshot(page, "daily-dump-applied.png");
  await writeStep("Daily dump", "pass", "One-paragraph recap applied no-response, escalation, appointment, and unmatched review outcomes.");
}

async function mobileSmoke(context) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  await screenshot(page, "mobile-dashboard.png");
  await page.goto(`${appUrl}/imports`, { waitUntil: "networkidle" });
  await screenshot(page, "mobile-imports.png");
  const text = await page.locator("body").innerText();
  expectIncludes(text, "Imports", "mobile imports");
  await page.close();
  await writeStep("Mobile smoke", "pass", "Dashboard and imports render on mobile viewport.");
}

async function opportunitySnapshot(opportunityId) {
  const { data, error } = await supabase
    .from("lead_opportunities")
    .select("id, status, next_follow_up_at, pipeline_metadata")
    .eq("id", opportunityId)
    .single();
  if (error) throw error;
  return data;
}

async function persistenceAssertions() {
  const [
    contacts,
    opportunities,
    drafts,
    exclusions,
    rows,
    acceptedImports,
  ] = await Promise.all([
    supabase.from("contacts").select("id, email, phone, name").eq("organization_id", created.organizationId),
    supabase.from("lead_opportunities").select("id, contact_id").eq("organization_id", created.organizationId),
    supabase.from("message_drafts").select("id, contact_id").eq("organization_id", created.organizationId),
    supabase.from("contact_exclusions").select("id, email, phone, reason").eq("organization_id", created.organizationId),
    supabase.from("import_rows").select("id, review_status, proposed_action").eq("organization_id", created.organizationId),
    supabase.from("imports").select("id, workflow_status").eq("organization_id", created.organizationId).eq("workflow_status", "accepted"),
  ]);

  for (const result of [contacts, opportunities, drafts, exclusions, rows, acceptedImports]) {
    if (result.error) throw result.error;
  }

  if ((contacts.data?.length ?? 0) < 78) throw new Error(`Expected at least 78 active contacts after suppression and merge, got ${contacts.data?.length ?? 0}`);
  if ((opportunities.data?.length ?? 0) < 78) throw new Error(`Expected at least 78 opportunities after suppression and merge, got ${opportunities.data?.length ?? 0}`);
  if ((exclusions.data?.length ?? 0) < 7) throw new Error(`Expected at least 7 exclusions, got ${exclusions.data?.length ?? 0}`);
  if ((acceptedImports.data?.length ?? 0) !== created.importIds.length) throw new Error("Not all imports were accepted.");

  const stopContact = contacts.data?.find((contact) => contact.email === "stop@example.com" || contact.name === "Stop Person");
  if (stopContact) throw new Error("Suppressed Stop Person appeared as an active contact.");

  const emails = new Map();
  for (const contact of contacts.data ?? []) {
    if (!contact.email) continue;
    emails.set(contact.email, (emails.get(contact.email) ?? 0) + 1);
  }
  const duplicateEmails = Array.from(emails.entries()).filter(([, count]) => count > 1);
  if (duplicateEmails.length) throw new Error(`Duplicate active emails found: ${duplicateEmails.map(([email]) => email).join(", ")}`);

  await writeStep("Persistence assertions", "pass", `${contacts.data?.length ?? 0} contacts, ${opportunities.data?.length ?? 0} opportunities, ${exclusions.data?.length ?? 0} exclusions.`);
}

async function expectText(page, text, timeout = 30000) {
  await page.locator("body").getByText(text, { exact: false }).waitFor({ timeout });
}

async function importCounts(importId) {
  const { data, error } = await supabase.from("import_rows").select("review_status, proposed_action").eq("import_id", importId);
  if (error) throw error;
  return {
    ready: data.filter((row) => row.review_status === "ready").length,
    needs_review: data.filter((row) => row.review_status === "needs_review").length,
    suppressed: data.filter((row) => row.review_status === "suppressed").length,
    merge: data.filter((row) => row.proposed_action === "merge").length,
    create: data.filter((row) => row.proposed_action === "create").length,
  };
}

async function waitForImportAccepted(importId) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabase.from("imports").select("workflow_status").eq("id", importId).single();
    if (error) throw error;
    if (data.workflow_status === "accepted") return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Import ${importId} did not reach accepted status.`);
}

async function cleanup() {
  if (keepData || !created.organizationId) return;
  await supabase.from("organizations").delete().eq("id", created.organizationId);
  await writeStep("Cleanup", "pass", `Deleted QA organization ${created.organizationId}.`);
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(screenshotsDir, safeName(filename)), fullPage: true });
}

async function writeStep(name, status, detail) {
  report.push({ name, status, detail, at: new Date().toISOString() });
  console.log(`${status.toUpperCase()}: ${name} - ${detail}`);
}

async function writeReport(status) {
  const lines = [
    `# Self-Serve Import QA ${runId}`,
    "",
    `Status: **${status}**`,
    `App URL: ${appUrl}`,
    `Email: ${email}`,
    `Organization id: ${created.organizationId || "not created"}`,
    `Import ids: ${created.importIds.join(", ") || "none"}`,
    `Cleanup: ${keepData ? "kept QA data" : "deleted QA data"}`,
    "",
    "## Steps",
    "",
    ...report.map((step, index) => `${index + 1}. **${step.status.toUpperCase()} - ${step.name}** (${step.at})\n   ${step.detail}`),
    "",
    "## Artifacts",
    "",
    "- Screenshots: `screenshots/`",
  ];
  await fs.writeFile(path.join(reportDir, "REPORT.md"), lines.join("\n"), "utf8");
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) throw new Error(`Expected ${label} to include "${needle}".`);
}

function safeName(value) {
  return value.replace(/[^a-z0-9._-]/gi, "-");
}

function cleanUrl(value) {
  return value.replace(/\/$/, "");
}

function loadDotEnv(file) {
  try {
    const content = readFileSync(file, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      if (process.env[key]) continue;
      process.env[key] = raw.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // Local env is optional for deployed QA runs.
  }
}
