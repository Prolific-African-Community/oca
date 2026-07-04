import { useRouter } from 'next/router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { MobileNav } from './MobileNav';
import { resolveRole } from './navConfig';
import { useRequireRole, logout, displayName } from '../../lib/auth';
import type { Role } from '../../lib/auth';
import { useCommand, useRegisterCommands } from '../overlay/command';
import type { Command } from '../overlay/command';
import { LogoutIcon } from '../ui/icons';

interface AppShellProps {
  /** which role's navigation to render */
  role: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** hide the topbar title block so the page can own an editorial header */
  bareHeader?: boolean;
  /** widen or narrow the content column (default 6xl) */
  maxWidth?: 'default' | 'narrow';
  /** when set, redirects to /login unless the session matches this role */
  requiredRole?: Role;
  children: React.ReactNode;
}

export function AppShell({ role, title, subtitle, action, bareHeader, maxWidth = 'default', requiredRole, children }: AppShellProps) {
  const router = useRouter();
  const meta = resolveRole(role);

  // Guard only when a page explicitly requires a role; otherwise just read.
  const { user } = useRequireRole(requiredRole ?? null);

  const name = displayName(user);
  const onLogout = () => logout(router);

  const { setOpen } = useCommand();
  const navCommands: Command[] = meta.nav.map((item) => ({
    id: `nav:${item.href}`,
    label: item.label,
    hint: 'Aller à',
    group: 'Navigation',
    icon: <item.icon size={17} />,
    perform: () => router.push(item.href),
  }));
  useRegisterCommands(
    `shell:${role}`,
    [
      ...navCommands,
      { id: 'logout', label: 'Déconnexion', group: 'Compte', icon: <LogoutIcon size={17} />, perform: onLogout },
    ],
    [role, router]
  );

  return (
    <div className="min-h-screen bg-page text-ink">
      <Sidebar nav={meta.nav} home={meta.home} onLogout={onLogout} />

      <div className="md:pl-[100px] md:pr-4">
        <div className={`mx-auto ${maxWidth === 'narrow' ? 'max-w-5xl' : 'max-w-6xl'} px-5 pb-28 pt-2 sm:px-8 md:pb-12`}>
          <Topbar
            title={title ?? ''}
            subtitle={subtitle}
            action={action}
            userName={name}
            roleLabel={meta.label}
            onLogout={onLogout}
            onOpenCommand={() => setOpen(true)}
            bare={bareHeader}
          />
          <main className="pt-4">{children}</main>
        </div>
      </div>

      <MobileNav nav={meta.nav} home={meta.home} />
    </div>
  );
}
