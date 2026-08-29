import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/app/AppShell'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { Reveal } from '../../components/anim/Reveal'
import {
  AwardIcon,
  BookIcon,
  ChevronRightIcon,
} from '../../components/ui/icons'
import type { StudentSummary } from '../../lib/studentSummary'

/**
 * Notes & crédits.
 *
 * Aucune note n'existe en base : il n'y a ni schéma d'évaluation, ni délibération.
 * La page l'annonce clairement plutôt que d'afficher un relevé fictif, et se
 * limite à rappeler l'avancement de lecture — qui n'est **pas** une validation
 * académique, ce que le texte précise explicitement.
 */
export default function StudentGrades() {
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
      title="Notes & crédits"
      subtitle={
        summary?.semester
          ? `${summary.program?.name ?? ''} · ${summary.semester.name} ${
              summary.semester.academicYear
            }`
          : undefined
      }
    >
      <Reveal>
        <Card>
          <EmptyState
            icon={<AwardIcon size={22} />}
            title="Aucune note pour le moment"
            description="Les évaluations ne sont pas encore ouvertes sur OCA. Vos notes, vos crédits validés et vos moyennes apparaîtront ici dès que votre établissement les publiera."
          />
        </Card>
      </Reveal>

      {summary === null ? (
        <div className="mt-5">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !summary.enrolled ? null : (
        <Reveal delay={80} className="mt-5 block">
          <Card>
            <CardHeader
              title="Votre avancement"
              action={<Badge tone="neutral">Suivi de lecture</Badge>}
            />
            <p className="text-ink/45 mb-5 text-sm">
              Indicatif : cet avancement reflète les leçons que vous avez
              marquées comme terminées. Il ne constitue en aucun cas une
              validation académique.
            </p>

            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <p className="text-ink/45 text-sm">Cours suivis</p>
                <p className="text-2xl font-medium tracking-tightest text-ink">
                  {summary.courseCount}
                </p>
              </div>
              <div>
                <p className="text-ink/45 text-sm">Leçons terminées</p>
                <p className="text-2xl font-medium tracking-tightest text-ink">
                  {summary.completedLessons}
                  <span className="text-ink/30"> / {summary.lessonCount}</span>
                </p>
              </div>
              <div>
                <p className="text-ink/45 text-sm">
                  Crédits inscrits ce semestre
                </p>
                <p className="text-2xl font-medium tracking-tightest text-ink">
                  {summary.creditsEnrolled}
                </p>
              </div>
            </div>

            {summary.lessonCount > 0 && (
              <div className="mt-5">
                <ProgressBar value={summary.progress} />
              </div>
            )}

            {summary.courses.length > 0 && (
              <ul className="mt-6 divide-y divide-hairline border-t border-hairline pt-2">
                {summary.courses.map((c) => (
                  <li key={c.id} className="group">
                    <Link
                      href={`/student/course/${c.id}`}
                      className="flex items-center gap-4 py-3.5 no-underline"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cloud text-ink/50 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                        <BookIcon size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {c.title}
                        </p>
                        <p className="text-ink/45 truncate text-sm">
                          {c.code} · {c.credits} crédits
                        </p>
                      </div>
                      <span className="text-[13px] tabular-nums text-ink/40">
                        {c.lessonCount > 0
                          ? `${c.completedLessons}/${c.lessonCount} · ${c.progress}%`
                          : 'Contenu à venir'}
                      </span>
                      <ChevronRightIcon size={16} className="text-ink/25" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      )}
    </AppShell>
  )
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.STUDENT])
