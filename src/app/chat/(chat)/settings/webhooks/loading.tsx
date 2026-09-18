import { Skeleton } from '@/components/ui/skeleton';

export default function WebhooksLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <Skeleton className="h-10 w-36" />
      <div className="rounded-md border">
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
