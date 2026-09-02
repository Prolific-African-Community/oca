import Link from 'next/link'
import { useRouter } from 'next/router'
import { cn } from '../ui/cn'
import { activeHref } from './navConfig'
import type { NavItem } from './navConfig'

/** Floating glass tab bar. Mobile only. */
export function MobileNav({ nav, home }: { nav: NavItem[]; home: string }) {
  const { pathname, asPath } = useRouter()
  const current = activeHref(nav, home, pathname, asPath)
  return (
    <nav
      className="bg-white/85 fixed inset-x-4 bottom-4 z-40 flex items-center justify-around rounded-full border border-hairline px-2 py-1.5 shadow-lift backdrop-blur-xl md:hidden"
      aria-label="Navigation"
    >
      {nav.map((item) => {
        const active = item.href === current
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-1.5 transition-colors',
              active ? 'text-oca' : 'text-ink/45'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <item.icon size={22} />
            <span className="text-[10px] font-medium leading-none">
              {item.short ?? item.label.split(' ')[0]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
