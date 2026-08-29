import { requireEnrolledCoursePage } from '../../../../lib/pageGuard'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../../components/app/AppShell'
import { Card, CardHeader } from '../../../../components/ui/Card'
import { Badge } from '../../../../components/ui/Badge'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { ProgressBar } from '../../../../components/ui/ProgressBar'
import { buttonClasses } from '../../../../components/ui/Button'
import { Reveal } from '../../../../components/anim/Reveal'
import {
  BookIcon,
  LayersIcon,
  ChevronRightIcon,
  PlayIcon,
  CheckIcon,
  ClipboardIcon,
} from '../../../../components/ui/icons'

type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

interface Lesson {
  id: string
  title: string
  order: number
  estimatedMinutes: number | null
  status: ProgressStatus
  completedAt: string | null
}

interface Module {
  id: string
  title: string
  description: string | null
  order: number
  lessons: Lesson[]
  completedLessons: number
  progress: number
}

interface StudentQuiz {
  id: string
  title: string
  description: string | null
  passingScore: number | null
  questionCount: number
  module: { id: string; title: string } | null
  lastAttempt: {
    score: number | null
    maxScore: number | null
    percentage: number | null
  } | null
}

interface CourseDetail {
  id: string
  title: string
  code: string
  description: string | null
  credits: number
  coefficient: number
  program: { name: string; code: string }
  semester: { name: string; academicYear: string }
  teachers: { role: string; name: string }[]
  modules: Module[]
  lessonCount: number
  completedLessons: number
  progress: number
  nextLesson: { id: string; title: string } | null
}

