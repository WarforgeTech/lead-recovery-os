import { Card, Shell, Skeleton } from "@/components/ui";

export default function LeadsLoading() {
  return (
    <Shell title="Contacts">
      <Card>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div className="w-full">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </Shell>
  );
}
