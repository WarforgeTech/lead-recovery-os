import { redirect } from "next/navigation";
import { signOut } from "@/app/actions";
import { Card, Shell } from "@/components/ui";
import { getMemberships, requireUser } from "@/lib/data";

export default async function SettingsPage() {
  const user = await requireUser();
  const memberships = await getMemberships();
  if (memberships.length === 0) redirect("/no-workspace");

  return (
    <Shell title="Settings">
      <Card>
        <h2 className="text-xl font-semibold tracking-tight">Account</h2>
        <div className="mt-4 text-sm leading-6 text-zinc-600">
          <div>Signed in as {user.email}</div>
          <div>{memberships.length} workspace membership{memberships.length === 1 ? "" : "s"}</div>
        </div>
        <form action={signOut} className="mt-6">
          <button className="h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50">
            Sign out
          </button>
        </form>
      </Card>
    </Shell>
  );
}
