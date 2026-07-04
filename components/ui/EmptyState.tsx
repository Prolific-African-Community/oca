import { cn } from './cn';

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-hero border border-dashed border-hairline bg-white/50 px-6 py-14 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-oca-tint text-oca">
          {icon}
        </div>
      )}
      <h3 className="text-base font-medium tracking-tightest text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink/50">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
