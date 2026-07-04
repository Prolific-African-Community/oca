import { cn } from './cn';

type Tone = 'neutral' | 'brand' | 'blue' | 'success' | 'warning' | 'live';

const tones: Record<Tone, string> = {
  neutral: 'bg-cloud text-ink/70',
  brand: 'bg-oca-tint text-oca',
  blue: 'bg-apple/10 text-apple-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  live: 'bg-red-50 text-red-600',
};

export function Badge({
  children,
  tone = 'neutral',
  dot,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className
      )}
    >
      {dot && (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            tone === 'live' ? 'animate-pulse bg-red-500' : 'bg-current'
          )}
        />
      )}
      {children}
    </span>
  );
}
