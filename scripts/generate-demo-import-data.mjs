import fs from "node:fs";
import path from "node:path";

const outDir = path.resolve("demo-import-data/pipeline-recovery-os-demo");
fs.mkdirSync(outDir, { recursive: true });

const firstNames = ["Avery", "Jordan", "Taylor", "Morgan", "Riley", "Casey", "Parker", "Cameron", "Quinn", "Reese", "Skyler", "Rowan", "Drew", "Harper", "Logan", "Emerson", "Sage", "Finley", "Hayden", "Kendall"];
const lastNames = ["Bennett", "Carter", "Diaz", "Ellis", "Foster", "Garcia", "Hughes", "Irwin", "Johnson", "Kim", "Lopez", "Miller", "Nguyen", "Owens", "Patel", "Reed", "Shah", "Turner", "Vasquez", "Williams"];
const sources = ["Facebook message", "Open house", "Website form", "Zillow inquiry", "Realtor referral", "Past client referral", "Text message", "Old CRM", "Instagram DM", "Home valuation page"];
const areas = ["Cypress", "Katy", "Spring Branch", "The Heights", "Pearland", "Sugar Land", "Tomball", "Energy Corridor", "Memorial", "Clear Lake"];
const statuses = [
  "new inbound / referral",
  "contacted once, no appointment",
  "buyer lead went quiet",
  "seller valuation requested",
  "application link sent",
  "pre-approval docs needed",
  "not ready due to credit",
  "past client check-in",
  "open house follow-up missed",
  "listing consult not scheduled",
];

function lead(index) {
  const first = firstNames[index % firstNames.length];
  const last = lastNames[(index * 7) % lastNames.length];
  const source = sources[index % sources.length];
  const area = areas[(index * 3) % areas.length];
  const status = statuses[(index * 5) % statuses.length];
  const phone = `713555${String(1000 + index).slice(-4)}`;
  const email = `${first}.${last}.${index}@example.com`.toLowerCase();
  const budget = 280000 + (index % 18) * 25000;
  const owner = index % 3 === 0 ? "Adam" : index % 3 === 1 ? "Janine" : "Avery";
  const date = `05/${String((index % 24) + 1).padStart(2, "0")}/2026`;
  const intent = index % 4 === 0 ? "buyer" : index % 4 === 1 ? "seller" : index % 4 === 2 ? "past client" : "referral";
  const notes = [
    `${first} asked about ${area} and budget around $${budget.toLocaleString()}.`,
    `Source was ${source}. Current status: ${status}.`,
    index % 6 === 0 ? "They replied by text, then went quiet after one follow-up." : "No clear next step logged after the initial conversation.",
    index % 11 === 0 ? "Consent is unclear from old CRM export." : "Opt-in or relationship source appears acceptable.",
  ].join(" ");
  return { index, first, last, name: `${first} ${last}`, email, phone, source, area, status, budget, owner, date, intent, notes };
}

const leads = Array.from({ length: 100 }, (_, index) => lead(index + 1));

writeCsv("crm-export-40.csv", leads.slice(0, 40).map((item, idx) => ({
  "Full Name": idx === 8 ? "" : item.name,
  "Email Address": idx === 14 ? "" : item.email,
  "Mobile Phone": idx === 22 ? "" : formatPhone(item.phone),
  "Lead Source": item.source,
  "Current Status": item.status,
  "Area": item.area,
  "Budget": `$${item.budget}`,
  "Last Contact": item.date,
  "Assigned Agent": item.owner,
  "Notes": item.notes,
  "Consent": idx === 10 ? "review" : "opt-in",
})));

writeCsv("facebook-open-house-30.csv", leads.slice(40, 70).map((item, idx) => ({
  "contact": item.name,
  "phone": idx % 7 === 0 ? "" : formatPhone(item.phone),
  "email": item.email,
  "origin": idx % 2 === 0 ? "Facebook message" : "Open house sign-in",
  "message": `${item.first}: ${item.notes}`,
  "when": item.date,
  "agent": item.owner,
})));

