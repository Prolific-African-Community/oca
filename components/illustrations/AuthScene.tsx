/**
 * Brand illustration: "from book to campus".
 * A stylised open book at the base emits diverging knowledge trajectories
 * that pass through floating module tiles and converge on an abstract
 * graduation cap at the apex. Strict vertical hierarchy — nothing crosses
 * awkwardly. Pure SVG, glass fills + soft glows, coherent with HeroScene.
 */
export function AuthScene({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 440 560"
      fill="none"
      className={className}
      role="img"
      aria-label="Illustration : du livre au campus"
    >
      <defs>
        <linearGradient id="as-traj" x1="220" y1="440" x2="220" y2="110" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7FB2FF" stopOpacity="0.05" />
          <stop offset="1" stopColor="#9EC4FF" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="as-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.04" />
        </linearGradient>
        <radialGradient id="as-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8FC0FF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#8FC0FF" stopOpacity="0" />
        </radialGradient>
        <filter id="as-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      {/* depth arcs */}
      <g stroke="rgba(255,255,255,0.10)" strokeWidth="1" fill="none">
        <path d="M70 300 A160 160 0 0 1 370 300" />
        <path d="M110 350 A120 120 0 0 1 330 350" strokeDasharray="2 7" />
      </g>

      {/* trajectories: book -> nodes -> cap */}
      <g stroke="url(#as-traj)" strokeWidth="2" fill="none" strokeLinecap="round">
        <path d="M206 430 C150 380 120 340 120 300" />
        <path d="M220 432 C220 360 220 320 220 250" />
        <path d="M234 430 C290 380 320 340 320 300" />
        <path d="M120 300 C140 240 180 190 214 150" />
        <path d="M320 300 C300 240 260 190 226 150" />
        <path d="M220 250 C220 210 220 180 220 150" />
      </g>

      {/* apex glow */}
      <circle cx="220" cy="120" r="70" fill="url(#as-glow)" filter="url(#as-soft)" />

      {/* graduation cap — apex, brightest */}
      <g stroke="#FFFFFF" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <path d="M220 92 286 116 220 140 154 116 220 92Z" fill="url(#as-glass)" />
        <path d="M176 126v22c0 8 20 15 44 15s44-7 44-15v-22" />
        <path d="M286 116v26" />
        <circle cx="286" cy="150" r="5" fill="#9EC4FF" stroke="none" />
      </g>

      {/* floating module tiles at mid nodes */}
      <ModuleTile x={120} y={300} />
      <ModuleTile x={320} y={300} />

      {/* mid nodes */}
      <g fill="#9EC4FF">
        <circle cx="220" cy="250" r="4" />
        <circle cx="214" cy="150" r="2.5" opacity="0.8" />
        <circle cx="226" cy="150" r="2.5" opacity="0.8" />
      </g>

      {/* open book — base, most solid */}
      <g transform="translate(220 470)">
        <ellipse cx="0" cy="46" rx="120" ry="14" fill="#000" opacity="0.18" />
        <g stroke="#FFFFFF" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" fill="url(#as-glass)">
          <path d="M0 -34 C-30 -50 -66 -50 -96 -34 L-96 34 C-66 18 -30 18 0 34 C30 18 66 18 96 34 L96 -34 C66 -50 30 -50 0 -34 Z" />
          <path d="M0 -34 L0 34" />
        </g>
        <g stroke="rgba(158,196,255,0.6)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M-78 -20 C-56 -30 -34 -30 -14 -20" />
          <path d="M-78 -4 C-56 -14 -34 -14 -14 -4" />
          <path d="M14 -20 C34 -30 56 -30 78 -20" />
          <path d="M14 -4 C34 -14 56 -14 78 -4" />
        </g>
      </g>

      {/* particles */}
      <g fill="#FFFFFF">
        <circle cx="96" cy="180" r="1.6" opacity="0.5" />
        <circle cx="350" cy="210" r="1.6" opacity="0.5" />
        <circle cx="70" cy="410" r="1.6" opacity="0.4" />
        <circle cx="372" cy="400" r="1.6" opacity="0.4" />
      </g>
    </svg>
  );
}

function ModuleTile({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 30} ${y - 20})`}>
      <rect
        width="60" height="40" rx="10"
        fill="url(#as-glass)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.4"
      />
      <rect x="12" y="12" width="20" height="4" rx="2" fill="rgba(255,255,255,0.75)" />
      <rect x="12" y="22" width="34" height="3.5" rx="1.75" fill="rgba(158,196,255,0.7)" />
    </g>
  );
}
