"use client";

import { useState } from "react";

export function CopyDraftButton({ targetId }: Readonly<{ targetId: string }>) {
  const [copied, setCopied] = useState(false);

  async function copyDraft() {
    const target = document.getElementById(targetId);
    const text = target instanceof HTMLTextAreaElement ? target.value : "";
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyDraft}
      className="h-11 rounded-md border border-zinc-300 bg-white text-sm font-medium text-zinc-900 hover:bg-zinc-50"
    >
      {copied ? "Copied" : "Copy draft"}
    </button>
  );
}
