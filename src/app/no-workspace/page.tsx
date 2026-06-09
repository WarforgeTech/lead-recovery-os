import { signOut } from "@/app/actions";
import { Card, PrimaryLink } from "@/components/ui";

export default function NoWorkspacePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <Card className="max-w-lg">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">No workspace assigned</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This login is valid, but it is not attached to a Pipeline Recovery OS workspace yet. You can create one now
          and start by importing your inactive lead file.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <PrimaryLink href="/onboarding/profile">Create workspace</PrimaryLink>
          <form action={signOut}>
            <button className="h-11 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50">
              Sign out
            </button>
          </form>
        </div>
      </Card>
    </main>
  );
}
