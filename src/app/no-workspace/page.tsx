import { signOut } from "@/app/actions";
import { Card } from "@/components/ui";

export default function NoWorkspacePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <Card className="max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">No workspace assigned</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This login is valid, but it is not attached to a Pipeline Recovery OS workspace yet. Ask Mark to add this
          email to the client organization.
        </p>
        <form action={signOut} className="mt-6">
          <button className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50">
            Sign out
          </button>
        </form>
      </Card>
    </main>
  );
}
