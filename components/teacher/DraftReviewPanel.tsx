import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button, buttonClasses } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Drawer } from '../overlay/Drawer'
import {
  CheckIcon,
  ClipboardIcon,
  LayersIcon,
  BookIcon,
} from '../ui/icons'

/**
 * Revue des brouillons d'un cours.
 *
 * Rien n'est publié automatiquement : chaque publication est un geste explicite
 * de l'enseignant, et la seule action groupée (toutes les leçons d'un module)
 * demande une confirmation supplémentaire.
 */

type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type Readiness = 'TOO_LIGHT' | 'ACCEPTABLE' | 'STRONG'

const READINESS_LABELS: Record<Readiness, string> = {
  TOO_LIGHT: 'Trop légère',
  ACCEPTABLE: 'Acceptable',
  STRONG: 'Solide',
}

const READINESS_TONES: Record<Readiness, 'warning' | 'neutral' | 'success'> = {
  TOO_LIGHT: 'warning',
  ACCEPTABLE: 'neutral',
  STRONG: 'success',
}

interface Visibility {
  visible: boolean
  label: string
  reason: string
}

interface DraftLesson {
  id: string
  title: string
  order: number
  estimatedMinutes: number | null
  contentLength: number
  structured: boolean
  readiness: Readiness
  missingSections: string[]
  aiGenerated: boolean
  warnings: string[]
}

interface DraftModule {
  id: string
  title: string
  order: number
  status: ContentStatus
  aiGenerated: boolean
  draftLessons: DraftLesson[]
  publishedLessonCount: number
  totalLessonCount: number
  visibility: Visibility
}

interface DraftQuiz {
  id: string
  title: string
  questionCount: number
  moduleTitle: string | null
  aiGenerated: boolean
  warnings: string[]
}

interface Overview {
  counts: {
    draftModules: number
    draftLessons: number
    draftQuizzes: number
    aiDraftItems: number
    lessonsTooLight: number
    lessonsMissingSections: number
    publishedTooLight: number
  }
  courseStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  modules: DraftModule[]
  quizzes: DraftQuiz[]
  lastAiBatch: {
    at: string
    actorName: string
    counts: Record<string, number>
  } | null
  lastAiGeneration: {
    at: string
    type: string
    model: string
    status: string
  } | null
}

