import { Skeleton } from '@/components/ui/skeleton';

export default function OfflineLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <Skeleton className="h-16 w-16 rounded-full mx-auto" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <Skeleton className="h-4 w-40 mx-auto" />
        <div className="flex gap-3 justify-center">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
