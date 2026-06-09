import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
loadDotEnv(path.join(root, ".env.local"));
const appUrl = (process.env.APP_URL || "https://lead-recovery-os.vercel.app").replace(/\/$/, "");
const email = `qa-hydration-${Date.now()}@example.com`;

const errors = [];
const browser = await chromium.launch({ headless: process.env.HEADLESS !== "0" });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console.error: ${m.text()}`); });

// Real demo-mode login.
await page.goto(`${appUrl}/login`, { waitUntil: "networkidle" });
await page.locator('input[name="email"]').fill(email);
await page.getByRole("button", { name: "Continue to workspace" }).click();
await page.waitForURL(/\/dashboard(?:$|\?)/, { timeout: 30000 });

// Visit the views that render dates in client components.
for (const route of ["/dashboard", "/imports", "/leads"]) {
  await page.goto(`${appUrl}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
}
// Mobile dashboard too (where #418 also fired before).
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${appUrl}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

await browser.close();

const hydration = errors.filter((e) => /#418|#419|#423|hydrat/i.test(e));
console.log(`Total console/page errors: ${errors.length}`);
console.log(`Hydration-related errors: ${hydration.length}`);
for (const e of errors) console.log("  -", e);
if (hydration.length) {
  console.error("FAIL: hydration errors still present.");
  process.exitCode = 1;
} else {
  console.log("PASS: no hydration errors.");
}

function loadDotEnv(file) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
}
