import { DarkCanvas } from './Backdrop';
import { useParallax } from '../anim/useParallax';
import { CapIcon, LiveIcon, AwardIcon, CreditIcon } from '../ui/icons';

/**
 * The brand hero composition. A deep-blue canvas holding floating glass
 * panels (course, live session, certificate), a progress ring focal point,
 * ECTS chips and connection lines. Layered with pointer parallax + slow
 * floating. Abstract, not literal — the "vision", not a screenshot.
 */
export function HeroScene({ className }: { className?: string }) {
  const ref = useParallax<HTMLDivElement>();

  return (
    <div ref={ref} className={className}>
      <DarkCanvas className="h-full w-full rounded-hero shadow-lift">
        {/* connection lines behind everything */}
        <svg
          viewBox="0 0 400 500"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="hs-line" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#7FB2FF" stopOpacity="0.55" />
              <stop offset="1" stopColor="#0071E3" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d="M96 128 C160 180 150 250 210 268" fill="none" stroke="url(#hs-line)" strokeWidth="1.5" />
          <path d="M300 190 C250 230 250 300 196 330" fill="none" stroke="url(#hs-line)" strokeWidth="1.5" />
          <path d="M120 372 C180 350 210 320 250 356" fill="none" stroke="url(#hs-line)" strokeWidth="1.5" />
          <circle cx="210" cy="268" r="3" fill="#7FB2FF" />
          <circle cx="196" cy="330" r="2.5" fill="#7FB2FF" opacity="0.8" />
        </svg>

        {/* central progress ring — the focal point */}
        <div
          data-depth="10"
          className="absolute left-1/2 top-[76%] -translate-x-1/2 -translate-y-1/2 animate-float-slow sm:top-1/2"
        >
          <div className="relative grid h-32 w-32 place-items-center sm:h-40 sm:w-40">
            <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90 sm:h-40 sm:w-40">
              <defs>
                <linearGradient id="hs-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#8FC0FF" />
                  <stop offset="1" stopColor="#0071E3" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52" fill="none" stroke="url(#hs-ring)" strokeWidth="8"
                strokeLinecap="round" strokeDasharray="326" strokeDashoffset="196"
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-3xl font-medium tracking-tightest text-white">40%</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/50">Parcours</div>
            </div>
          </div>
        </div>

        {/* course card — top left */}
        <GlassPanel
          depth={22}
          className="left-[5%] top-[8%] w-[74%] max-w-[240px] animate-float sm:top-[12%] sm:w-[54%]"
        >
          <div className="flex items-center gap-3">
            <IconTile><CapIcon size={18} /></IconTile>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-white">Finance d’entreprise</p>
              <p className="text-[11px] text-white/50">Licence · S3</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/12">
            <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-[#8FC0FF] to-apple" />
          </div>
        </GlassPanel>

        {/* live session — right, prominent */}
        <GlassPanel
          depth={16}
          className="right-[4%] top-[41%] w-[70%] max-w-[210px] animate-float-x sm:top-[26%] sm:w-[50%]"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
            </span>
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">En direct</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <IconTile tone="live"><LiveIcon size={18} /></IconTile>
            <div>
              <p className="text-[13px] font-medium text-white">Data Analytics</p>
              <p className="text-[11px] text-white/50">Aujourd’hui · 14:00</p>
            </div>
          </div>
        </GlassPanel>

        {/* certificate — bottom (desktop/tablet only) */}
        <GlassPanel
          depth={26}
          className="bottom-[10%] left-[10%] hidden w-[52%] max-w-[220px] animate-drift sm:block"
        >
          <div className="flex items-center gap-3">
            <IconTile><AwardIcon size={18} /></IconTile>
            <div>
              <p className="text-[13px] font-medium text-white">Certificat validé</p>
              <p className="text-[11px] text-white/50">Comptabilité générale</p>
            </div>
          </div>
        </GlassPanel>

        {/* ECTS credit chip — floating accent (desktop/tablet only) */}
        <div
          data-depth="34"
          className="absolute bottom-[13%] right-[6%] hidden animate-float-slow sm:block"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md">
            <CreditIcon size={15} className="text-[#8FC0FF]" />
            <span className="text-[12px] font-medium text-white">+72 crédits ECTS</span>
          </div>
        </div>
      </DarkCanvas>
    </div>
  );
}

function GlassPanel({
  depth,
  className,
  children,
}: {
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-depth={depth} className={`absolute ${className ?? ''}`}>
      <div className="rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)] backdrop-blur-md">
        {children}
      </div>
    </div>
  );
}

function IconTile({
  children,
  tone = 'brand',
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'live';
}) {
  const bg = tone === 'live' ? 'bg-red-500/15 text-red-200' : 'bg-white/12 text-[#9EC4FF]';
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg}`}>
      {children}
    </span>
  );
}
