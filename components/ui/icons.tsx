import type { SVGProps } from 'react';

/**
 * Unified monoline icon family — identical viewBox (24), stroke width (1.6),
 * round caps/joins, currentColor. Import and size with width/height or font.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 22, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CapIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4 21 8l-9 4-9-4 9-4Z" />
    <path d="M6 10.5V15c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5" />
    <path d="M21 8v5" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 6.5c-2-1.3-4.2-1.3-7 0V18c2.8-1.3 5-1.3 7 0 2-1.3 4.2-1.3 7 0V6.5c-2.8-1.3-5-1.3-7 0Z" />
    <path d="M12 6.5V18" />
  </Icon>
);

export const LiveIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="2.4" />
    <path d="M7.5 7.5a6 6 0 0 0 0 9M16.5 7.5a6 6 0 0 1 0 9" />
    <path d="M4.8 4.8a9.6 9.6 0 0 0 0 14.4M19.2 4.8a9.6 9.6 0 0 1 0 14.4" />
  </Icon>
);

export const AwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
  </Icon>
);

export const ProgressIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 19V5" />
    <path d="M4 15l4.5-4 3.5 3 6-6.5" />
    <path d="M20 7v3.5H16.5" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 5.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" />
  </Icon>
);

export const LayersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 8v5M21 8v5" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v3.5M12 17.5V21M3 12h3.5M17.5 12H21" />
    <path d="M12 7.5a4.5 4.5 0 0 0 4.5 4.5A4.5 4.5 0 0 0 12 16.5 4.5 4.5 0 0 0 7.5 12 4.5 4.5 0 0 0 12 7.5Z" />
  </Icon>
);

export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </Icon>
);

export const GlobeIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9Z" />
  </Icon>
);

export const ArrowIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const CreditIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2.5" />
    <path d="M3 10h18M7 14h4" />
  </Icon>
);

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.5V19h12V9.5" />
    <path d="M10 19v-5h4v5" />
  </Icon>
);

export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-2 5-4 1 2-5 4-1Z" />
  </Icon>
);

export const MessageIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 5h16v11H9l-4 3v-3H4V5Z" />
    <path d="M8 9.5h8M8 12.5h5" />
  </Icon>
);

export const BellIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" />
    <path d="M10 20a2 2 0 0 0 4 0" />
  </Icon>
);

export const CalendarIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="5" width="16" height="16" rx="2.5" />
    <path d="M4 9h16M8 3v4M16 3v4" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
);

export const LogoutIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 5h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3" />
    <path d="M10 8 6 12l4 4M6 12h10" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4M17.7 17.7l-1.4-1.4M7.7 7.7 6.3 6.3" />
  </Icon>
);

export const ClipboardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2.5" />
    <path d="M9 4a3 3 0 0 1 6 0" />
    <path d="M8.5 12l2 2 4-4" />
  </Icon>
);

export const FolderIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4V7Z" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
  </Icon>
);

export const BuildingIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16" />
    <path d="M15 9h3a1 1 0 0 1 1 1v11" />
    <path d="M8.5 8h3M8.5 12h3M8.5 16h3M3 21h18" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12 4.5 4.5L19 7" />
  </Icon>
);

