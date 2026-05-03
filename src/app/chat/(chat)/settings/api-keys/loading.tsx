import { Skeleton } from '@/components/ui/skeleton';

export default function ApiKeysLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <div className="border-b p-4 flex items-center gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-16 ml-auto" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items
          <div key={i} className="border-b p-4 flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
