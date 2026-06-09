export function SignupForm() {
  return (
    <form action="/auth/demo-login" method="post" className="space-y-4">
      <input type="hidden" name="next" value="/dashboard" />
      <label className="block text-sm font-medium text-zinc-800" htmlFor="signup-email">
        Work email
      </label>
      <input
        id="signup-email"
        name="email"
        type="email"
        required
        placeholder="you@example.com"
        className="h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
      />
      <button
        type="submit"
        className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Enter my workspace
      </button>
      <p className="text-sm leading-6 text-zinc-500">
        Demo mode: enter any email and you’ll land on your own workspace instantly — no password, no verification.
      </p>
    </form>
  );
}
