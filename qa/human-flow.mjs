import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
loadDotEnv(path.join(root, ".env.local"));

const appUrl = cleanUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://lead-recovery-os.vercel.app");
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.QA_ADMIN_EMAIL || "mark@warforge.tech";
const qaLoginSecret = process.env.QA_LOGIN_SECRET;
const vercelProtectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.VERCEL_PROTECTION_BYPASS;
const reviewerAccessCode = process.env.REVIEWER_ACCESS_CODE;
const keepData = process.env.QA_KEEP_DATA === "1";
const headless = process.env.HEADLESS !== "0";
const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const reportDir = path.join(root, "qa", "reports", runId);
const screenshotsDir = path.join(reportDir, "screenshots");
const report = [];
const created = { organizationId: "", importId: "", clientEmail: `qa-client+${runId}@pipeline-recovery.test` };

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

await fs.mkdir(screenshotsDir, { recursive: true });

let browser;
try {
  browser = await chromium.launch({ headless });
  await publicDemoCheck(browser);
  await reviewerLoginCheck(browser);
  await adminJourney(browser);
  await clientJourney(browser);
  await verifyPersistence();
  await cleanup();
  await writeReport("PASS");
  console.log(`PASS: QA report written to ${path.relative(root, path.join(reportDir, "REPORT.md"))}`);
} catch (error) {
  await writeStep("Failure", "fail", error instanceof Error ? error.message : String(error));
  await cleanup().catch((cleanupError) => {
    report.push({
      name: "Cleanup",
      status: "fail",
      detail: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      at: new Date().toISOString(),
    });
  });
  await writeReport("FAIL");
  console.error(`FAIL: QA report written to ${path.relative(root, path.join(reportDir, "REPORT.md"))}`);
  throw error;
} finally {
  await browser?.close();
}

async function publicDemoCheck(activeBrowser) {
  const context = await activeBrowser.newContext(contextOptions({ viewport: { width: 1440, height: 1000 } }));
  const page = await context.newPage();

  await page.goto(`${appUrl}/demo`, { waitUntil: "networkidle" });
  const text = await page.locator("body").innerText();
  expectIncludes(text, "Pipeline Recovery OS", "public demo brand");
  expectIncludes(text, "3,000", "contacts analyzed card");
  expectIncludes(text, "1,410", "reachable stale leads card");
  expectIncludes(text, "318", "priority opportunities card");
  expectIncludes(text, "$58K-$232K", "recoverable commission scenario");
  expectIncludes(text, "$1,500", "pilot economics");
  expectIncludes(text, "No outbound sending", "outbound guardrail");
  await screenshot(page, "01-public-demo.png");
  await writeStep("Public demo", "pass", "Verified pitch page, money cards, pilot economics, and guardrails.");

  await page.goto(`${appUrl}/login`, { waitUntil: "networkidle" });
  const loginText = await page.locator("body").innerText();
  expectIncludes(loginText, "Client login", "login page");
  expectIncludes(loginText, "magic link", "magic-link copy");
  await screenshot(page, "02-login.png");
  await writeStep("Login page", "pass", "Verified magic-link login page loads publicly.");

  await page.goto(`${appUrl}/demo/mortgage`, { waitUntil: "networkidle" });
  const mortgageDemoText = await page.locator("body").innerText();
  expectIncludes(mortgageDemoText, "Pipeline Recovery OS configured for mortgage growth", "mortgage demo headline");
  expectIncludes(mortgageDemoText, "2 applications/day", "mortgage applications target");
  expectIncludes(mortgageDemoText, "14/21-day rescue", "mortgage rescue copy");
  expectIncludes(mortgageDemoText, "CEO / broker rollup", "mortgage CEO rollup");
  expectIncludes(mortgageDemoText, "Synthetic demo data", "mortgage synthetic disclaimer");
  await screenshot(page, "03-mortgage-demo.png");
  await writeStep("Mortgage demo", "pass", "Verified mortgage public demo, application target, rescue framing, rollup, and synthetic disclaimer.");

  await context.close();
}

