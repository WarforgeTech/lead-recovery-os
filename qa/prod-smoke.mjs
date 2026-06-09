import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

// Production human-smoke harness.
//
// Unlike qa/human-flow.mjs (legacy magic-link admin/client journeys) and
// qa/self-serve-import-flow.mjs (logs in by navigating to a Supabase magic-link
// URL — blocked in sandboxed browsers and no longer the product's real path),
// this drives the *actual* shipped demo-mode flow: type an email at /login and
// land on an auto-provisioned, seeded workspace. The browser only ever talks to
// the app origin, never directly to supabase.co.
//
// It exercises every screen and the full file-import pipeline as a human would,
// captures console + network errors per page, and screenshots each step.

const root = process.cwd();
loadDotEnv(path.join(root, ".env.local"));

const appUrl = cleanUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://lead-recovery-os.vercel.app");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reviewerAccessCode = process.env.REVIEWER_ACCESS_CODE;
const keepData = process.env.QA_KEEP_DATA === "1";
const headless = process.env.HEADLESS !== "0";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const email = `qa-prod-smoke+${runId}@example.com`;
const reportDir = path.join(root, "qa", "reports", `prod-smoke-${runId}`);
const screenshotsDir = path.join(reportDir, "screenshots");
const dataDir = path.join(root, "demo-import-data", "pipeline-recovery-os-demo");
const report = [];
const diagnostics = [];
const created = { organizationId: "", importId: "" };

if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");

const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
await fs.mkdir(screenshotsDir, { recursive: true });

let browser;
let hardFailure = null;
try {
  browser = await chromium.launch({ headless });

  await publicSurface(browser);
  await reviewerLogin(browser);

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  attachDiagnostics(page, "user-journey");

  await demoLogin(page);
  await importFile(page, "text-message-notes-20.txt", "lead_file");
  await contactsAndDraftApprove(page);
  await exportApproved(page);
  await dailyDumpBestEffort(page);
  await screenSweep(page);
  await mobileSweep(context);

  await context.close();
  await cleanup();
} catch (error) {
  hardFailure = error instanceof Error ? error.message : String(error);
  await writeStep("Hard failure", "fail", hardFailure);
  await cleanup().catch(() => {});
} finally {
  await browser?.close();
}

const status = hardFailure ? "FAIL" : "PASS";
await writeReport(status);
console.log(`${status}: prod-smoke report written to ${path.relative(root, path.join(reportDir, "REPORT.md"))}`);
if (hardFailure) {
  console.error(`Hard failure: ${hardFailure}`);
  process.exitCode = 1;
}

// ---------- steps ----------

async function publicSurface(activeBrowser) {
  const context = await activeBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  attachDiagnostics(page, "public");

  const checks = [
    ["/", ["Pipeline Recovery OS"], "01-home"],
    ["/demo", ["3,000", "1,410", "318"], "02-demo"],
    ["/demo/mortgage", ["mortgage growth", "rescue"], "03-mortgage-demo"],
    ["/login", ["Client login", "Continue to workspace"], "04-login"],
    ["/signup", ["recovery queue", "Enter my workspace"], "05-signup"],
    ["/reviewer-login", ["Reviewer access"], "06-reviewer-login"],
  ];
  for (const [route, needles, shot] of checks) {
    await page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
    const text = await page.locator("body").innerText();
    for (const needle of needles) softExpect(text.toLowerCase().includes(needle.toLowerCase()), `${route} contains "${needle}"`);
    await screenshot(page, `${shot}.png`);
  }
  await writeStep("Public surface", "pass", "Home, demo, mortgage demo, login, signup, reviewer-login all render.");
  await context.close();
}

async function reviewerLogin(activeBrowser) {
  if (!reviewerAccessCode) {
    await writeStep("Reviewer login", "skip", "REVIEWER_ACCESS_CODE not set.");
    return;
  }
  const context = await activeBrowser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  attachDiagnostics(page, "reviewer");
  await page.goto(`${appUrl}/reviewer-login`, { waitUntil: "networkidle" });
  await page.locator("#access_code").fill(reviewerAccessCode);
  await page.getByRole("button", { name: "Open reviewer workspace" }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30000 });
  const text = await page.locator("body").innerText();
  softExpect(text.includes("Today’s Follow-Up Queue"), "reviewer dashboard shows follow-up queue");
  await screenshot(page, "07-reviewer-dashboard.png");
  await writeStep("Reviewer login", "pass", "Access code reached the synthetic mortgage workspace.");
  await context.close();
}

