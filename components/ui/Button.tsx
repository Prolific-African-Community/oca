import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap ' +
  'rounded-full font-medium transition-all duration-300 ease-out select-none ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

const variants: Record<Variant, string> = {
  primary: 'bg-oca text-white hover:bg-oca-600 shadow-soft',
  secondary:
    'bg-white text-ink border border-hairline hover:border-ink/20 hover:bg-cloud',
  ghost: 'bg-transparent text-oca hover:bg-oca-tint',
};

const sizes: Record<Size, string> = {
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-14 px-8 text-base',
};

/** Shared class string so links can look like buttons without nesting. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  )
);

Button.displayName = 'Button';
