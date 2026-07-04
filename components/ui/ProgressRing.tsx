import { cn } from './cn';

/** Circular progress with a gradient arc. Value 0–100. */
export function ProgressRing({
  value,
  size = 72,
  stroke = 7,
  label,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: React.ReactNode;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  const gid = `pr-${size}-${Math.round(clamped)}`;

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3B5BB5" />
            <stop offset="1" stopColor="#0071E3" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAF0FB" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-[1200ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        />
      </svg>
      <span className="absolute grid place-items-center text-center">
        {label ?? <span className="text-sm font-medium text-ink">{Math.round(clamped)}%</span>}
      </span>
    </div>
  );
}
