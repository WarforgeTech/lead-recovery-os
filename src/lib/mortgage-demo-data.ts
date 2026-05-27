export const mortgageDemo = {
  monthlyGoal: "$3.0M",
  annualGoal: "$22M",
  applicationsPerDay: "2",
  applicationsPerWeek: "10",
  activePipeline: "$1.84M",
  gapToGoal: "$1.16M",
  borrowersAtRisk: "37",
  followUpsDue: "24",
};

export const mortgageQueues = [
  {
    name: "Application Conversion",
    count: 42,
    value: "$13.8M",
    action: "Borrowers who talked to a loan officer but have not completed the application.",
  },
  {
    name: "14/21-Day Rescue",
    count: 37,
    value: "$11.2M",
    action: "People inside or beyond the window where incomplete borrowers usually disappear.",
  },
  {
    name: "Assistant Tasks",
    count: 19,
    value: "$6.4M",
    action: "Missing docs, bank statements, signature help, and confused-borrower hand-holding.",
  },
  {
    name: "Referral Partners",
    count: 28,
    value: "Relationship",
    action: "Agents, attorneys, and past clients who need consistent relationship touches.",
  },
];

export const mortgageBorrowers = [
  {
    name: "Jordan Miles",
    stage: "Talked, no application",
    owner: "Adam",
    lastContact: "13 days ago",
    loanAmount: "$520K",
    whyNow: "Had purchase consult and asked for application link, but no application is complete.",
    nextStep: "Resend application link and offer help with first step.",
    draft:
      "Hi Jordan, Adam here. We talked about your purchase path, but I do not see the application finished yet. Want me to resend the link and help you get the first step knocked out?",
  },
  {
    name: "Taylor Reed",
    stage: "Application started",
    owner: "Janine",
    lastContact: "19 days ago",
    loanAmount: "$410K",
    whyNow: "Application started but borrower got stuck on income section.",
    nextStep: "Assistant follow-up before the file falls past 21 days.",
    draft:
      "Hi Taylor, this is Janine with Adam's team. It looks like the application was started but not finished. If the income section is confusing, I can help you get through it.",
  },
  {
    name: "Nina Alvarez",
    stage: "Docs missing",
    owner: "Janine",
    lastContact: "24 days ago",
    loanAmount: "$610K",
    whyNow: "Bank statements and signatures are blocking the file.",
    nextStep: "Walk through upload and e-signature process.",
    draft:
      "Hi Nina, Janine here. I saw the next step is bank statements and signatures. If anything about the upload is confusing, we can walk through it with you.",
  },
];
