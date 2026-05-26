"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=/dashboard`;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-zinc-800" htmlFor="email">
        Email address
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        className="h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
      />
      <button
        type="submit"
        disabled={loading}
        className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Sending..." : "Send magic link"}
      </button>
      {sent ? <p className="text-sm leading-6 text-emerald-700">Check your email for a secure login link.</p> : null}
      {error ? <p className="text-sm leading-6 text-rose-700">{error}</p> : null}
    </form>
  );
}
