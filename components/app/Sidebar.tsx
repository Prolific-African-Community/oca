import Link from 'next/link';
import { useRouter } from 'next/router';
import { cn } from '../ui/cn';
import { Wordmark } from '../brand/Wordmark';
import { SettingsIcon, LogoutIcon } from '../ui/icons';
import type { NavItem } from './navConfig';

interface SidebarProps {
  nav: NavItem[];
  home: string;
  onLogout: () => void;
}

function isActive(pathname: string, href: string, home: string) {
  if (href === home) return pathname === home;
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * Floating icon rail that expands on hover (group-hover, CSS-only).
 * Collapsed 76px → expanded 252px, floating over content. Desktop only.
 */
export function Sidebar({ nav, home, onLogout }: SidebarProps) {
  const { pathname } = useRouter();

  return (
    <aside
      className="group fixed inset-y-3 left-3 z-40 hidden w-[76px] flex-col overflow-hidden rounded-hero border border-hairline bg-white/85 shadow-soft backdrop-blur-xl transition-[width] duration-300 ease-out hover:w-[252px] md:flex"
      aria-label="Navigation principale"
    >
      {/* brand */}
      <div className="flex h-[68px] items-center px-[18px]">
        <Link href={home}>
          <a aria-label="Accueil" className="flex items-center">
            <span className="shrink-0">
              <Wordmark showText={false} />
            </span>
            <span className="ml-3 whitespace-nowrap text-[15px] font-medium tracking-tightest text-ink opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Open Campus
            </span>
          </a>
        </Link>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-1 px-3 py-2">
        {nav.map((item) => {
          const active = isActive(pathname, item.href, home);
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  'relative flex items-center rounded-2xl px-[14px] py-[11px] transition-colors duration-200',
                  active
                    ? 'bg-oca-tint text-oca'
                    : 'text-ink/55 hover:bg-cloud hover:text-ink'
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-x-1 -translate-y-1/2 rounded-full bg-oca" />
                )}
                <item.icon size={21} />
                <span className="ml-3 whitespace-nowrap text-[14px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  {item.label}
                </span>
              </a>
            </Link>
          );
        })}
      </nav>

      {/* footer */}
      <div className="space-y-1 px-3 pb-4">
        <Link href={`${home}`}>
          <a className="flex items-center rounded-2xl px-[14px] py-[11px] text-ink/55 transition-colors duration-200 hover:bg-cloud hover:text-ink">
            <SettingsIcon size={21} />
            <span className="ml-3 whitespace-nowrap text-[14px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Paramètres
            </span>
          </a>
        </Link>
        <button
          onClick={onLogout}
          className="flex w-full items-center rounded-2xl px-[14px] py-[11px] text-ink/55 transition-colors duration-200 hover:bg-red-50 hover:text-red-600"
        >
          <LogoutIcon size={21} />
          <span className="ml-3 whitespace-nowrap text-[14px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Déconnexion
          </span>
        </button>
      </div>
    </aside>
  );
}
