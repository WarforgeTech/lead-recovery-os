import Link from "next/link";
import { Card } from "@/components/ui";

export default async function ReviewerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <Card className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          Pipeline Recovery OS
        </Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">Reviewer access</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Use the reviewer access code Mark provided. This opens a synthetic workspace with demo CRM data and no
          outbound messaging.
        </p>
        <form action="/auth/reviewer-login" method="post" className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-800" htmlFor="access_code">
            Access code
          </label>
          <input
            id="access_code"
            name="access_code"
            type="password"
            required
            autoComplete="off"
            className="h-11 w-full rounded-md border border-zinc-300 px-3 text-zinc-950 outline-none focus:border-zinc-900"
          />
          <button
            type="submit"
            className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Open reviewer workspace
          </button>
          {params.error ? (
            <p className="text-sm leading-6 text-rose-700">That access code did not work. Check the code and try again.</p>
          ) : null}
        </form>
      </Card>
    </main>
  );
}
