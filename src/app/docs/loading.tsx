import { Skeleton } from '@/components/ui/skeleton';

export default function DocsLoading() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      <div className="flex gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton items
          <div key={i} className="border rounded-lg p-4 flex items-center gap-4">
            <Skeleton className="h-6 w-16 rounded" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-64 ml-4" />
          </div>
        ))}
      </div>
    </div>
  );
}
