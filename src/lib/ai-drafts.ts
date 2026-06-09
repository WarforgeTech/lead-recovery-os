import { generateText } from "ai";
import { gateway } from "@ai-sdk/gateway";

export type RefineDraftInput = {
  segment: string;
  source: string | null;
  area: string | null;
  priceRange: string | null;
  timeline: string | null;
  normalizedSummary: string | null;
  currentDraft: string;
};

export function aiDraftsEnabled() {
  return Boolean(
    process.env.ENABLE_AI_DRAFT_REFINEMENT === "1" &&
      process.env.AI_GATEWAY_API_KEY,
  );
}

export async function refineFollowUpDraft(input: RefineDraftInput) {
  if (!aiDraftsEnabled()) {
    throw new Error("AI Gateway is not configured.");
  }

  const result = await generateText({
    model: gateway("openai/gpt-5.5"),
    temperature: 0.3,
    system: [
      "You refine real estate lead follow-up drafts.",
      "Keep messages short, human, specific, and respectful.",
      "Never imply guaranteed closings, rates, pricing outcomes, or referral compensation.",
      "Do not mention AI, automation, CRM internals, or this software.",
      "Return only the final message body.",
    ].join(" "),
    prompt: [
      `Segment: ${input.segment}`,
      `Source: ${input.source ?? "not provided"}`,
      `Area: ${input.area ?? "not provided"}`,
      `Price range: ${input.priceRange ?? "not provided"}`,
      `Timeline: ${input.timeline ?? "not provided"}`,
      `Summary: ${input.normalizedSummary ?? "not provided"}`,
      "",
      "Current draft:",
      input.currentDraft,
      "",
      "Rewrite it as a better human-approved follow-up message. Keep it under 75 words.",
    ].join("\n"),
  });

  return {
    text: result.text.trim(),
    usage: await result.usage,
    finishReason: await result.finishReason,
  };
}
