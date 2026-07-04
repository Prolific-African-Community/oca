import { cn } from '../ui/cn';

interface WordmarkProps {
  className?: string;
  /** 'ink' for light backgrounds, 'white' for dark/brand panels. */
  tone?: 'ink' | 'white';
  showText?: boolean;
}

/**
 * OCA brand mark — a monoline graduation cap in a rounded tile,
 * paired with the wordmark. Pure SVG, crisp at any size.
 */
export function Wordmark({ className, tone = 'ink', showText = true }: WordmarkProps) {
  const onDark = tone === 'white';
  const tile = onDark ? '#FFFFFF' : '#0A2A6B';
  const glyph = onDark ? '#0A2A6B' : '#FFFFFF';
  const textColor = onDark ? '#FFFFFF' : '#1D1D1F';

  return (
    <span className={cn('inline-flex items-center gap-3', className)} aria-label="Open Campus Africa">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <rect width="34" height="34" rx="9" fill={tile} />
        <path
          d="M17 9.5 25 13l-8 3.5L9 13l8-3.5Z"
          fill="none"
          stroke={glyph}
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path
          d="M12.5 15v4.2c0 1.4 2 2.6 4.5 2.6s4.5-1.2 4.5-2.6V15"
          fill="none"
          stroke={glyph}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M25 13v4.5" stroke={glyph} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className="text-[17px] font-medium tracking-tightest" style={{ color: textColor }}>
          Open Campus <span className="opacity-60">Africa</span>
        </span>
      )}
    </span>
  );
}