function AiBadge() {
  return <Badge tone="warning">Brouillon IA — relecture requise</Badge>
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DraftReviewPanel({
  courseId,
  onChanged,
  onToast,
  onEditLesson,
}: {
  courseId: string
  onChanged: () => void
  onToast: (title: string, description?: string, error?: boolean) => void
  onEditLesson?: (moduleId: string, lessonId: string) => void
}) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmModule, setConfirmModule] = useState<string | null>(null)
  // Publication d'une leçon signalée comme faible : accord explicite.
  const [confirmLesson, setConfirmLesson] = useState<{
    id: string
    message: string
  } | null>(null)

  const load = useCallback(() => {
    if (!courseId) return
    fetch(`/api/teacher/courses/${courseId}/drafts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOverview(d))
      .catch(() => setOverview(null))
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const call = async (
    url: string,
    payload: Record<string, unknown>,
    key: string,
    successTitle: string
  ): Promise<{ needsConfirm: boolean; message?: string }> => {
    setBusy(key)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      // Un refus de confirmation est un garde-fou, pas une panne.
      if (!response.ok && data.code === 'CONFIRMATION_REQUIRED') {
        return { needsConfirm: true, message: data.message }
      }
      if (!response.ok) throw new Error(data.message || 'Publication impossible')

      load()
      onChanged()

      onToast(
        successTitle,
        data.publishedLessons
          ? `${data.publishedLessons} leçon(s) publiée(s).`
          : undefined
      )
      return { needsConfirm: false }
    } catch (err: any) {
      onToast('Publication impossible', err.message, true)
      return { needsConfirm: false }
    } finally {
      setBusy(null)
      setConfirmModule(null)
    }
  }

  const counts = overview?.counts
  const pending =
    (counts?.draftModules ?? 0) +
    (counts?.draftLessons ?? 0) +
    (counts?.draftQuizzes ?? 0)

  return (
    <>
      <Card>
        <CardHeader
          title="Brouillons à relire"
          action={
            pending > 0 ? (
              <button
                onClick={() => setOpen(true)}
                className="text-sm font-medium text-apple hover:underline"
              >
                Relire les brouillons
              </button>
            ) : null
          }
        />

        {!overview ? (
          <p className="text-ink/45 text-sm">Chargement…</p>
        ) : pending === 0 ? (
          <p className="text-ink/45 text-sm">
            Aucun brouillon en attente. Tout votre contenu est publié ou archivé.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="neutral">
                {counts!.draftModules} module{counts!.draftModules > 1 ? 's' : ''}
              </Badge>
              <Badge tone="neutral">
                {counts!.draftLessons} leçon{counts!.draftLessons > 1 ? 's' : ''}
              </Badge>
              <Badge tone="neutral">
                {counts!.draftQuizzes} quiz
              </Badge>
              {counts!.aiDraftItems > 0 && (
                <Badge tone="warning">
                  dont {counts!.aiDraftItems} générés par l’assistant
                </Badge>
              )}
              {counts!.lessonsTooLight > 0 && (
                <Badge tone="warning">
                  {counts!.lessonsTooLight} leçon(s) trop légère(s)
                </Badge>
              )}
              {counts!.lessonsMissingSections > 0 && (
                <Badge tone="warning">
                  {counts!.lessonsMissingSections} avec sections manquantes
                </Badge>
              )}
            </div>

            {counts!.publishedTooLight > 0 && (
              <p className="mt-3 text-sm text-amber-600">
                {counts!.publishedTooLight} leçon(s) déjà publiée(s) sont jugées
                trop légères : les étudiants les voient en l’état.
              </p>
            )}

            {overview.courseStatus !== 'PUBLISHED' && (
              <p className="text-ink/45 mt-3 text-sm">
                Le cours n’est pas publié : même publiés, ses contenus restent
                invisibles aux étudiants.
              </p>
            )}

            {!overview.lastAiBatch && overview.lastAiGeneration && (
              <p className="text-ink/45 mt-3 text-sm">
                Dernière génération assistée :{' '}
                {formatDate(overview.lastAiGeneration.at)} ·{' '}
                {overview.lastAiGeneration.model}
              </p>
            )}

            {overview.lastAiBatch && (
              <p className="text-ink/45 mt-3 text-sm">
                Dernière génération : {formatDate(overview.lastAiBatch.at)} ·{' '}
                {overview.lastAiBatch.actorName}
                {Object.entries(overview.lastAiBatch.counts).length > 0
                  ? ` · ${Object.entries(overview.lastAiBatch.counts)
                      .map(([k, v]) => `${v} ${k}`)
                      .join(', ')}`
                  : ''}
              </p>
            )}

            <button
              onClick={() => setOpen(true)}
              className={buttonClasses('primary', 'md', 'mt-4')}
            >
              Relire les brouillons
            </button>
          </>
        )}
      </Card>

      {open && overview && (
        <Drawer
          open
          onClose={() => setOpen(false)}
          title="Revue des brouillons"
          description="Rien n’est publié tant que vous ne l’avez pas décidé"
          icon={<LayersIcon size={20} />}
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className={buttonClasses('secondary', 'md')}
              >
                Fermer
              </button>
            </div>
          }
        >
          <div className="space-y-5">
            {overview.modules.length === 0 && overview.quizzes.length === 0 && (
              <EmptyState
                icon={<CheckIcon size={22} />}
                title="Rien à relire"
                description="Tous vos modules, leçons et quiz sont publiés."
              />
            )}

            {overview.modules.map((module) => (
              <div
                key={module.id}
                className="rounded-xl border border-hairline bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      {module.order + 1}. {module.title}
                    </p>
                    <p className="text-ink/45 mt-0.5 text-sm">
                      {module.publishedLessonCount} / {module.totalLessonCount}{' '}
                      leçon(s) publiée(s)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {module.aiGenerated && <AiBadge />}
                    <Badge
                      tone={module.status === 'PUBLISHED' ? 'success' : 'warning'}
                    >
                      {module.status === 'PUBLISHED' ? 'Publié' : 'Brouillon'}
                    </Badge>
                    <Badge tone={module.visibility.visible ? 'success' : 'neutral'}>
                      {module.visibility.label}
                    </Badge>
                  </div>
                </div>

                <p className="text-ink/45 mt-1 text-sm">
                  {module.visibility.reason}
                </p>

                {module.status === 'DRAFT' && (
                  <Button
                    size="md"
                    className="mt-3"
                    loading={busy === `module:${module.id}`}
                    onClick={() =>
                      call(
                        `/api/teacher/modules/${module.id}/publish`,
                        {},
                        `module:${module.id}`,
                        'Module publié'
                      )
                    }
                  >
                    Publier le module
                  </Button>
                )}

                {module.draftLessons.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {module.draftLessons.map((lesson) => (
                      <li
                        key={lesson.id}
                        className="rounded-xl border border-hairline bg-cloud/60 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[15px] font-medium text-ink">
                              {lesson.title}
                            </p>
                            <p className="text-ink/45 mt-0.5 text-sm">
                              {lesson.estimatedMinutes
                                ? `${lesson.estimatedMinutes} min`
                                : 'Durée non précisée'}{' '}
                              · {lesson.contentLength} caractères
                              {lesson.structured ? ' · structurée' : ''}
                            </p>
                            {lesson.warnings.length > 0 && (
                              <p className="mt-1 text-sm text-amber-600">
                                {lesson.warnings.join(' · ')}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={READINESS_TONES[lesson.readiness]}>
                              {READINESS_LABELS[lesson.readiness]}
                            </Badge>
                            <Badge tone="neutral">Masquée aux étudiants</Badge>
                            {lesson.aiGenerated && <AiBadge />}
                          </div>
                        </div>

                        <div className="mt-2.5 flex flex-wrap items-center gap-3">
                          <Button
                            size="md"
                            loading={busy === `lesson:${lesson.id}`}
                            onClick={async () => {
                              const result = await call(
                                `/api/teacher/lessons/${lesson.id}/publish`,
                                {},
                                `lesson:${lesson.id}`,
                                'Leçon publiée'
                              )
                              if (result.needsConfirm) {
                                setConfirmLesson({
                                  id: lesson.id,
                                  message: result.message ?? '',
                                })
                              }
                            }}
                          >
                            Publier
                          </Button>
                          {onEditLesson && (
                            <button
                              onClick={() => {
                                setOpen(false)
                                onEditLesson(module.id, lesson.id)
                              }}
                              className="text-sm font-medium text-apple hover:underline"
                            >
                              Modifier
                            </button>
                          )}
                        </div>

                        {confirmLesson?.id === lesson.id && (
                          <div className="mt-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                            <p className="text-sm text-amber-800">
                              {confirmLesson.message}
                            </p>
                            <div className="mt-2.5 flex items-center gap-3">
                              <Button
                                size="md"
                                loading={busy === `lesson:${lesson.id}`}
                                onClick={async () => {
                                  await call(
                                    `/api/teacher/lessons/${lesson.id}/publish`,
                                    { confirm: true },
                                    `lesson:${lesson.id}`,
                                    'Leçon publiée'
                                  )
                                  setConfirmLesson(null)
                                }}
                              >
                                Publier quand même
                              </Button>
                              <button
                                onClick={() => setConfirmLesson(null)}
                                className="text-ink/60 text-sm font-medium hover:underline"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}

                    {confirmModule === module.id ? (
                      <li className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-amber-800">
                          Publier les {module.draftLessons.length} leçons en
                          brouillon de ce module ? Elles deviendront visibles des
                          étudiants immédiatement.
                        </p>
                        <div className="mt-2.5 flex items-center gap-3">
                          <Button
                            size="md"
                            loading={busy === `bulk:${module.id}`}
                            onClick={() =>
                              call(
                                `/api/teacher/modules/${module.id}/publish`,
                                { includeLessons: true, confirm: true },
                                `bulk:${module.id}`,
                                'Module et leçons publiés'
                              )
                            }
                          >
                            Oui, publier
                          </Button>
                          <button
                            onClick={() => setConfirmModule(null)}
                            className="text-sm font-medium text-ink/60 hover:underline"
                          >
                            Annuler
                          </button>
                        </div>
                      </li>
                    ) : (
                      <li>
                        <button
                          onClick={() => setConfirmModule(module.id)}
                          className="text-sm font-medium text-apple hover:underline"
                        >
                          Publier le module et ses {module.draftLessons.length}{' '}
                          leçons…
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            ))}

            {overview.quizzes.length > 0 && (
              <div className="rounded-xl border border-hairline bg-white p-4">
                <p className="mb-3 text-[15px] font-medium text-ink">
                  Quiz en brouillon
                </p>
                <ul className="space-y-2">
                  {overview.quizzes.map((quiz) => (
                    <li
                      key={quiz.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-cloud/60 p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-[15px] font-medium text-ink">
                          <ClipboardIcon size={15} /> {quiz.title}
                        </p>
                        <p className="text-ink/45 mt-0.5 text-sm">
                          {quiz.questionCount} question
                          {quiz.questionCount > 1 ? 's' : ''}
                          {quiz.moduleTitle ? ` · ${quiz.moduleTitle}` : ''}
                        </p>
                        {quiz.warnings.length > 0 && (
                          <p className="mt-1 text-sm text-amber-600">
                            {quiz.warnings.join(' · ')}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {quiz.aiGenerated && <AiBadge />}
                        <Button
                          size="md"
                          disabled={quiz.questionCount === 0}
                          loading={busy === `quiz:${quiz.id}`}
                          onClick={() =>
                            call(
                              `/api/teacher/quizzes/${quiz.id}/publish`,
                              {},
                              `quiz:${quiz.id}`,
                              'Quiz publié'
                            )
                          }
                        >
                          Publier
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-ink/45 text-sm">
              <BookIcon size={14} /> Les étudiants ne voient que les contenus
              publiés, dans un module publié d’un cours publié. Un module ne
              peut plus être publié sans au moins une leçon publiée.
            </p>
          </div>
        </Drawer>
      )}
    </>
  )
}