export default function StudentCoursePage() {
  const router = useRouter()
  const { courseId } = router.query

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (typeof courseId !== 'string') return
    fetch(`/api/student/courses/${courseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setCourse(d) : setNotFound(true)))
      .catch(() => setNotFound(true))

    fetch(`/api/student/courses/${courseId}/quizzes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setQuizzes(Array.isArray(d) ? d : []))
      .catch(() => setQuizzes([]))
  }, [courseId])

  const lessonCount = (course?.modules ?? []).reduce(
    (n, m) => n + m.lessons.length,
    0
  )

  return (
    <AppShell
      role="student"
      requiredRole="student"
      title={course?.title ?? 'Cours'}
      subtitle={
        course
          ? `${course.code} · ${course.program.name} · ${course.semester.name} ${course.semester.academicYear}`
          : undefined
      }
    >
      <Link
        href="/student/courses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← Mes cours
      </Link>

      {notFound ? (
        <Card>
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Cours indisponible"
            description="Ce cours n’existe pas ou ne fait pas partie de votre semestre."
          />
        </Card>
      ) : !course ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <Reveal>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{course.credits} crédits</Badge>
                <Badge tone="neutral">coef. {course.coefficient}</Badge>
                <Badge tone="neutral">{course.modules.length} modules</Badge>
                <Badge tone="neutral">{lessonCount} leçons</Badge>
              </div>
              {course.description && (
                <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
                  {course.description}
                </p>
              )}
              {course.teachers.length > 0 && (
                <p className="text-ink/45 mt-4 text-sm">
                  Enseignant{course.teachers.length > 1 ? 's' : ''} :{' '}
                  {course.teachers.map((t) => t.name).join(', ')}
                </p>
              )}

              {course.lessonCount > 0 && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-[13px]">
                    <span className="text-ink/45">
                      {course.completedLessons} / {course.lessonCount} leçons
                      terminées
                    </span>
                    <span className="font-medium tabular-nums text-ink/60">
                      {course.progress}%
                    </span>
                  </div>
                  <ProgressBar value={course.progress} />

                  {course.nextLesson && (
                    <Link
                      href={`/student/course/${course.id}/lesson/${course.nextLesson.id}`}
                      className={buttonClasses(
                        'primary',
                        'md',
                        'mt-5 no-underline'
                      )}
                    >
                      <PlayIcon size={17} />
                      {course.completedLessons > 0
                        ? 'Reprendre'
                        : 'Commencer'}{' '}
                      · {course.nextLesson.title}
                    </Link>
                  )}
                  {!course.nextLesson && (
                    <p className="mt-5 text-sm font-medium text-emerald-600">
                      Toutes les leçons publiées sont terminées.
                    </p>
                  )}
                </div>
              )}
            </Card>
          </Reveal>

          <div className="mt-5 space-y-5">
            {course.modules.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<LayersIcon size={22} />}
                  title="Contenu à venir"
                  description="Votre enseignant n’a pas encore publié de module pour ce cours."
                />
              </Card>
            ) : (
              course.modules.map((m, i) => (
                <Reveal key={m.id} delay={i * 60}>
                  <Card>
                    <CardHeader
                      title={`${i + 1}. ${m.title}`}
                      action={
                        <Badge
                          tone={m.progress === 100 ? 'success' : 'neutral'}
                        >
                          {m.completedLessons} / {m.lessons.length} leçons
                        </Badge>
                      }
                    />
                    {m.description && (
                      <p className="mb-3 text-sm text-ink/50">
                        {m.description}
                      </p>
                    )}

                    {m.lessons.length === 0 ? (
                      <p className="text-ink/45 text-sm">
                        Aucune leçon publiée dans ce module.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {m.lessons.map((l, j) => (
                          <li key={l.id}>
                            <Link
                              href={`/student/course/${course.id}/lesson/${l.id}`}
                              className="flex items-center gap-3 rounded-2xl p-2.5 no-underline transition-colors hover:bg-cloud"
                            >
                              <span
                                className={
                                  'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-medium ' +
                                  (l.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-cloud text-ink/50')
                                }
                              >
                                {l.status === 'COMPLETED' ? (
                                  <CheckIcon size={16} />
                                ) : (
                                  j + 1
                                )}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-medium text-ink">
                                  {l.title}
                                </p>
                                <p className="text-ink/45 truncate text-sm">
                                  {l.estimatedMinutes
                                    ? `${l.estimatedMinutes} min`
                                    : 'Durée non précisée'}
                                  {l.status === 'IN_PROGRESS'
                                    ? ' · en cours'
                                    : ''}
                                </p>
                              </div>
                              <ChevronRightIcon
                                size={16}
                                className="text-ink/30"
                              />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Reveal>
              ))
            )}
          </div>

          {quizzes.length > 0 && (
            <Reveal delay={120} className="mt-5 block">
              <Card>
                <CardHeader
                  title="Quiz d’entraînement"
                  action={<Badge tone="warning">Pas une note officielle</Badge>}
                />
                <ul className="space-y-1">
                  {quizzes.map((q) => (
                    <li key={q.id}>
                      <Link
                        href={`/student/course/${course.id}/quiz/${q.id}`}
                        className="flex items-center gap-3 rounded-2xl p-2.5 no-underline transition-colors hover:bg-cloud"
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-oca-tint text-oca">
                          <ClipboardIcon size={20} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-ink">
                            {q.title}
                          </p>
                          <p className="text-ink/45 truncate text-sm">
                            {q.questionCount} question
                            {q.questionCount > 1 ? 's' : ''}
                            {q.module ? ` · ${q.module.title}` : ''}
                          </p>
                        </div>
                        {q.lastAttempt && q.lastAttempt.percentage !== null ? (
                          <Badge tone="neutral">
                            {q.lastAttempt.percentage} %
                          </Badge>
                        ) : (
                          <Badge tone="neutral">À faire</Badge>
                        )}
                        <ChevronRightIcon size={16} className="text-ink/30" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}
        </>
      )}
    </AppShell>
  )
}

// Protection côté serveur : étudiant *et* inscrit au semestre de ce cours.
export const getServerSideProps = requireEnrolledCoursePage()
