import { cn } from './cn';
import { initials as toInitials } from '../../lib/auth';

const sizes = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-[13px]',
  lg: 'h-12 w-12 text-sm',
};

/** Deterministic soft tint from a name, staying inside the brand family. */
const palette = [
  'bg-oca-tint text-oca',
  'bg-apple/10 text-apple-600',
  'bg-indigo-50 text-indigo-600',
  'bg-sky-50 text-sky-700',
  'bg-violet-50 text-violet-600',
];

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % palette.length;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-medium',
        sizes[size],
        palette[hash],
        className
      )}
      aria-hidden="true"
    >
      {toInitials(name)}
    </span>
  );
}
