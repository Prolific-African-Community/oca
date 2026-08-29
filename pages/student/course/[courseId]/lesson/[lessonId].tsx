import { requireEnrolledCoursePage } from '../../../../../lib/pageGuard'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../../../components/app/AppShell'
import { Card } from '../../../../../components/ui/Card'
import { Badge } from '../../../../../components/ui/Badge'
import { EmptyState } from '../../../../../components/ui/EmptyState'
import { Skeleton } from '../../../../../components/ui/Skeleton'
import { Button, buttonClasses } from '../../../../../components/ui/Button'
import { Reveal } from '../../../../../components/anim/Reveal'
import { BookIcon, ChevronRightIcon } from '../../../../../components/ui/icons'

type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

interface LessonView {
  id: string
  title: string
  content: string | null
  estimatedMinutes: number | null
  module: { id: string; title: string }
  course: { id: string; title: string; code: string }
  position: { index: number; total: number }
  previous: { id: string; title: string } | null
  next: { id: string; title: string } | null
  progress: { status: ProgressStatus; completedAt: string | null }
}

export default function StudentLessonPage() {
  const router = useRouter()
  const { courseId, lessonId } = router.query

  const [lesson, setLesson] = useState<LessonView | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (typeof lessonId !== 'string') return
    setLesson(null)
    setNotFound(false)

    fetch(`/api/student/lessons/${lessonId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => (d ? setLesson(d) : setNotFound(true)))
      .catch(() => setNotFound(true))

    // Ouvrir la leçon vaut consultation : enregistré côté serveur, sans bloquer l'affichage.
    fetch(`/api/student/lessons/${lessonId}/view`, { method: 'POST' }).catch(
      () => {}
    )
  }, [lessonId])

  const completed = lesson?.progress.status === 'COMPLETED'

  const toggleCompletion = async () => {
    if (typeof lessonId !== 'string' || !lesson) return
    setSaving(true)
    try {
      const res = await fetch(`/api/student/lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      })
      if (!res.ok) return
      const progress = await res.json()
      setLesson((prev) => (prev ? { ...prev, progress } : prev))
    } finally {
      setSaving(false)
    }
  }

  const backHref =
    typeof courseId === 'string'
      ? `/student/course/${courseId}`
      : '/student/courses'

  return (
    <AppShell
      role="student"
      requiredRole="student"
      maxWidth="narrow"
      title={lesson?.title ?? 'Leçon'}
      subtitle={
        lesson ? `${lesson.course.code} · ${lesson.module.title}` : undefined
      }
    >
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← {lesson?.course.title ?? 'Retour au cours'}
      </Link>

      {notFound ? (
        <Card>
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Leçon indisponible"
            description="Cette leçon n’est pas publiée ou ne fait pas partie de vos cours."
          />
        </Card>
      ) : !lesson ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Reveal>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">
                  Leçon {lesson.position.index} / {lesson.position.total}
                </Badge>
                {lesson.estimatedMinutes && (
                  <Badge tone="neutral">{lesson.estimatedMinutes} min</Badge>
                )}
                {completed && <Badge tone="success">Terminée</Badge>}
              </div>

              {lesson.content ? (
                // Contenu en texte simple à ce stade : on préserve les retours à la ligne.
                <p className="mt-5 whitespace-pre-wrap text-[16px] leading-relaxed text-ink/75">
                  {lesson.content}
                </p>
              ) : (
                <p className="text-ink/45 mt-5 text-[15px]">
                  Cette leçon n’a pas encore de contenu rédigé.
                </p>
              )}
            </Card>
          </Reveal>

          <Reveal delay={60}>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-hero border border-hairline bg-white p-5 shadow-soft">
              <div>
                <p className="text-[15px] font-medium text-ink">
                  {completed
                    ? 'Leçon terminée'
                    : 'Vous avez terminé cette leçon ?'}
                </p>
                <p className="text-ink/45 text-sm">
                  {completed
                    ? 'Elle compte dans votre progression.'
                    : 'Marquez-la pour suivre votre avancement.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={toggleCompletion}
                  loading={saving}
                  variant={completed ? 'secondary' : 'primary'}
                >
                  {completed ? 'Annuler' : 'Marquer comme terminée'}
                </Button>
                {completed && lesson.next && (
                  <Link
                    href={`/student/course/${lesson.course.id}/lesson/${lesson.next.id}`}
                    className={buttonClasses('primary', 'md', 'no-underline')}
                  >
                    Leçon suivante
                    <ChevronRightIcon size={16} />
                  </Link>
                )}
              </div>
            </div>
          </Reveal>

          <div className="mt-5 flex items-center justify-between gap-3">
            {lesson.previous ? (
              <Link
                href={`/student/course/${lesson.course.id}/lesson/${lesson.previous.id}`}
                className="inline-flex max-w-[45%] items-center gap-1.5 text-sm font-medium text-apple no-underline hover:underline"
              >
                ← <span className="truncate">{lesson.previous.title}</span>
              </Link>
            ) : (
              <span />
            )}

            {lesson.next ? (
              <Link
                href={`/student/course/${lesson.course.id}/lesson/${lesson.next.id}`}
                className="inline-flex max-w-[45%] items-center gap-1.5 text-sm font-medium text-apple no-underline hover:underline"
              >
                <span className="truncate">{lesson.next.title}</span>
                <ChevronRightIcon size={15} />
              </Link>
            ) : (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-apple no-underline hover:underline"
              >
                Fin du module <ChevronRightIcon size={15} />
              </Link>
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}

// Protection côté serveur : étudiant inscrit au cours ; la leçon elle-même est
// revérifiée par l'API (publiée, module publié, cours accessible).
export const getServerSideProps = requireEnrolledCoursePage()