async function reviewerLoginCheck(activeBrowser) {
  if (!reviewerAccessCode) {
    await writeStep("Reviewer login", "pass", "Skipped because REVIEWER_ACCESS_CODE is not configured.");
    return;
  }

  const context = await activeBrowser.newContext(contextOptions({ viewport: { width: 1440, height: 1000 } }));
  const page = await context.newPage();

  await page.goto(`${appUrl}/reviewer-login`, { waitUntil: "networkidle" });
  let text = await page.locator("body").innerText();
  expectIncludes(text, "Reviewer access", "reviewer login page");
  await page.getByLabel("Access code").fill(reviewerAccessCode);
  await page.getByRole("button", { name: "Open reviewer workspace" }).click();
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30000 });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Vercel Reviewer Demo Team", "reviewer workspace dashboard");
  expectIncludes(text, "Monthly volume goal", "mortgage reviewer dashboard");
  expectIncludes(text, "Application conversion", "mortgage segment labels");
  await screenshot(page, "04-reviewer-login.png");

  await page.goto(`${appUrl}/pipeline`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Application Conversion Queue", "application conversion queue");
  expectIncludes(text, "Talked, no application", "talked no application metric");

  await page.goto(`${appUrl}/rescue`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "14/21-day rescue", "rescue page title");
  expectIncludes(text, "22+ days", "rescue bucket");

  await page.goto(`${appUrl}/tasks`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Assistant task view", "assistant task page");
  expectIncludes(text, "Missing docs", "missing docs task metric");

  await page.goto(`${appUrl}/partners`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Referral partner queue", "partner queue page");
  expectIncludes(text, "No referral-compensation language", "partner compliance copy");

  await page.goto(`${appUrl}/rollup`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "CEO / broker rollup", "rollup page");
  expectIncludes(text, "Before application / first step", "rollup leakage metric");

  await writeStep("Reviewer login", "pass", "Access-code reviewer login reached the mortgage workspace and verified pipeline, rescue, tasks, partners, and rollup.");

  await context.close();
}

async function adminJourney(activeBrowser) {
  const context = await activeBrowser.newContext(contextOptions({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }));
  const page = await context.newPage();
  await page.goto(await loginUrl(adminEmail, "/admin"), { waitUntil: "networkidle" });
  await page.waitForURL(/\/admin(?:$|\?)/, { timeout: 30000 });
  await screenshot(page, "05-admin-home.png");
  await writeStep("Admin login", "pass", `Admin magic link reached ${page.url()}.`);

  const orgName = `QA Pipeline Team ${runId}`;
  await page.getByRole("link", { name: "Create organization" }).click();
  await page.getByLabel("Organization name").fill(orgName);
  await page.getByLabel("Client email").fill(created.clientEmail);
  await page.getByLabel("Market").fill("Houston QA Market");
  await page.getByLabel("Client type").selectOption("broker");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.waitForURL(/\/admin\/organizations\/[0-9a-f-]+$/, { timeout: 30000 });
  created.organizationId = page.url().split("/").pop() || "";
  const orgText = await page.locator("body").innerText();
  expectIncludes(orgText, orgName, "created organization page");
  expectIncludes(orgText, created.clientEmail, "invited client member");
  await screenshot(page, "06-organization-created.png");
  await writeStep("Create organization", "pass", `Created ${orgName} with id ${created.organizationId}.`);

  await page.goto(`${appUrl}/admin/imports/new?organization_id=${created.organizationId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Process import" }).click();
  await page.waitForURL(/\/admin\/imports\/[0-9a-f-]+$/, { timeout: 30000 });
  created.importId = page.url().split("/").pop() || "";
  const importText = await page.locator("body").innerText();
  expectIncludes(importText, "Total rows", "import summary");
  expectIncludes(importText, "4", "four imported rows");
  expectIncludes(importText, "Processed contacts", "processed contacts stat");
  expectIncludes(importText, "Import audit trail", "import audit trail");
  expectIncludes(importText, "Raw import archived privately", "private import archive copy");
  expectIncludesLoose(importText, "Archive path", "archive path label");
  await screenshot(page, "07-import-summary.png");
  await writeStep("Import contacts", "pass", `Processed sample CRM CSV with import id ${created.importId}.`);

  await context.close();
}

async function clientJourney(activeBrowser) {
  const context = await activeBrowser.newContext(contextOptions({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }));
  const page = await context.newPage();
  await page.goto(await loginUrl(created.clientEmail, "/dashboard"), { waitUntil: "networkidle" });
  await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30000 });
  let text = await page.locator("body").innerText();
  expectIncludes(text, "QA Pipeline Team", "client dashboard organization");
  expectIncludes(text, "Imported contacts", "dashboard stats");
  await screenshot(page, "08-client-dashboard.png");
  await writeStep("Client login", "pass", "Invited client reached their workspace dashboard by magic link.");

  await page.getByRole("link", { name: "Leads" }).click();
  await page.waitForURL(/\/leads(?:$|\?)/, { timeout: 30000 });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Maria Gutierrez", "lead list imported contact");
  await screenshot(page, "09-leads-list.png");
  await writeStep("Lead list", "pass", "Client sees imported contacts in the lead table.");

  await page.getByRole("link", { name: "Maria Gutierrez" }).first().click();
  await page.waitForURL(/\/leads\/[0-9a-f-]+$/, { timeout: 30000 });
  const leadDetailUrl = page.url();
  await page.getByLabel("Draft").fill("QA approved follow-up: Maria, checking whether the school-year move is still active.");
  await page.getByLabel("Status").selectOption("approved");
  await page.getByRole("button", { name: "Save review state" }).click();
  await page.waitForLoadState("networkidle");
  await waitForApprovedDraft();
  await page.goto(`${leadDetailUrl}?fresh=${Date.now()}`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Approved", "approved status after save");
  const savedDraft = await page.getByLabel("Draft").inputValue();
  expectIncludes(savedDraft, "QA approved follow-up", "edited draft persisted on page");
  await screenshot(page, "10-approved-lead-detail.png");
  await writeStep("Approve draft", "pass", "Client edited the draft, approved it, reloaded, and saw the saved state.");

  await page.goto(`${appUrl}/exports`, { waitUntil: "networkidle" });
  text = await page.locator("body").innerText();
  expectIncludes(text, "Approved records", "exports page");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download approved CSV" }).click();
  const download = await downloadPromise;
  const csvPath = path.join(reportDir, "approved-follow-up-queue.csv");
  await download.saveAs(csvPath);
  const csv = await fs.readFile(csvPath, "utf8");
  expectIncludes(csv, "Maria Gutierrez", "approved CSV lead");
  expectIncludes(csv, "QA approved follow-up", "approved CSV edited message");
  await screenshot(page, "11-exports.png");
  await writeStep("Export queue", "pass", "Approved queue downloaded and contained the edited approved message.");

  await context.close();
}

async function verifyPersistence() {
  const [orgResult, importResult, contactsResult, opportunitiesResult, draftsResult] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", created.organizationId).single(),
    supabase.from("imports").select("id, total_rows, processed_rows, raw_storage_provider, raw_file_path").eq("id", created.importId).single(),
    supabase.from("contacts").select("id, name").eq("organization_id", created.organizationId),
    supabase.from("lead_opportunities").select("id, status").eq("organization_id", created.organizationId),
    supabase.from("message_drafts").select("id, approval_status, edited_text").eq("organization_id", created.organizationId),
  ]);

  for (const result of [orgResult, importResult, contactsResult, opportunitiesResult, draftsResult]) {
    if (result.error) throw result.error;
  }

  if (importResult.data.total_rows !== 4 || importResult.data.processed_rows !== 4) {
    throw new Error(`Import row counts were wrong: ${JSON.stringify(importResult.data)}`);
  }
  if (!importResult.data.raw_file_path || !["vercel_blob", "supabase"].includes(importResult.data.raw_storage_provider)) {
    throw new Error(`Import archive metadata was missing or invalid: ${JSON.stringify(importResult.data)}`);
  }
  if ((contactsResult.data || []).length !== 4) {
    throw new Error(`Expected 4 contacts, found ${(contactsResult.data || []).length}`);
  }
  if (!(draftsResult.data || []).some((draft) => draft.approval_status === "approved" && draft.edited_text?.includes("QA approved follow-up"))) {
    throw new Error("Approved edited draft was not persisted in Supabase.");
  }

  await writeStep(
    "Database persistence",
    "pass",
    `Verified org, archived import, 4 contacts, ${(opportunitiesResult.data || []).length} opportunities, and approved draft in Supabase.`,
  );
}

async function waitForApprovedDraft() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const { data, error } = await supabase
      .from("message_drafts")
      .select("id, approval_status, edited_text")
      .eq("organization_id", created.organizationId);
    if (error) throw error;
    if ((data || []).some((draft) => draft.approval_status === "approved" && draft.edited_text?.includes("QA approved follow-up"))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Approved edited draft did not persist within 15 seconds.");
}

async function cleanup() {
  if (!created.organizationId || keepData) {
    if (keepData && created.organizationId) {
      await writeStep("Cleanup", "pass", `QA_KEEP_DATA=1, kept organization ${created.organizationId}.`);
    }
    return;
  }
  const { error } = await supabase.from("organizations").delete().eq("id", created.organizationId);
  if (error) throw error;
  await writeStep("Cleanup", "pass", `Deleted QA organization ${created.organizationId}.`);
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
  return actionLink;
}

async function loginUrl(email, nextPath) {
  if (qaLoginSecret) {
    const url = new URL(`${appUrl}/auth/qa-login`);
    url.searchParams.set("secret", qaLoginSecret);
    url.searchParams.set("email", email);
    url.searchParams.set("next", nextPath);
    return url.toString();
  }
  return magicLink(email, nextPath);
}

async function screenshot(page, filename) {
  await page.screenshot({ path: path.join(screenshotsDir, filename), fullPage: true });
}

async function writeStep(name, status, detail) {
  report.push({ name, status, detail, at: new Date().toISOString() });
  console.log(`${status.toUpperCase()}: ${name} - ${detail}`);
}

async function writeReport(status) {
  const lines = [
    `# Human QA Run ${runId}`,
    "",
    `Status: **${status}**`,
    `App URL: ${appUrl}`,
    `Admin email: ${adminEmail}`,
    `Client email: ${created.clientEmail}`,
    `Organization id: ${created.organizationId || "not created"}`,
    `Import id: ${created.importId || "not created"}`,
    `Cleanup: ${keepData ? "kept QA data" : "deleted QA data"}`,
    "",
    "## Steps",
    "",
    ...report.map((step, index) => `${index + 1}. **${step.status.toUpperCase()} - ${step.name}** (${step.at})\n   ${step.detail}`),
    "",
    "## Artifacts",
    "",
    "- Screenshots: `screenshots/`",
    "- Approved CSV: `approved-follow-up-queue.csv` when export reached",
    "",
  ];
  await fs.writeFile(path.join(reportDir, "REPORT.md"), lines.join("\n"), "utf8");
}

function expectIncludes(text, needle, label) {
  if (!text.includes(needle)) {
    throw new Error(`Expected ${label} to include "${needle}".`);
  }
}

function expectIncludesLoose(text, needle, label) {
  if (!text.toLowerCase().includes(needle.toLowerCase())) {
    throw new Error(`Expected ${label} to include "${needle}".`);
  }
}

function contextOptions(options) {
  if (!vercelProtectionBypass) return options;
  return {
    ...options,
    extraHTTPHeaders: {
      ...(options.extraHTTPHeaders ?? {}),
      "x-vercel-protection-bypass": vercelProtectionBypass,
    },
  };
}

function cleanUrl(value) {
  return value.replace(/\/$/, "");
}

function loadDotEnv(file) {
  try {
    const content = requireFile(file);
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
    // .env.local is optional in deployed QA runs.
  }
}

function requireFile(file) {
  return readFileSync(file, "utf8");
}
