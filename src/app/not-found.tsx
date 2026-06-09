import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">404</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          That page doesn’t exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block h-10 rounded-md bg-zinc-950 px-4 text-sm font-medium leading-10 text-white hover:bg-zinc-800"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
