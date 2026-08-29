import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/app/AppShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { Skeleton } from '../../components/ui/Skeleton'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Reveal } from '../../components/anim/Reveal'
import { BookIcon, ChevronRightIcon } from '../../components/ui/icons'

export interface StudentCourse {
  id: string
  title: string
  code: string
  description: string | null
  credits: number
  program: { id: string; name: string; code: string }
  semester: { id: string; name: string; number: number; academicYear: string }
  teacher: string | null
  moduleCount: number
  lessonCount: number
  completedLessons: number
  progress: number
  firstModule: { id: string; title: string } | null
}

export default function StudentCourses() {
  const [courses, setCourses] = useState<StudentCourse[] | null>(null)
  const [enrolled, setEnrolled] = useState(true)

  useEffect(() => {
    fetch('/api/student/courses')
      .then((r) => (r.ok ? r.json() : { enrolled: false, courses: [] }))
      .then((d) => {
        setEnrolled(Boolean(d.enrolled))
        setCourses(Array.isArray(d.courses) ? d.courses : [])
      })
      .catch(() => setCourses([]))
  }, [])

  const semester = courses?.[0]?.semester

  return (
    <AppShell
      role="student"
      requiredRole="student"
      title="Mes cours"
      subtitle={
        courses && courses.length > 0 && semester
          ? `${courses.length} cours · ${semester.name} ${semester.academicYear}`
          : undefined
      }
    >
      {courses === null ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : !enrolled ? (
        <Card>
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Aucune inscription active"
            description="Vous n’êtes inscrit à aucun semestre. Contactez votre administration."
          />
        </Card>
      ) : courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Aucun cours disponible"
            description="Aucun cours n’est encore publié pour votre semestre."
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => (
            <Reveal key={c.id} delay={i * 60}>
              <Link
                href={`/student/course/${c.id}`}
                className="block h-full no-underline"
              >
                <Card interactive className="flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-oca-tint text-oca">
                      <BookIcon size={22} />
                    </span>
                    {c.lessonCount > 0 && c.progress === 100 ? (
                      <Badge tone="success">Terminé</Badge>
                    ) : (
                      <Badge tone="neutral">{c.credits} crédits</Badge>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-medium tracking-tightest text-ink">
                    {c.title}
                  </h3>
                  <p className="text-ink/45 mt-1 text-sm">
                    {c.code} · {c.teacher ?? 'Enseignant à confirmer'}
                  </p>

                  <div className="mt-auto pt-5">
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="text-ink/45">
                        {c.lessonCount > 0
                          ? `${c.completedLessons} / ${c.lessonCount} leçons`
                          : `${c.program.code} · ${c.semester.name}`}
                      </span>
                      {c.lessonCount > 0 && (
                        <span className="font-medium tabular-nums text-ink/60">
                          {c.progress}%
                        </span>
                      )}
                    </div>
                    {c.lessonCount > 0 && <ProgressBar value={c.progress} />}
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-apple">
                      {c.lessonCount === 0
                        ? 'Contenu à venir'
                        : c.progress === 100
                        ? 'Revoir le cours'
                        : c.completedLessons > 0
                        ? 'Continuer'
                        : 'Commencer'}
                      <ChevronRightIcon size={15} />
                    </div>
                  </div>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </AppShell>
  )
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.STUDENT])