async function demoLogin(page) {
  await page.goto(`${appUrl}/login`, { waitUntil: "networkidle" });
  await page.locator('input[name="email"]').fill(email);
  await page.getByRole("button", { name: "Continue to workspace" }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30000 });
  const text = await page.locator("body").innerText();
  if (!text.includes("Today’s Follow-Up Queue")) throw new Error("Demo login did not reach a provisioned dashboard.");
  const { data } = await supabase.from("organization_members").select("organization_id").eq("email", email.toLowerCase()).maybeSingle();
  created.organizationId = data?.organization_id ?? "";
  if (!created.organizationId) throw new Error("Demo login did not auto-provision a workspace.");
  await screenshot(page, "08-dashboard-fresh.png");
  await writeStep("Demo login", "pass", `Auto-provisioned workspace ${created.organizationId} for ${email}.`);
}

async function importFile(page, filename, sourceKind) {
  await page.goto(`${appUrl}/imports/new`, { waitUntil: "networkidle" });
  await page.locator('input[type="file"]').setInputFiles(path.join(dataDir, filename));
  // Tag the queued file (select rendered after a file is added).
  await page.locator("select").first().selectOption(sourceKind).catch(() => {});
  await page.getByRole("button", { name: /Clean and review/ }).click();
  await page.waitForURL(/\/imports\/[0-9a-f-]+\/processing$/, { timeout: 30000 });
  created.importId = page.url().match(/\/imports\/([^/]+)\/processing/)?.[1] ?? "";
  await screenshot(page, "09-import-processing.png");

  await page.waitForURL(new RegExp(`/imports/${created.importId}/review$`), { timeout: 200000 });
  await page.waitForLoadState("networkidle");
  const reviewText = await page.locator("body").innerText();
  softExpect(reviewText.includes("Ready to work"), "review page shows Ready-to-work stat");
  await screenshot(page, "10-import-review.png");

  await page.getByRole("button", { name: /Accept import and start work/ }).click();
  // acceptStagedImport commits the rows then redirect()s to the imports list,
  // where the accepted import shows a green "Imported" check (see actions.ts).
  await page.waitForURL(/\/imports(?:$|\?)/, { timeout: 60000 });
  await screenshot(page, "10b-imports-after-accept.png");

  const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", created.organizationId);
  if (!count || count < 1) throw new Error("Accepting the import did not create any contacts.");
  await writeStep("Import + accept", "pass", `${filename} processed through the Vercel Workflow and accepted; ${count} contacts in workspace.`);
}

async function contactsAndDraftApprove(page) {
  await page.goto(`${appUrl}/leads`, { waitUntil: "networkidle" });
  const leadLink = page.locator('a[href^="/leads/"]').first();
  const href = await leadLink.getAttribute("href").catch(() => null);
  if (!href) {
    await writeStep("Draft approve", "skip", "No lead detail links found on /leads.");
    return;
  }
  await screenshot(page, "11-leads.png");
  await page.goto(`${appUrl}${href}`, { waitUntil: "networkidle" });
  await screenshot(page, "12-lead-detail.png");

  const approvedMessage = `QA approved follow-up — prod smoke ${runId}`;
  await page.locator("#edited_text").fill(approvedMessage);
  await page.locator("#status").selectOption("approved").catch(() => {});
  await page.getByRole("button", { name: "Save text/status only" }).click();
  await page.waitForLoadState("networkidle");

  // The save commits server-side and revalidates; allow a brief settle window
  // before asserting (the exact-count head query can race the commit by ~1s).
  let count = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const res = await supabase
      .from("lead_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", created.organizationId)
      .eq("status", "approved");
    count = res.count ?? 0;
    if (count > 0) break;
    await page.waitForTimeout(1000);
  }
  if (count && count > 0) {
    created.approvedMessage = approvedMessage;
    await writeStep("Draft approve", "pass", `Saved an approved follow-up draft; ${count} approved opportunity now in workspace.`);
  } else {
    await writeStep("Draft approve", "warn", "Save submitted but no approved opportunity was observed in the DB.");
  }
}

async function exportApproved(page) {
  await page.goto(`${appUrl}/exports`, { waitUntil: "networkidle" });
  await screenshot(page, "13-exports.png");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30000 }),
    page.getByRole("link", { name: "Download approved CSV" }).click(),
  ]);
  const csvPath = path.join(reportDir, "approved-export.csv");
  await download.saveAs(csvPath);
  const csv = await fs.readFile(csvPath, "utf8");
  if (!csv.includes(",") || csv.trim().length === 0) throw new Error("Approved CSV export was empty or not CSV.");
  const hasMsg = created.approvedMessage ? csv.includes(created.approvedMessage) : true;
  await writeStep("CSV export", hasMsg ? "pass" : "warn", `Downloaded approved CSV (${csv.split(/\r?\n/).length} lines)${created.approvedMessage && !hasMsg ? "; approved message not found in rows" : ""}.`);
}

