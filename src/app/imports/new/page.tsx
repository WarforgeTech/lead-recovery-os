import { ImportLauncher } from "@/components/import-launcher";
import { Card, Shell } from "@/components/ui";
import { getActiveOrganizationId, requireUser } from "@/lib/data";
import { redirect } from "next/navigation";

export default async function NewSelfServeImportPage() {
  await requireUser();
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/onboarding/profile");

  return (
    <Shell title="Import leads">
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-950">How this works</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
            <p>Upload or paste the messy lead file. A durable Vercel Workflow handles parsing and cleanup in the background, so it keeps running even if you close this tab.</p>
            <p>Do-not-contact, opt-out, closed, and duplicate records are held out before drafts or queue items are created.</p>
            <p>You approve the cleaned import before anything enters Today’s Follow-Up Queue.</p>
          </div>
        </Card>
        <Card>
          <ImportLauncher organizationId={organizationId} />
        </Card>
      </div>
    </Shell>
  );
}
