import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/app/AppShell'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Reveal } from '../../components/anim/Reveal'
import { LiveIcon, BookIcon, ChevronRightIcon } from '../../components/ui/icons'
import type { StudentSummary } from '../../lib/studentSummary'

/**
 * Sessions live.
 *
 * Aucune session n'existe en base : il n'y a pas encore de modèle de séance en
 * direct. Plutôt qu'un faux planning, la page affiche un état vide explicite,
 * puis rappelle les cours suivis et leurs enseignants — les seules informations
 * réelles disponibles à ce stade.
 */
export default function StudentLive() {
  const [summary, setSummary] = useState<StudentSummary | null>(null)

  useEffect(() => {
    fetch('/api/student/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSummary(d))
      .catch(() => setSummary(null))
  }, [])

  return (
    <AppShell
      role="student"
      requiredRole="student"
      title="Sessions live"
      subtitle={
        summary?.semester
          ? `${summary.semester.name} ${summary.semester.academicYear}`
          : undefined
      }
    >
      <Reveal>
        <Card>
          <EmptyState
            icon={<LiveIcon size={22} />}
            title="Aucune session programmée"
            description="Les cours en direct et les rediffusions ne sont pas encore disponibles sur OCA. Dès que vos enseignants programmeront une séance, elle apparaîtra ici."
          />
        </Card>
      </Reveal>

      {summary === null ? (
        <div className="mt-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !summary.enrolled || summary.courses.length === 0 ? null : (
        <Reveal delay={80} className="mt-5 block">
          <Card>
            <CardHeader
              title="Vos cours et enseignants"
              action={<Badge tone="neutral">{summary.courses.length}</Badge>}
            />
            <p className="text-ink/45 mb-4 text-sm">
              Ce sont les enseignants susceptibles d’animer vos futures séances.
            </p>

            <ul className="divide-y divide-hairline">
              {summary.courses.map((c) => (
                <li key={c.id} className="group">
                  <Link
                    href={`/student/course/${c.id}`}
                    className="flex items-center gap-4 py-3.5 no-underline first:pt-0"
                  >
                    <span className="text-ink/55 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cloud transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                      <BookIcon size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {c.title}
                      </p>
                      <p className="text-ink/45 truncate text-sm">
                        {c.teachers.length > 0
                          ? c.teachers.map((t) => t.name).join(', ')
                          : 'Enseignant à confirmer'}
                      </p>
                    </div>
                    <ChevronRightIcon size={16} className="text-ink/25" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}
    </AppShell>
  )
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.STUDENT])
