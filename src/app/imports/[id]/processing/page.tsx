import { ImportProgress } from "@/components/import-progress";
import { Card, Shell } from "@/components/ui";
import { requireUser } from "@/lib/data";

export default async function ImportProcessingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;

  return (
    <Shell title="Cleaning your lead file">
      <Card className="mx-auto max-w-3xl">
        <p className="mb-2 text-sm font-medium text-zinc-900">
          Preparing your review — nothing has been added to your workspace yet.
        </p>
        <p className="mb-6 text-sm leading-6 text-zinc-600">
          A durable Vercel Workflow parses, scrubs, and stages your rows. Progress is saved server-side, so you can safely
          close this tab or lose connection and come back — it resumes where it left off. When it finishes, you’ll review
          the cleaned rows and choose which to add to your queue.
        </p>
        <ImportProgress importId={id} />
      </Card>
    </Shell>
  );
}
