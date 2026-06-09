import { Card, Shell, Skeleton } from "@/components/ui";

export default function QueueLoading() {
  return (
    <Shell title="Next-best-action queue">
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-4 w-52" />
            <Skeleton className="mt-3 h-3 w-full max-w-lg" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </Card>
        ))}
      </div>
    </Shell>
  );
}
