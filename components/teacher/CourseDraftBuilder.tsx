import { useEffect, useMemo, useState } from 'react'
import { Drawer } from '../overlay/Drawer'
import { Button, buttonClasses } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'
import { SparkIcon } from '../ui/icons'

interface Preview {
  courseSummary: string
  modules: Array<{
    title: string
    description: string
    learningObjectives: string[]
    lessons: Array<{
      title: string
      estimatedMinutes: number
      keyConcepts?: string[]
      exercises?: string[]
      content: string
    }>
    quizzes: Array<{ title: string; questions: unknown[] }>
  }>
}

interface GeneratedResponse {
  id: string
  preview: Preview
  disclaimer: string
  warnings: Array<{ code: string; message: string; path?: string }>
}

export function CourseDraftBuilder({
  open,
  courseId,
  hasModules,
  onClose,
  onApplied,
  onToast,
}: {
  open: boolean
  courseId: string
  hasModules: boolean
  onClose: () => void
  onApplied: () => void
  onToast: (title: string, description?: string, error?: boolean) => void
}) {
  const [form, setForm] = useState({
    objective: '',
    targetLevel: '',
    moduleCount: '2',
    lessonsPerModule: '2',
    includeQuizzes: false,
    mode: 'APPEND_ONLY',
  })
  const [generated, setGenerated] = useState<GeneratedResponse | null>(null)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState('')
  const [lastFailureReason, setLastFailureReason] = useState('')

  useEffect(() => {
    if (!open) {
      setGenerated(null)
      setError('')
    }
  }, [open])

  const counts = useMemo(() => {
    const modules = generated?.preview.modules ?? []
    return {
      modules: modules.length,
      lessons: modules.reduce((sum, module) => sum + module.lessons.length, 0),
      quizzes: modules.reduce((sum, module) => sum + module.quizzes.length, 0),
      questions: modules.reduce(
        (sum, module) =>
          sum +
          module.quizzes.reduce(
            (quizSum, quiz) => quizSum + quiz.questions.length,
            0
          ),
        0
      ),
      averageContentLength:
        modules.length === 0
          ? 0
          : Math.round(
              modules.reduce(
                (sum, module) =>
                  sum +
                  module.lessons.reduce(
                    (lessonSum, lesson) => lessonSum + lesson.content.length,
                    0
                  ),
                0
              ) /
                Math.max(
                  1,
                  modules.reduce(
                    (sum, module) => sum + module.lessons.length,
                    0
                  )
                )
            ),
    }
  }, [generated])

  const generate = async () => {
    if (generating || applying) return
    setGenerating(true)
    setError('')
    setGenerated(null)
    try {
      const response = await fetch(
        `/api/teacher/courses/${courseId}/ai/course-draft`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...form,
            moduleCount: Number(form.moduleCount),
            lessonsPerModule: Number(form.lessonsPerModule),
          }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setLastFailureReason(data.failureReason || data.code || '')
        throw new Error(data.message || 'Génération impossible')
      }
      setLastFailureReason('')
      setGenerated(data)
    } catch (caught: any) {
      setError(caught.message || 'Génération impossible')
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!generated || generating || applying) return
    setApplying(true)
    setError('')
    try {
      const response = await fetch(
        `/api/teacher/courses/${courseId}/ai/course-draft/apply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiGenerationId: generated.id }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(data.message || 'Application impossible')
      onToast(
        'Brouillon appliqué',
        `${data.created.modules} module(s), ${data.created.lessons} leçon(s) et ${data.created.quizzes} quiz créés en brouillon.`
      )
      onApplied()
      onClose()
    } catch (caught: any) {
      setError(caught.message || 'Application impossible')
    } finally {
      setApplying(false)
    }
  }

  const busy = generating || applying
  const requestedModules = Number(form.moduleCount) || 0
  const requestedLessonsPerModule = Number(form.lessonsPerModule) || 0
  const requestedLessonTotal = requestedModules * requestedLessonsPerModule
  const largeWithQuizzes = form.includeQuizzes && requestedLessonTotal > 6

  return (
    <Drawer
      open={open}
      onClose={busy ? () => undefined : onClose}
      title="Générer un cours brouillon"
      description={
        generated
          ? 'Prévisualisation avant application'
          : 'Structure et contenus pédagogiques'
      }
      icon={<SparkIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className={buttonClasses('secondary', 'md')}
          >
            Annuler
          </button>
          {generated ? (
            <Button onClick={apply} loading={applying} disabled={busy}>
              Appliquer le brouillon
            </Button>
          ) : (
            <Button onClick={generate} loading={generating} disabled={busy}>
              Générer la prévisualisation
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          L’IA crée uniquement un brouillon. Vous devez relire chaque module,
          leçon et quiz, puis les publier manuellement.
        </div>

        {!generated ? (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Objectif du cours (optionnel)
              </span>
              <textarea
                value={form.objective}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    objective: event.target.value,
                  }))
                }
                maxLength={1200}
                rows={4}
                disabled={busy}
                placeholder="Compétences ou résultats d’apprentissage recherchés…"
                className="focus:ring-apple/15 w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
              />
              <span className="mt-1 block text-right text-xs text-ink/40">
                {form.objective.length}/1200
              </span>
            </label>

            <Input
              label="Niveau cible (optionnel)"
              value={form.targetLevel}
              maxLength={200}
              disabled={busy}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  targetLevel: event.target.value,
                }))
              }
              placeholder="Ex. Licence 2 — intermédiaire"
            />

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Modules"
                type="number"
                min={1}
                max={8}
                value={form.moduleCount}
                disabled={busy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    moduleCount: event.target.value,
                  }))
                }
                hint="1 à 8"
              />
              <Input
                label="Leçons / module"
                type="number"
                min={1}
                max={6}
                value={form.lessonsPerModule}
                disabled={busy}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lessonsPerModule: event.target.value,
                  }))
                }
                hint="30 leçons maximum au total"
              />
            </div>

            <div className="rounded-card border border-hairline bg-cloud/60 p-4">
              <p className="text-sm font-medium text-ink">Complexité estimée</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="neutral">{requestedModules} modules</Badge>
                <Badge tone="neutral">{requestedLessonTotal} leçons</Badge>
                <Badge tone={form.includeQuizzes ? 'warning' : 'neutral'}>
                  Quiz {form.includeQuizzes ? 'activés' : 'désactivés'}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-ink/50">
                Pour une qualité optimale, commencez avec 2–3 modules et 2–3
                leçons par module.
              </p>
            </div>

            {largeWithQuizzes && (
              <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Les gros brouillons avec quiz peuvent prendre plus de temps et
                être moins fiables. Les quiz pourront être omis pour préserver
                la qualité des leçons.
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Mode d’ajout
              </span>
              <select
                value={form.mode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    mode: event.target.value,
                  }))
                }
                disabled={busy}
                className="focus:ring-apple/15 h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
              >
                <option value="APPEND_ONLY">
                  Ajouter après le contenu existant
                </option>
                <option value="EMPTY_COURSE_ONLY" disabled={hasModules}>
                  Uniquement si le cours est vide
                </option>
              </select>
              {hasModules && (
                <span className="text-ink/45 mt-1 block text-xs">
                  Le mode « cours vide » est indisponible car ce cours contient
                  déjà des modules.
                </span>
              )}
            </label>

            <label className="flex items-start gap-3 rounded-card border border-hairline bg-white p-4">
              <input
                type="checkbox"
                checked={form.includeQuizzes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    includeQuizzes: event.target.checked,
                  }))
                }
                disabled={busy}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-sm font-medium text-ink">
                  Inclure des quiz formatifs brouillons
                </span>
                <span className="text-ink/45 mt-0.5 block text-xs">
                  Jamais publiés automatiquement et sans note officielle.
                </span>
              </span>
            </label>
          </>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-ink/60">
              {generated.preview.courseSummary}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">{counts.modules} modules brouillons</Badge>
              <Badge tone="neutral">{counts.lessons} leçons</Badge>
              <Badge tone="neutral">{counts.quizzes} quiz</Badge>
              {counts.questions > 0 && (
                <Badge tone="neutral">{counts.questions} questions</Badge>
              )}
              <Badge tone="success">Contenu approfondi validé</Badge>
            </div>
            <p className="text-ink/45 text-xs">
              Longueur pédagogique moyenne : {counts.averageContentLength}{' '}
              caractères par leçon.
            </p>
            {generated.warnings?.length > 0 && (
              <div className="space-y-2">
                {generated.warnings.map((warning, index) => (
                  <div
                    key={`${warning.code}-${index}`}
                    className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
                  >
                    {warning.message}
                  </div>
                ))}
              </div>
            )}
            <ul className="space-y-3">
              {generated.preview.modules.map((module, index) => (
                <li
                  key={`${module.title}-${index}`}
                  className="rounded-card border border-hairline bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[15px] font-medium text-ink">
                        {index + 1}. {module.title}
                      </p>
                      <p className="mt-1 text-sm text-ink/50">
                        {module.description}
                      </p>
                    </div>
                    <Badge tone="warning">Brouillon</Badge>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm text-ink/60">
                    {module.lessons.map((lesson, lessonIndex) => (
                      <li key={`${lesson.title}-${lessonIndex}`}>
                        • {lesson.title} · {lesson.estimatedMinutes} min ·{' '}
                        {lesson.keyConcepts?.length ?? 0} concept(s) clé(s) ·{' '}
                        {lesson.exercises?.length ?? 0} exercice(s)
                      </li>
                    ))}
                  </ul>
                  {module.quizzes.length > 0 && (
                    <p className="mt-3 text-xs font-medium text-apple">
                      {module.quizzes.length} quiz ·{' '}
                      {module.quizzes.reduce(
                        (sum, quiz) => sum + quiz.questions.length,
                        0
                      )}{' '}
                      questions
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
            {lastFailureReason && (
              <span className="mt-1 block text-xs text-red-500">
                Dernier motif : {lastFailureReason}
              </span>
            )}
          </div>
        )}
      </div>
    </Drawer>
  )
}
