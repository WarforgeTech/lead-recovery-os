import { Card, Shell, Skeleton } from "@/components/ui";

// Streamed instantly while the dashboard's per-user Supabase data loads, so the
// shell (nav + heading) paints immediately instead of the page feeling frozen.
export default function DashboardLoading() {
  return (
    <Shell title="Today’s Follow-Up Queue">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-16" />
          </Card>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-3 w-full max-w-md" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </Card>
        ))}
      </div>
    </Shell>
  );
}
