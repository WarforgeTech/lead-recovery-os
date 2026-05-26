import type { ConsentStatus, LeadSegment } from "./types";

export type DemoLead = {
  id: string;
  name: string;
  segment: LeadSegment;
  source: string;
  lastContact: string;
  timeline: string;
  priceRange: string;
  consent: ConsentStatus;
  summary: string;
  nextAction: string;
  draft: string;
};

export const grossCommissionSide = 8300;
export const pilotPrice = 1500;

export const demoSegments = [
  {
    id: "hot_reactivation" as const,
    label: "Hot reactivation",
    count: 318,
    estimatedValue: "$58K-$232K",
    action: "Call first, then send soft re-entry text/email after approval.",
    compliance: "Consent present. Human approval required before outbound.",
  },
  {
    id: "old_buyer" as const,
    label: "Old buyers",
    count: 684,
    estimatedValue: "$34K-$113K",
    action: "Ask if the move is still active, delayed, or off the table.",
    compliance: "Avoid mass SMS. Confirm opt-in and source before sending.",
  },
  {
    id: "old_seller" as const,
    label: "Old sellers",
    count: 286,
    estimatedValue: "$24K-$66K",
    action: "Offer a current home-value check-in and local inventory update.",
    compliance: "No pricing promises. Agent reviews every market statement.",
  },
  {
    id: "past_client" as const,
    label: "Past clients",
    count: 412,
    estimatedValue: "$17K-$50K",
    action: "Request review, referral, or annual equity check-in.",
    compliance: "Keep it relational. No referral-compensation language.",
  },
  {
    id: "referral_ask" as const,
    label: "Referral asks",
    count: 128,
    estimatedValue: "$8K-$33K",
    action: "Send personal check-in to lenders, vendors, and past introducers.",
    compliance: "Do not imply paid referral exchange.",
  },
  {
    id: "needs_consent" as const,
    label: "Needs consent",
    count: 181,
    estimatedValue: "Hold",
    action: "Exclude from outbound until status is confirmed.",
    compliance: "Do not message. Review source, consent, and suppression rules.",
  },
];

export const demoLeads: DemoLead[] = [
  {
    id: "lead-001",
    name: "Maria Gutierrez",
    segment: "hot_reactivation",
    source: "Open house: Cypress Creek listing",
    lastContact: "94 days ago",
    timeline: "Wanted to move before new school year",
    priceRange: "$390K-$460K buyer",
    consent: "ok",
    summary: "Attended two open houses, asked about Spring Branch and Cypress schools, then stopped replying after a lender intro.",
    nextAction: "Soft re-entry plus direct call task for the agent.",
    draft: "Hi Maria, it is Avery. I was looking back at my notes from the Cypress Creek open house and saw you were trying to time a move around the school year. Are you still exploring that, or did you decide to pause?",
  },
  {
    id: "lead-002",
    name: "Daniel Brooks",
    segment: "hot_reactivation",
    source: "Website valuation form",
    lastContact: "127 days ago",
    timeline: "Considering listing after repairs",
    priceRange: "$515K likely seller",
    consent: "ok",
    summary: "Requested home value estimate in Katy, mentioned roof repair and wanted to compare spring timing against late summer.",
    nextAction: "Send home-value check-in with one specific market observation.",
    draft: "Hi Daniel, Avery here. You had asked about timing a Katy listing after the roof work. Inventory has shifted since then, and I can update the estimate if that is still on your mind. Want me to run a fresh quick look?",
  },
  {
    id: "lead-003",
    name: "Priya Shah",
    segment: "old_buyer",
    source: "Zillow inquiry",
    lastContact: "211 days ago",
    timeline: "Six to nine month buyer",
    priceRange: "$310K-$360K buyer",
    consent: "review",
    summary: "Asked about townhomes near Energy Corridor, had a lease ending later in the year, and requested HOA comparison notes.",
    nextAction: "Confirm consent source, then send still-looking message.",
    draft: "Hi Priya, this is Avery. We talked last year about townhomes near the Energy Corridor and HOA costs. Are you still planning a move this year, or did the timing change?",
  },
  {
    id: "lead-004",
    name: "Andre Wallace",
    segment: "old_seller",
    source: "Past listing consultation",
    lastContact: "319 days ago",
    timeline: "Paused after job uncertainty",
    priceRange: "$610K likely seller",
    consent: "ok",
    summary: "Had a seller consult in The Woodlands, delayed because of work travel, and asked for a follow-up once rates settled.",
    nextAction: "Call, then send valuation refresh if no answer.",
    draft: "Hi Andre, it is Avery. You had paused the Woodlands move because of work timing. I can refresh the value range against current inventory if selling is back on the table.",
  },
  {
    id: "lead-005",
    name: "Lisa Nguyen",
    segment: "past_client",
    source: "Closed buyer 2023",
    lastContact: "438 days ago",
    timeline: "Past client",
    priceRange: "$8.3K referral-side scenario",
    consent: "ok",
    summary: "Closed on a first home in 2023. No annual check-in, review ask, or referral touch logged since move-in.",
    nextAction: "Personal anniversary check-in and referral ask, no hard pitch.",
    draft: "Hi Lisa, Avery here. I was thinking about your first year in the house and wanted to check in. How has the place been treating you? Also, if anyone you trust is starting to think about a move, I would be grateful for the intro.",
  },
];