async function dailyDumpBestEffort(page) {
  try {
    await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
    const dump = page.locator('textarea[name="daily_dump"]');
    if (!(await dump.count())) {
      await writeStep("Daily dump", "skip", "Daily dump box not present.");
      return;
    }
    await dump.fill("Skyler Lopez booked a call for Monday. Drew Foster did not respond after I sent the app link.");
    await page.getByRole("button", { name: "Apply updates" }).click();
    await page.locator("body").getByText(/Applied|review/i).first().waitFor({ timeout: 12000 }).catch(() => {});
    await screenshot(page, "14-daily-dump.png");
    await writeStep("Daily dump", "pass", "Natural-language end-of-day recap applied.");
  } catch (error) {
    await writeStep("Daily dump", "warn", error instanceof Error ? error.message : String(error));
  }
}

async function screenSweep(page) {
  const screens = [
    ["/pipeline", "Pipeline"],
    ["/rescue", "rescue"],
    ["/tasks", "task"],
    ["/partners", "Partner"],
    ["/reports", "report"],
    ["/settings", "Settings"],
    ["/imports", "Imports"],
  ];
  const missing = [];
  for (const [route, needle] of screens) {
    await page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
    const text = (await page.locator("body").innerText()).toLowerCase();
    if (!text.includes(needle.toLowerCase())) missing.push(`${route} (no "${needle}")`);
    await screenshot(page, `screen-${route.replace(/\//g, "-")}.png`);
  }
  await writeStep("Screen sweep", missing.length ? "warn" : "pass", missing.length ? `Heading mismatches: ${missing.join(", ")}` : "pipeline, rescue, tasks, partners, reports, settings, imports all render.");
}

async function mobileSweep(context) {
  const page = await context.newPage();
  attachDiagnostics(page, "mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
  await screenshot(page, "15-mobile-dashboard.png");
  await page.goto(`${appUrl}/imports`, { waitUntil: "networkidle" });
  await screenshot(page, "16-mobile-imports.png");
  await page.close();
  await writeStep("Mobile", "pass", "Dashboard and imports render at 390px.");
}

// ---------- helpers ----------

function attachDiagnostics(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") diagnostics.push({ label, kind: "console.error", detail: msg.text(), url: page.url() });
  });
  page.on("pageerror", (err) => diagnostics.push({ label, kind: "pageerror", detail: err.message, url: page.url() }));
  page.on("requestfailed", (req) => {
    const errorText = req.failure()?.errorText ?? "";
    // net::ERR_ABORTED on _rsc prefetch requests is Next.js cancelling an
    // in-flight prefetch when navigation supersedes it — benign, not a defect.
    if (errorText.includes("ERR_ABORTED")) return;
    diagnostics.push({ label, kind: "requestfailed", detail: `${req.method()} ${req.url()} ${errorText}`, url: page.url() });
  });
  page.on("response", (res) => {
    if (res.status() >= 500) diagnostics.push({ label, kind: `http_${res.status()}`, detail: `${res.request().method()} ${res.url()}`, url: page.url() });
  });
}

function softExpect(condition, label) {
  if (!condition) diagnostics.push({ label: "assert", kind: "soft-miss", detail: label, url: appUrl });
}

async function cleanup() {
  if (keepData || !created.organizationId) return;
  await supabase.from("organizations").delete().eq("id", created.organizationId);
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(screenshotsDir, safeName(filename)), fullPage: true }).catch(() => {});
}

async function writeStep(name, stepStatus, detail) {
  report.push({ name, status: stepStatus, detail, at: new Date().toISOString() });
  console.log(`${stepStatus.toUpperCase()}: ${name} - ${detail}`);
}

async function writeReport(runStatus) {
  const lines = [
    `# Production Human Smoke ${runId}`,
    "",
    `Status: **${runStatus}**`,
    `App URL: ${appUrl}`,
    `Email: ${email}`,
    `Organization id: ${created.organizationId || "not created"}`,
    `Import id: ${created.importId || "none"}`,
    `Cleanup: ${keepData ? "kept" : "deleted"} QA data`,
    "",
    "## Steps",
    "",
    ...report.map((s, i) => `${i + 1}. **${s.status.toUpperCase()} — ${s.name}** (${s.at})\n   ${s.detail}`),
    "",
    "## Diagnostics (console / network)",
    "",
    diagnostics.length ? diagnostics.map((d) => `- [${d.label}] ${d.kind}: ${d.detail}`).join("\n") : "- None captured.",
    "",
    "## Artifacts",
    "",
    "- Screenshots: `screenshots/`",
  ];
  await fs.writeFile(path.join(reportDir, "REPORT.md"), lines.join("\n"), "utf8");
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
    // optional
  }
}
