import { useEffect, useRef, useState } from 'react';
import { cn } from '../ui/cn';
import { Avatar } from '../ui/Avatar';
import { SearchIcon, BellIcon, LogoutIcon, SettingsIcon } from '../ui/icons';

interface TopbarProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  userName: string;
  roleLabel: string;
  onLogout: () => void;
  onOpenCommand?: () => void;
  bare?: boolean;
}

export function Topbar({ title, subtitle, action, userName, roleLabel, onLogout, onOpenCommand, bare }: TopbarProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="sticky top-0 z-30 -mx-5 mb-2 bg-page/70 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
      <div className={`flex items-center gap-4 ${bare ? 'justify-end' : 'justify-between'}`}>
        {!bare && (
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-medium tracking-tightest text-ink sm:text-[28px]">
              {title}
            </h1>
            {subtitle && <p className="mt-0.5 truncate text-[15px] text-ink/50">{subtitle}</p>}
          </div>
        )}

        <div className="flex items-center gap-2">
          {action}

          <button
            onClick={onOpenCommand}
            className="hidden h-11 items-center gap-2 rounded-full border border-hairline bg-white px-4 text-sm text-ink/45 shadow-soft transition-colors hover:border-ink/15 hover:text-ink lg:flex"
            aria-label="Ouvrir la palette de commandes"
          >
            <SearchIcon size={17} />
            <span>Rechercher</span>
            <kbd className="ml-2 rounded-md border border-hairline bg-cloud px-1.5 py-0.5 text-[11px] font-medium text-ink/40">
              ⌘K
            </kbd>
          </button>

          <button
            onClick={onOpenCommand}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white text-ink/55 shadow-soft transition-colors hover:text-ink lg:hidden"
            aria-label="Rechercher"
          >
            <SearchIcon size={19} />
          </button>

          <button
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-white text-ink/55 shadow-soft transition-colors hover:text-ink"
            aria-label="Notifications"
          >
            <BellIcon size={19} />
            <span className="absolute right-3 top-3 h-1.5 w-1.5 rounded-full bg-apple" />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center rounded-full transition-transform hover:scale-105"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Menu du compte"
            >
              <Avatar name={userName} size="md" />
            </button>

            <div
              className={cn(
                'absolute right-0 top-[calc(100%+10px)] w-60 origin-top-right rounded-2xl border border-hairline bg-white p-2 shadow-lift transition-all duration-200',
                open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
              )}
              role="menu"
            >
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <Avatar name={userName} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{userName}</p>
                  <p className="truncate text-xs text-ink/45">{roleLabel}</p>
                </div>
              </div>
              <div className="my-1 h-px bg-hairline" />
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-ink/70 transition-colors hover:bg-cloud" role="menuitem">
                <SettingsIcon size={18} /> Paramètres
              </button>
              <button
                onClick={onLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                role="menuitem"
              >
                <LogoutIcon size={18} /> Déconnexion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
