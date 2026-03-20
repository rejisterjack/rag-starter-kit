import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
