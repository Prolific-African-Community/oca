import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { Card, CardHeader } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Reveal } from '../../components/anim/Reveal'
import { Skeleton } from '../../components/ui/Skeleton'
import { useCurrentUser, displayName } from '../../lib/auth'
import {
  BookIcon,
  LayersIcon,
  CreditIcon,
  ChevronRightIcon,
} from '../../components/ui/icons'

interface TeacherCourse {
  assignmentId: string
  role: 'LEAD' | 'CO_TEACHER' | 'ASSISTANT'
  id: string
  title: string
  code: string
  description: string | null
  credits: number
  coefficient: number
  status: string
  program: { id: string; name: string; code: string }
  semester: {
    id: string
    name: string
    number: number
    academicYear: string
    isCurrentYear: boolean
  }
  moduleCount: number
}

const ROLE_LABELS: Record<TeacherCourse['role'], string> = {
  LEAD: 'Responsable',
  CO_TEACHER: 'Co-enseignant',
  ASSISTANT: 'Assistant',
}

export default function TeacherWorkspace() {
  const { user } = useCurrentUser()
  const [courses, setCourses] = useState<TeacherCourse[] | null>(null)

  useEffect(() => {
    fetch('/api/teacher/courses')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setCourses(Array.isArray(d) ? d : []))
      .catch(() => setCourses([]))
  }, [])

  const totals = useMemo(() => {
    const list = courses ?? []
    return {
      count: list.length,
      credits: list.reduce((n, c) => n + c.credits, 0),
      lead: list.filter((c) => c.role === 'LEAD').length,
    }
  }, [courses])

  return (
    <AppShell
      role="teacher"
      requiredRole="teacher"
      title="Mes enseignements"
      subtitle={user ? `Bonjour ${displayName(user)}` : undefined}
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal>
          <Card>
            <CardHeader title="Cours affectés" />
            <p className="text-2xl font-medium tracking-tightest text-ink">
              {totals.count}
            </p>
            <p className="text-ink/45 mt-1 text-sm">
              {totals.lead} en responsabilité
            </p>
          </Card>
        </Reveal>

        <Reveal delay={70}>
          <Card>
            <CardHeader title="Crédits enseignés" />
            <p className="text-2xl font-medium tracking-tightest text-ink">
              {totals.credits}
            </p>
            <p className="text-ink/45 mt-1 text-sm">Cumul sur vos cours</p>
          </Card>
        </Reveal>

        <Reveal delay={140}>
          <Card>
            <CardHeader title="Contenus" />
            <p className="text-2xl font-medium tracking-tightest text-ink">
              {(courses ?? []).reduce((n, c) => n + c.moduleCount, 0)}
            </p>
            <p className="text-ink/45 mt-1 text-sm">
              Modules publiés ou en préparation
            </p>
          </Card>
        </Reveal>
      </div>

      <div className="mt-5">
        <Reveal delay={100}>
          <Card>
            <CardHeader
              title="Mes cours"
              action={
                courses ? <Badge tone="neutral">{courses.length}</Badge> : null
              }
            />

            {courses === null ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : courses.length === 0 ? (
              <EmptyState
                icon={<BookIcon size={22} />}
                title="Aucun cours affecté"
                description="Votre administration ne vous a pas encore affecté de cours. Contactez-la pour être rattaché à un enseignement."
              />
            ) : (
              <ul className="space-y-1">
                {courses.map((c) => (
                  <li key={c.assignmentId}>
                    <Link
                      href={`/teacher/course/${c.id}`}
                      className="flex items-center gap-3 rounded-2xl p-2.5 no-underline transition-colors hover:bg-cloud"
                    >
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-oca-tint text-oca">
                        <BookIcon size={20} />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {c.title}{' '}
                          <span className="text-ink/35">· {c.code}</span>
                        </p>
                        <p className="text-ink/45 truncate text-sm">
                          {c.program.name} · {c.semester.name} ·{' '}
                          {c.semester.academicYear}
                        </p>
                      </div>

                      <div className="hidden items-center gap-2 sm:flex">
                        <Badge tone="neutral">
                          <CreditIcon size={13} /> {c.credits} cr.
                        </Badge>
                        <Badge tone="neutral">
                          <LayersIcon size={13} /> {c.moduleCount}
                        </Badge>
                        <Badge tone={c.role === 'LEAD' ? 'brand' : 'neutral'}>
                          {ROLE_LABELS[c.role]}
                        </Badge>
                      </div>
                      <ChevronRightIcon size={16} className="text-ink/30" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </AppShell>
  )
}

// Protection côté serveur : réservé aux enseignants.
export const getServerSideProps = requireRoleSSR([Role.PROFESSOR])
