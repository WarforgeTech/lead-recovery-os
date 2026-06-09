"use client";

import { useFormStatus } from "react-dom";

// Gives every server-action form instant feedback: the moment the user clicks,
// the button shows a spinner and disables, instead of the page appearing frozen
// while the action runs. Must be rendered inside a <form>.
export function SubmitButton({
  children,
  className = "",
  pendingLabel,
  title,
}: Readonly<{ children: React.ReactNode; className?: string; pendingLabel?: string; title?: string }>) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      title={title}
      className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}
    >
      <span className="inline-flex items-center justify-center gap-1.5">
        {pending ? <Spinner /> : null}
        {pending && pendingLabel ? pendingLabel : children}
      </span>
    </button>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
