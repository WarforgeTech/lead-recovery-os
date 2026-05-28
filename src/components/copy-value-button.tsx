"use client";

import { useState } from "react";

export function CopyValueButton({ value, label = "Copy message" }: Readonly<{ value: string; label?: string }>) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copyValue}
      className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
