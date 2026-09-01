import { requireAssignedCoursePage } from '../../../../lib/pageGuard'
import { resolveInitialSelection } from '../../../../lib/editorSelection'
import { MetadataPanel } from '../../../../components/teacher/MetadataPanel'
import { CourseBuildPanel } from '../../../../components/teacher/CourseBuildPanel'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../../components/app/AppShell'
import { Card } from '../../../../components/ui/Card'
import { Badge } from '../../../../components/ui/Badge'
import { Button, buttonClasses } from '../../../../components/ui/Button'
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
  const { courseId, moduleId, lessonId, build } = router.query
  const { toast } = useToast()

  const [course, setCourse] = useState<EditorCourse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [focusedModuleId, setFocusedModuleId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  // `?build=ai` ouvre le panneau de construction ; il reste ensuite pilotable
  // depuis le bouton du Studio, sans dépendre de l'URL.
  const [building, setBuilding] = useState(false)
  const buildRequested = useRef(false)

  /**
   * Sélectionner une leçon met l'URL à jour sans recharger la page : le lien
   * reste partageable et le rechargement retombe au bon endroit.
   */
  const select = useCallback(
    (id: string, ownerModuleId?: string) => {
      setSelectedId(id)
      setFocusedModuleId(ownerModuleId ?? null)
      if (typeof courseId !== 'string') return
      router.replace(
        { pathname: router.pathname, query: { courseId, lessonId: id } },
        undefined,
        { shallow: true }
      )
    },
    [courseId, router]
  )

  /**
   * Le lien profond ne s'applique qu'une fois : passé le premier chargement,
   * c'est la sélection de l'enseignant qui fait foi, et un enregistrement ou
   * une suppression ne doit pas le renvoyer ailleurs.
   */
  const deepLinkApplied = useRef(false)

  /**
   * Paramètres d'URL lus au moment du chargement plutôt qu'en dépendance :
   * sans cela, synchroniser l'URL à chaque sélection relancerait une requête.
   */
  const deepLink = useRef<{ lessonId?: string; moduleId?: string }>({})
  deepLink.current = {
    lessonId: typeof lessonId === 'string' ? lessonId : undefined,
    moduleId: typeof moduleId === 'string' ? moduleId : undefined,
  }

  useEffect(() => {
    if (buildRequested.current) return
    if (build === 'ai') {
      buildRequested.current = true
      setBuilding(true)
    }
  }, [build])

  const load = useCallback(async () => {
    if (typeof courseId !== 'string') return
    const response = await fetch(`/api/teacher/courses/${courseId}/editor`)
    if (!response.ok) return null
    const data: EditorCourse = await response.json()
    setCourse(data)

    const all = data.modules.flatMap((m) => m.lessons)

    if (!deepLinkApplied.current) {
      deepLinkApplied.current = true

      const initial = resolveInitialSelection(data.modules, deepLink.current)

      setSelectedId(initial.lessonId)
      setFocusedModuleId(initial.moduleId)
      return data
    }

    // Repli : on garde la leçon courante si elle existe encore.
    setSelectedId((current) => {
      if (current && all.some((l) => l.id === current)) return current
      return all[0]?.id ?? null
    })

    return data
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

  /** Module ciblé par un lien profond mais dépourvu de leçon. */
  const emptyFocusedModule = useMemo(() => {
    if (selectedId || !focusedModuleId) return null
    const module = course?.modules.find((m) => m.id === focusedModuleId)
    return module && module.lessons.length === 0 ? module : null
  }, [course, focusedModuleId, selectedId])

  /** `load` renvoie les données ; les composants n'en attendent aucune. */
  const refresh = useCallback(async () => {
    await load()
  }, [load])

  /** Retire `?build=ai` de l'URL, sans rechargement. */
  const clearBuildParam = useCallback(() => {
    if (typeof courseId !== 'string') return
    router.replace(
      { pathname: router.pathname, query: { courseId } },
      undefined,
      { shallow: true }
    )
  }, [courseId, router])

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

  /**
   * Suppression. Même protocole que la publication : un refus
   * `CONFIRMATION_REQUIRED` remonte le détail de ce qui serait détruit au lieu
   * de passer pour une erreur.
   */
  const remove = async (
    url: string,
    key: string,
    label: string,
    confirm?: boolean
  ): Promise<PublishResult> => {
    setBusy(key)
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirm ? { confirm: true } : {}),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.code === 'CONFIRMATION_REQUIRED') {
          return { needsConfirm: true, message: data.message }
        }
        throw new Error(data.message || 'Suppression impossible')
      }

      // Le rechargement resélectionne une leçon disponible, ou aucune.
      await load()
      toast({
        title: label,
        description:
          data.impact && data.impact.hiddenQuizCount > 0
            ? `${data.impact.hiddenQuizCount} quiz archivé(s) : masqué(s) aux étudiants, conservé(s) dans vos quiz.`
            : undefined,
        tone: 'success',
      })
      return { needsConfirm: false }
    } catch (err: any) {
      toast({
        title: 'Suppression impossible',
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
      title="Course Studio"
      subtitle={
        course
          ? `${course.title} · ${course.code} · ${course.semester.name} ${course.semester.academicYear}`
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

          {building ? (
            <CourseBuildPanel
              courseId={typeof courseId === 'string' ? courseId : ''}
              hasModules={course.modules.length > 0}
              onClose={() => {
                setBuilding(false)
                clearBuildParam()
              }}
              onApplied={async (created) => {
                const before = new Set(
                  course.modules.flatMap((m) => m.lessons.map((l) => l.id))
                )
                const data = await load()
                // Sélectionne la première leçon réellement créée, s'il y en a.
                const fresh = (data?.modules ?? [])
                  .flatMap((m) =>
                    m.lessons.map((l) => ({ lessonId: l.id, moduleId: m.id }))
                  )
                  .find((l) => !before.has(l.lessonId))
                setBuilding(false)
                if (fresh) {
                  select(fresh.lessonId, fresh.moduleId)
                } else {
                  clearBuildParam()
                }
              }}
              onToast={(title, description, isError) =>
                toast({
                  title,
                  description,
                  tone: isError ? 'error' : 'success',
                })
              }
            />
          ) : (
            <ReviewSummary
              course={course}
              onBuild={() => setBuilding(true)}
            />
          )}

          <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
            {/* Navigation : modules et leçons, visible pendant l'édition */}
            <div className="space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:pb-4">
              {course.modules.map((module) => (
                <ModuleNav
                  key={module.id}
                  module={module}
                  selectedId={selectedId}
                  focused={module.id === focusedModuleId}
                  busy={busy}
                  onSelect={(id) => select(id, module.id)}
                  onPublishModule={(payload, key, label) =>
                    publish(
                      `/api/teacher/modules/${module.id}/publish`,
                      payload,
                      key,
                      label
                    )
                  }
                  onDeleteModule={(confirm) =>
                    remove(
                      `/api/teacher/modules/${module.id}`,
                      `delete:${module.id}`,
                      'Module supprimé',
                      confirm
                    )
                  }
                />
              ))}
            </div>

            {/* Leçon sélectionnée */}
            <div>
              {!selectedLesson && emptyFocusedModule ? (
                <div className="space-y-5">
                  <MetadataPanel
                    key={`meta-${emptyFocusedModule.id}`}
                    module={emptyFocusedModule}
                    lesson={null}
                    onSaved={refresh}
                    onToast={(title, description, isError) =>
                      toast({
                        title,
                        description,
                        tone: isError ? 'error' : 'success',
                      })
                    }
                  />
                  <Card>
                    <EmptyState
                      icon={<LayersIcon size={22} />}
                      title={`${emptyFocusedModule.title} — aucune leçon`}
                      description="Ajoutez une leçon depuis la page du cours pour commencer à l’éditer ici."
                    />
                  </Card>
                </div>
              ) : selectedLesson && selectedModule ? (
                <div className="space-y-5">
                  <MetadataPanel
                    key={`meta-${selectedModule.id}-${selectedLesson.id}`}
                    module={selectedModule}
                    lesson={selectedLesson}
                    onSaved={refresh}
                    onToast={(title, description, isError) =>
                      toast({
                        title,
                        description,
                        tone: isError ? 'error' : 'success',
                      })
                    }
                  />

                  <LessonSectionEditor
                  key={selectedLesson.id}
                  lesson={selectedLesson}
                  moduleTitle={selectedModule.title}
                  busy={busy === `lesson:${selectedLesson.id}`}
                  onSaved={refresh}
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
                  onDelete={(confirm) =>
                    remove(
                      `/api/teacher/lessons/${selectedLesson.id}`,
                      `lesson:${selectedLesson.id}`,
                      'Leçon supprimée',
                      confirm
                    )
                  }
                  />
                </div>
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

/** Une mesure : valeur lisible, intitulé discret, teinte seulement si utile. */
function Stat({
  value,
  label,
  alert,
}: {
  value: string
  label: string
  alert?: boolean
}) {
  return (
    <div className="min-w-0">
      <p
        className={
          'text-lg font-medium tracking-tight ' +
          (alert ? 'text-amber-600' : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="text-ink/45 text-xs leading-tight">{label}</p>
    </div>
  )
}

/** Ce qui reste à relire, en un coup d'œil. Aucune action, aucun jugement. */
function ReviewSummary({
  course,
  onBuild,
}: {
  course: EditorCourse
  onBuild: () => void
}) {
  const r = course.review
  const coursePublished = course.status === 'PUBLISHED'

  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-medium text-ink">
            État de la relecture
          </p>
          <Badge tone={coursePublished ? 'success' : 'warning'}>
            {coursePublished ? 'Cours publié' : 'Cours non publié'}
          </Badge>
        </div>
        <button onClick={onBuild} className={buttonClasses('secondary', 'md')}>
          Construire avec l’IA
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          value={String(r.draftModules)}
          label="modules en brouillon"
          alert={r.draftModules > 0}
        />
        <Stat
          value={String(r.draftLessons)}
          label="leçons en brouillon"
          alert={r.draftLessons > 0}
        />
        <Stat
          value={String(r.tooLightLessons)}
          label="leçons trop légères"
          alert={r.tooLightLessons > 0}
        />
        <Stat
          value={String(r.lessonsMissingSections)}
          label="avec sections manquantes"
          alert={r.lessonsMissingSections > 0}
        />
        <Stat
          value={`${r.visibleLessons} / ${r.totalLessons}`}
          label="visibles aux étudiants"
        />
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
  focused,
  busy,
  onSelect,
  onPublishModule,
  onDeleteModule,
}: {
  module: EditorModule
  selectedId: string | null
  focused: boolean
  busy: string | null
  onSelect: (id: string) => void
  onPublishModule: (
    payload: Record<string, unknown>,
    key: string,
    label: string
  ) => Promise<PublishResult>
  onDeleteModule: (confirm?: boolean) => Promise<PublishResult>
}) {
  const published = module.status === 'PUBLISHED'
  const draftLessons = module.lessons.filter((l) => l.status === 'DRAFT')
  const weakDrafts = draftLessons.filter(
    (l) => l.quality.readiness === 'TOO_LIGHT'
  ).length

  const [bulkWarning, setBulkWarning] = useState<string | null>(null)
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null)

  const askBulk = async () => {
    const result = await onPublishModule(
      { includeLessons: true },
      `bulk:${module.id}`,
      'Module et leçons publiés'
    )
    if (result.needsConfirm) setBulkWarning(result.message ?? null)
  }

  return (
    <Card className={focused ? 'border-apple/40' : undefined}>
      <p className="text-[15px] font-medium leading-snug text-ink">
        {module.order + 1}. {module.title}
      </p>

      <div className="mb-3 mt-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={published ? 'success' : 'warning'}>
          {published ? 'Publié' : 'Brouillon'}
        </Badge>
        <span className="text-ink/45 text-xs">
          {module.visibility.visible ? 'visible' : 'masqué'} ·{' '}
          {module.publishedLessonCount}/{module.lessons.length} publiée(s)
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

      <div className="mt-3 border-t border-hairline pt-3">
        {published ? (
          <Button
            variant="secondary"
            size="md"
            className="w-full"
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
              className="w-full"
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
              <p className="text-ink/45 mt-2 text-xs leading-relaxed">
                {module.lessons.length === 0
                  ? 'Ce module n’a aucune leçon.'
                  : 'Publiez d’abord une leçon : un module sans leçon publiée apparaîtrait vide aux étudiants.'}
              </p>
            )}
          </>
        )}
      </div>

      {/* Suppression du module : conséquences annoncées avant tout effet. */}
      <div className="mt-3">
        {deleteWarning ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{deleteWarning}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Button
                size="md"
                loading={busy === `delete:${module.id}`}
                onClick={async () => {
                  await onDeleteModule(true)
                  setDeleteWarning(null)
                }}
              >
                Oui, supprimer définitivement
              </Button>
              <button
                onClick={() => setDeleteWarning(null)}
                className="text-ink/60 text-sm font-medium hover:underline"
              >
                Annuler
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={async () => {
              const result = await onDeleteModule()
              if (result.needsConfirm) {
                setDeleteWarning(result.message ?? 'Supprimer ce module ?')
              }
            }}
            className="text-sm font-medium text-red-500 hover:underline"
          >
            Supprimer le module
          </button>
        )}
      </div>

      {/* Seule action groupée autorisée, et jamais sans confirmation. */}
      {draftLessons.length > 0 && (
        <div className="mt-2">
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
