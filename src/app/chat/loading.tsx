import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="flex h-full">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r bg-card p-4 space-y-4 hidden md:block">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="pt-4 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="h-14 border-b flex items-center px-4 gap-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Chat area */}
        <div className="flex-1 p-4 space-y-4">
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-20 w-full max-w-2xl" />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <div className="space-y-2 flex-1 max-w-2xl">
              <Skeleton className="h-4 w-32 ml-auto" />
              <Skeleton className="h-32 w-full" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-24 w-full max-w-2xl" />
            </div>
          </div>
        </div>

        {/* Input area */}
        <div className="p-4 border-t">
          <Skeleton className="h-12 w-full max-w-3xl mx-auto" />
        </div>
      </div>
    </div>
  );
}
