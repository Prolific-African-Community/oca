import { cn } from './cn';

export function ProgressBar({
  value,
  className,
  tone = 'brand',
}: {
  value: number;
  className?: string;
  tone?: 'brand' | 'white';
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn(
        'h-1.5 w-full overflow-hidden rounded-full',
        tone === 'white' ? 'bg-white/15' : 'bg-cloud',
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-[1000ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          tone === 'white'
            ? 'bg-white'
            : 'bg-gradient-to-r from-oca-400 to-apple'
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
