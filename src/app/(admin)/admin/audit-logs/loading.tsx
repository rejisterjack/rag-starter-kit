import { Skeleton } from '@/components/ui/skeleton';

export default function AuditLogsLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64 mt-2" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Filters card */}
      <div className="rounded-lg border p-6">
        <Skeleton className="h-5 w-16 mb-4" />
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[150px]" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <div className="p-4 space-y-1">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="border-t">
          <div className="border-b p-3 flex gap-4">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items
            <div key={i} className="border-b p-3 flex gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
