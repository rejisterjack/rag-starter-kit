import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceSettingsLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-9 w-48" />

      {/* Tab bar */}
      <div className="flex gap-4 border-b pb-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Settings card */}
      <div className="space-y-4 rounded-lg border p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
        <div className="space-y-3 pt-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      </div>
    </div>
  );
}