writeText("text-message-notes-20.txt", leads.slice(70, 90).map((item, idx) => {
  const missingEmail = idx % 5 === 0 ? "" : ` ${item.email}`;
  return `${item.name}${missingEmail} ${formatPhone(item.phone)}
${item.date} - ${item.source}. ${item.notes}
${idx % 4 === 0 ? "Follow-up: texted again, no response." : "Follow-up: asked for updated listings and timing."}`;
}).join("\n\n"));

writeText("seller-valuation-notes-10.txt", leads.slice(90, 100).map((item, idx) => {
  return `${item.name} | ${idx % 3 === 0 ? "" : item.email} | ${formatPhone(item.phone)}
Seller valuation lead from ${item.area}. Asked what their home could sell for. Last touched ${item.date}. ${idx % 2 === 0 ? "Needs fresh CMA follow-up." : "Mentioned possible move in 6 months."}`;
}).join("\n\n"));

const updates = [
  ...leads.slice(5, 30).map((item, idx) => ({
    name: item.name,
    email: item.email,
    phone: formatPhone(item.phone),
    source: item.source,
    "current status": idx % 3 === 0 ? "replied after old follow-up" : idx % 3 === 1 ? "appointment requested" : "still looking, needs listings",
    "last meaningful contact": `05/${String(25 + (idx % 5)).padStart(2, "0")}/2026`,
    owner: idx % 2 === 0 ? "Janine" : item.owner,
    notes: idx % 3 === 1
      ? "Duplicate lead update: asked to schedule a buyer consult this week."
      : "Duplicate lead update: added new message context and changed timing.",
    consent: "opt-in",
  })),
  ...Array.from({ length: 10 }, (_, idx) => {
    const item = lead(101 + idx);
    return {
      name: item.name,
      email: item.email,
      phone: formatPhone(item.phone),
      source: idx % 2 === 0 ? "New Facebook lead" : "New seller form",
      "current status": idx % 2 === 0 ? "new inbound / referral" : "seller valuation requested",
      "last meaningful contact": "05/30/2026",
      owner: "Avery",
      notes: `New lead after first import. ${item.notes}`,
      consent: "opt-in",
    };
  }),
];
writeCsv("journey-update-import-35.csv", updates);

const exclusions = [
  leads[7], leads[12], leads[21], leads[44], leads[57], leads[75], leads[92],
].map((item, idx) => `${item.name} ${idx % 2 === 0 ? item.email : formatPhone(item.phone)} - ${idx % 3 === 0 ? "STOP / do not contact" : idx % 3 === 1 ? "closed with another agent, no follow-up" : "bad number / invalid contact"}`);
exclusions.push("Unknown Bad Lead 832-555-9999 - unsubscribe, DNC");
exclusions.push("Morgan Example morgan.closed@example.com - funded elsewhere, do not include");
writeText("raw-exclusions-dnc-closed.txt", exclusions.join("\n"));

writeText("README.md", `# Pipeline Recovery OS Demo Import Data

This folder is a scattered-data demo pack.

First import set: 100 records across:
- crm-export-40.csv
- facebook-open-house-30.csv
- text-message-notes-20.txt
- seller-valuation-notes-10.txt

Second import:
- journey-update-import-35.csv
Contains 25 duplicate leads with new journey updates plus 10 new leads.

Exclusions:
- raw-exclusions-dnc-closed.txt
Contains DNC, closed/no-follow-up, bad contact, and records that match first-import leads.

All records are synthetic and safe for demos.
`);

console.log(`Wrote demo data to ${outDir}`);

function writeCsv(filename, rows) {
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  writeText(filename, csv);
}

function writeText(filename, text) {
  fs.writeFileSync(path.join(outDir, filename), text.endsWith("\n") ? text : `${text}\n`, "utf8");
}

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function formatPhone(phone) {
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
}
