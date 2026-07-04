import { cn } from './cn';

/** Shimmering placeholder. Compose to build loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-lg bg-cloud', className)}>
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)',
        }}
      />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-hero border border-hairline bg-white p-6 shadow-soft">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="mt-4 h-4 w-2/3" />
      <Skeleton className="mt-2 h-3 w-1/2" />
      <Skeleton className="mt-5 h-1.5 w-full rounded-full" />
    </div>
  );
}
