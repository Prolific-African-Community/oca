import { cn } from '../ui/cn';

/** Faint film-grain overlay via SVG turbulence. Extremely subtle. */
export function NoiseOverlay({ opacity = 0.035 }: { opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 mix-blend-overlay"
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/** Subtle grid, radially masked so it fades toward the edges. */
export function GridField({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const line =
    tone === 'dark' ? 'rgba(255,255,255,0.07)' : 'rgba(10,42,107,0.06)';
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
        backgroundSize: '44px 44px',
        maskImage:
          'radial-gradient(120% 100% at 50% 0%, #000 30%, transparent 78%)',
        WebkitMaskImage:
          'radial-gradient(120% 100% at 50% 0%, #000 30%, transparent 78%)',
      }}
    />
  );
}

/** Slowly rotating concentric orbit rings with travelling nodes. */
export function Orbits({
  tone = 'dark',
  className,
}: {
  tone?: 'dark' | 'light';
  className?: string;
}) {
  const ring = tone === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(10,42,107,0.12)';
  const faint = tone === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(10,42,107,0.07)';
  const node = tone === 'dark' ? '#7FB2FF' : '#0071E3';
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      className={cn('pointer-events-none absolute', className)}
    >
      <circle cx="200" cy="200" r="150" fill="none" stroke={faint} strokeWidth="1" strokeDasharray="2 7" />
      <circle cx="200" cy="200" r="110" fill="none" stroke={ring} strokeWidth="1" />
      <circle cx="200" cy="200" r="66" fill="none" stroke={faint} strokeWidth="1" />
      <g style={{ transformOrigin: '200px 200px' }} className="animate-spin-slow">
        <circle cx="200" cy="90" r="4" fill={node} />
      </g>
      <g style={{ transformOrigin: '200px 200px' }} className="animate-spin-slower">
        <circle cx="310" cy="200" r="3" fill={node} opacity="0.7" />
      </g>
    </svg>
  );
}

/** Soft coloured aurora blobs for deep-blue canvases. */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <div
        className="absolute -left-20 -top-24 h-80 w-80 rounded-full blur-3xl animate-aurora"
        style={{ background: 'radial-gradient(circle, rgba(64,132,255,0.55), transparent 65%)' }}
      />
      <div
        className="absolute -right-16 top-10 h-72 w-72 rounded-full blur-3xl animate-aurora-2"
        style={{ background: 'radial-gradient(circle, rgba(0,113,227,0.45), transparent 65%)' }}
      />
      <div
        className="absolute bottom-[-10%] left-1/3 h-72 w-72 rounded-full blur-3xl animate-aurora"
        style={{ background: 'radial-gradient(circle, rgba(126,178,255,0.30), transparent 68%)' }}
      />
    </div>
  );
}

/**
 * Deep-blue premium canvas that hosts an illustration. Layers, in order:
 * base gradient → aurora → grid → orbits → children → grain.
 */
export function DarkCanvas({
  className,
  children,
  showOrbits = true,
}: {
  className?: string;
  children?: React.ReactNode;
  showOrbits?: boolean;
}) {
  return (
    <div
      className={cn('relative overflow-hidden bg-oca', className)}
      style={{
        background:
          'radial-gradient(130% 110% at 20% 0%, #16386f 0%, #0b2a68 42%, #071c4a 100%)',
      }}
    >
      <Aurora />
      <GridField tone="dark" />
      {showOrbits && (
        <Orbits tone="dark" className="left-1/2 top-1/2 h-[130%] w-[130%] -translate-x-1/2 -translate-y-1/2 opacity-70" />
      )}
      <div className="relative h-full w-full">{children}</div>
      <NoiseOverlay />
    </div>
  );
}
