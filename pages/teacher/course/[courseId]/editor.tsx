import { requireAssignedCoursePage } from '../../../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../../components/app/AppShell'
import { Card, CardHeader } from '../../../../components/ui/Card'
import { Badge } from '../../../../components/ui/Badge'
import { Button } from '../../../../components/ui/Button'
import { EmptyState } from '../../../../components/ui/EmptyState'
import { Skeleton } from '../../../../components/ui/Skeleton'
import { useToast } from '../../../../components/overlay/Toast'
import {
  LessonSectionEditor,
  VisibilityBadge,
} from '../../../../components/teacher/LessonSectionEditor'
import type {
  EditorCourse,
  EditorModule,
} from '../../../../components/teacher/LessonSectionEditor'
import { BookIcon, LayersIcon, CheckIcon } from '../../../../components/ui/icons'

/**
 * Éditeur de cours.
 *
 * Sortir l'édition du tiroir : navigation des modules à gauche, leçon
 * sélectionnée au centre, section par section. Rien n'est publié sans un
 * geste explicite de l'enseignant, et une publication signalée comme risquée
 * demande une seconde confirmation.
 */

/** Résultat d'une tentative de publication : le serveur peut exiger un accord. */
interface PublishResult {
  needsConfirm: boolean
  message?: string
}

