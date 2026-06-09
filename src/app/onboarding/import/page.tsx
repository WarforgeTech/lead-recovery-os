import { redirect } from "next/navigation";
import { ImportLauncher } from "@/components/import-launcher";
import { Card } from "@/components/ui";
import { getActiveOrganizationId, requireUser } from "@/lib/data";

export default async function OnboardingImportPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/onboarding/profile");

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-zinc-500">First import</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950">Add your inactive leads</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600">
          Paste a messy list or upload a file. The worker will clean it, scrub exclusions, reconstruct lead journeys, and prepare a review queue before anything goes live.
        </p>
        <Card className="mt-6">
          <ImportLauncher organizationId={organizationId} onboarding />
        </Card>
      </div>
    </main>
  );
}
