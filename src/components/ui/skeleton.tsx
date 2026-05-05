import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // animate-shimmer provides background-color + shimmer sweep
        // animate-pulse is a reliable Tailwind fallback
        'animate-shimmer rounded-md',
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
