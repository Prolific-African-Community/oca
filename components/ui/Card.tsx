import type { HTMLAttributes } from 'react';
import { cn } from './cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** interactive cards lift + strengthen border on hover */
  interactive?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const pad = { none: '', sm: 'p-4', md: 'p-5 sm:p-6', lg: 'p-6 sm:p-8' };

export function Card({ interactive, padding = 'md', className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-hero border border-hairline bg-white shadow-soft',
        pad[padding],
        interactive &&
          'cursor-pointer transition-all duration-500 hover:-translate-y-1 hover:border-ink/10 hover:shadow-lift',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  action,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex items-center justify-between gap-4', className)}>
      <h2 className="text-[15px] font-medium tracking-tightest text-ink/50">{title}</h2>
      {action}
    </div>
  );
}