export default function CourseEditorPage() {
  const router = useRouter()
  const { courseId } = router.query
  const { toast } = useToast()

  const [course, setCourse] = useState<EditorCourse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (typeof courseId !== 'string') return
    const response = await fetch(`/api/teacher/courses/${courseId}/editor`)
    if (!response.ok) return
    const data: EditorCourse = await response.json()
    setCourse(data)
    setSelectedId((current) => {
      const all = data.modules.flatMap((m) => m.lessons)
      if (current && all.some((l) => l.id === current)) return current
      return all[0]?.id ?? null
    })
  }, [courseId])

  useEffect(() => {
    load().catch(() => setCourse(null))
  }, [load])

  const { selectedLesson, selectedModule } = useMemo(() => {
    for (const module of course?.modules ?? []) {
      const lesson = module.lessons.find((l) => l.id === selectedId)
      if (lesson) return { selectedLesson: lesson, selectedModule: module }
    }
    return { selectedLesson: null, selectedModule: null }
  }, [course, selectedId])

  /**
   * Publication. Un refus `CONFIRMATION_REQUIRED` n'est pas une erreur : c'est
   * un garde-fou, remonté au composant qui affichera l'avertissement.
   */
  const publish = async (
    url: string,
    payload: Record<string, unknown>,
    key: string,
    label: string
  ): Promise<PublishResult> => {
    setBusy(key)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.code === 'CONFIRMATION_REQUIRED') {
          return { needsConfirm: true, message: data.message }
        }
        throw new Error(data.message || 'Action impossible')
      }

      await load()
      toast({
        title: label,
        description: data.publishedLessons
          ? `${data.publishedLessons} leçon(s) publiée(s).`
          : undefined,
        tone: 'success',
      })
      return { needsConfirm: false }
    } catch (err: any) {
      toast({
        title: 'Action impossible',
        description: err.message,
        tone: 'error',
      })
      return { needsConfirm: false }
    } finally {
      setBusy(null)
    }
  }

  return (
    <AppShell
      role="teacher"
      requiredRole="teacher"
      title={course ? `Éditeur — ${course.title}` : 'Éditeur de cours'}
      subtitle={
        course
          ? `${course.code} · ${course.program.name} · ${course.semester.name} ${course.semester.academicYear}`
          : undefined
      }
    >
      <Link
        href={typeof courseId === 'string' ? `/teacher/course/${courseId}` : '/teacher'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← Retour au cours
      </Link>

      {!course ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : course.modules.length === 0 ? (
        <Card>
          <EmptyState
            icon={<LayersIcon size={22} />}
            title="Aucun module"
            description="Créez un module depuis la page du cours avant de commencer l’édition."
          />
        </Card>
      ) : (
        <>
          {isDemoCourse(course.code) && <DemoBanner />}
          <ReviewSummary course={course} />

          <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
            {/* Navigation : modules et leçons */}
            <div className="space-y-4">
              {course.modules.map((module) => (
                <ModuleNav
                  key={module.id}
                  module={module}
                  selectedId={selectedId}
                  busy={busy}
                  onSelect={setSelectedId}
                  onPublishModule={(payload, key, label) =>
                    publish(
                      `/api/teacher/modules/${module.id}/publish`,
                      payload,
                      key,
                      label
                    )
                  }
                />
              ))}
            </div>

            {/* Leçon sélectionnée */}
            <div>
              {selectedLesson && selectedModule ? (
                <LessonSectionEditor
                  key={selectedLesson.id}
                  lesson={selectedLesson}
                  moduleTitle={selectedModule.title}
                  busy={busy === `lesson:${selectedLesson.id}`}
                  onSaved={load}
                  onToast={(title, description, isError) =>
                    toast({
                      title,
                      description,
                      tone: isError ? 'error' : 'success',
                    })
                  }
                  onPublish={(published, confirm) =>
                    publish(
                      `/api/teacher/lessons/${selectedLesson.id}/publish`,
                      confirm ? { published, confirm: true } : { published },
                      `lesson:${selectedLesson.id}`,
                      published ? 'Leçon publiée' : 'Leçon dépubliée'
                    )
                  }
                />
              ) : (
                <Card>
                  <EmptyState
                    icon={<BookIcon size={22} />}
                    title="Aucune leçon"
                    description="Ce cours n’a pas encore de leçon à éditer."
                  />
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  )
}

/**
 * Contenu de démonstration : signale sans ambiguïté qu’on peut tout y casser.
 * La détection tient au code du cours, seule convention garantie par le seed.
 */
export function isDemoCourse(code: string): boolean {
  return code.startsWith('TEST-') || code.startsWith('DEMO-')
}

function DemoBanner() {
  return (
    <div className="mb-5 rounded-card border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-800">
        Cours de démonstration
      </p>
      <p className="mt-1 text-sm text-amber-700">
        Ce cours sert aux tests du Course Studio. Son contenu n’a aucune valeur
        pédagogique et peut être publié, modifié ou réinitialisé à tout moment
        avec <code>npm run seed:studio-test</code>. Ne testez pas les actions
        destructrices sur un cours réel.
      </p>
    </div>
  )
}

/** Ce qui reste à relire, en un coup d'œil. Aucune action, aucun jugement. */
function ReviewSummary({ course }: { course: EditorCourse }) {
  const r = course.review
  const coursePublished = course.status === 'PUBLISHED'

  return (
    <Card className="mb-5">
      <CardHeader
        title="État de la relecture"
        action={
          <Badge tone={coursePublished ? 'success' : 'warning'}>
            {coursePublished ? 'Cours publié' : 'Cours non publié'}
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={r.draftModules > 0 ? 'warning' : 'neutral'}>
          {r.draftModules} module(s) en brouillon
        </Badge>
        <Badge tone={r.draftLessons > 0 ? 'warning' : 'neutral'}>
          {r.draftLessons} leçon(s) en brouillon
        </Badge>
        <Badge tone={r.tooLightLessons > 0 ? 'warning' : 'neutral'}>
          {r.tooLightLessons} leçon(s) trop légère(s)
        </Badge>
        <Badge tone={r.lessonsMissingSections > 0 ? 'warning' : 'neutral'}>
          {r.lessonsMissingSections} avec sections manquantes
        </Badge>
        <Badge tone="neutral">
          {r.visibleLessons} / {r.totalLessons} visible(s) aux étudiants
        </Badge>
      </div>

      {r.publishedTooLight > 0 && (
        <p className="mt-3 text-sm text-amber-600">
          {r.publishedTooLight} leçon(s) déjà publiée(s) sont jugées trop
          légères : les étudiants les voient en l’état.
        </p>
      )}

      {!coursePublished && (
        <p className="text-ink/45 mt-3 text-sm">
          Tant que le cours n’est pas publié, aucun contenu n’est accessible aux
          étudiants, même publié. Cette publication relève de l’administration.
        </p>
      )}
    </Card>
  )
}

function ModuleNav({
  module,
  selectedId,
  busy,
  onSelect,
  onPublishModule,
}: {
  module: EditorModule
  selectedId: string | null
  busy: string | null
  onSelect: (id: string) => void
  onPublishModule: (
    payload: Record<string, unknown>,
    key: string,
    label: string
  ) => Promise<PublishResult>
}) {
  const published = module.status === 'PUBLISHED'
  const draftLessons = module.lessons.filter((l) => l.status === 'DRAFT')
  const weakDrafts = draftLessons.filter(
    (l) => l.quality.readiness === 'TOO_LIGHT'
  ).length

  const [bulkWarning, setBulkWarning] = useState<string | null>(null)

  const askBulk = async () => {
    const result = await onPublishModule(
      { includeLessons: true },
      `bulk:${module.id}`,
      'Module et leçons publiés'
    )
    if (result.needsConfirm) setBulkWarning(result.message ?? null)
  }

  return (
    <Card>
      <CardHeader
        title={`${module.order + 1}. ${module.title}`}
        action={
          <Badge tone={published ? 'success' : 'warning'}>
            {published ? 'Publié' : 'Brouillon'}
          </Badge>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <VisibilityBadge visibility={module.visibility} />
        <span className="text-ink/45 text-sm">
          {module.publishedLessonCount} / {module.lessons.length} leçon(s)
          publiée(s)
        </span>
      </div>

      <ul className="space-y-1">
        {module.lessons.map((lesson) => (
          <li key={lesson.id}>
            <button
              onClick={() => onSelect(lesson.id)}
              className={
                'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ' +
                (selectedId === lesson.id
                  ? 'bg-oca-tint text-oca'
                  : 'text-ink/70 hover:bg-cloud')
              }
            >
              <span
                title={lesson.visibility.reason}
                className={
                  'grid h-6 w-6 shrink-0 place-items-center rounded-lg text-xs font-medium ' +
                  (lesson.visibility.visible
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-cloud text-ink/50')
                }
              >
                {lesson.status === 'PUBLISHED' ? (
                  <CheckIcon size={13} />
                ) : (
                  lesson.order + 1
                )}
              </span>
              <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
              {lesson.quality.readiness === 'TOO_LIGHT' && (
                <span
                  title="Trop léger"
                  aria-label="Trop léger"
                  className="shrink-0 text-xs text-amber-500"
                >
                  ▲
                </span>
              )}
              <span className="text-ink/35 shrink-0 text-xs">
                {lesson.estimatedMinutes ? `${lesson.estimatedMinutes}′` : '—'}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {published ? (
        <Button
          variant="secondary"
          size="md"
          className="mt-3 w-full"
          loading={busy === `module:${module.id}`}
          onClick={() =>
            onPublishModule(
              { published: false },
              `module:${module.id}`,
              'Module dépublié'
            )
          }
        >
          Dépublier le module
        </Button>
      ) : (
        <>
          <Button
            size="md"
            className="mt-3 w-full"
            disabled={module.publishedLessonCount === 0}
            loading={busy === `module:${module.id}`}
            onClick={() =>
              onPublishModule(
                { published: true },
                `module:${module.id}`,
                'Module publié'
              )
            }
          >
            Publier le module
          </Button>
          {module.publishedLessonCount === 0 && (
            <p className="text-ink/45 mt-2 text-sm">
              {module.lessons.length === 0
                ? 'Ce module n’a aucune leçon.'
                : 'Publiez d’abord au moins une leçon : un module sans leçon publiée apparaîtrait vide aux étudiants.'}
            </p>
          )}
        </>
      )}

      {/* Seule action groupée autorisée, et jamais sans confirmation. */}
      {draftLessons.length > 0 && (
        <div className="mt-3">
          {bulkWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                {bulkWarning}
                {weakDrafts > 0 &&
                  ` ${weakDrafts} d’entre elles sont jugées trop légères.`}
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <Button
                  size="md"
                  loading={busy === `bulk:${module.id}`}
                  onClick={async () => {
                    await onPublishModule(
                      { includeLessons: true, confirm: true },
                      `bulk:${module.id}`,
                      'Module et leçons publiés'
                    )
                    setBulkWarning(null)
                  }}
                >
                  Oui, publier
                </Button>
                <button
                  onClick={() => setBulkWarning(null)}
                  className="text-ink/60 text-sm font-medium hover:underline"
                >
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={askBulk}
              className="text-sm font-medium text-apple hover:underline"
            >
              Publier le module et ses {draftLessons.length} leçon(s)…
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

// Protection côté serveur : enseignant affecté à ce cours précis.
export const getServerSideProps = requireAssignedCoursePage()
