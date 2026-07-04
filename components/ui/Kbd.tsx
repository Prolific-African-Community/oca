import { cn } from './cn';

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-[20px] items-center justify-center rounded-md border border-hairline bg-cloud px-1.5 text-[11px] font-medium text-ink/45',
        className
      )}
    >
      {children}
    </kbd>
  );
}
