import { useCallback, useEffect, useState } from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button, buttonClasses } from '../ui/Button'
import { Input } from '../ui/Input'
import { EmptyState } from '../ui/EmptyState'
import { Drawer } from '../overlay/Drawer'
import { ClipboardIcon, PlusIcon, CheckIcon } from '../ui/icons'

/**
 * Quiz d'un cours, côté enseignant : créer, questionner, publier.
 * Volontairement sobre — l'objectif est de rendre l'évaluation possible,
 * pas de livrer un éditeur de questionnaires complet.
 */

type QuizStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT'

interface Quiz {
  id: string
  title: string
  description: string | null
  status: QuizStatus
  passingScore: number | null
  questionCount: number
  attemptCount: number
}

interface Question {
  id: string
  prompt: string
  type: QuestionType
  options: string[] | null
  correctAnswer: unknown
  explanation: string | null
  points: number
  order: number
}

export interface QuizScopeModule {
  id: string
  title: string
  lessons: Array<{ id: string; title: string }>
}

const STATUS_LABELS: Record<QuizStatus, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
}

const STATUS_TONES: Record<QuizStatus, 'warning' | 'success' | 'neutral'> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
}

const TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Choix multiple',
  TRUE_FALSE: 'Vrai / Faux',
  SHORT_TEXT: 'Texte libre · correction manuelle',
}

export function QuizPanel({
  courseId,
  scopeModules,
  onToast,
}: {
  courseId: string
  scopeModules: QuizScopeModule[]
  onToast: (title: string, description?: string, error?: boolean) => void
}) {
  const [quizzes, setQuizzes] = useState<Quiz[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [openQuiz, setOpenQuiz] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!courseId) return
    fetch(`/api/teacher/courses/${courseId}/quizzes`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setQuizzes(Array.isArray(d) ? d : []))
      .catch(() => setQuizzes([]))
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Card>
      <CardHeader
        title="Quiz"
        action={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={() => setGenerating(true)}
              className="text-sm font-medium text-apple hover:underline"
            >
              Générer un brouillon
            </button>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1 text-sm font-medium text-apple hover:underline"
            >
              Nouveau quiz <PlusIcon size={15} />
            </button>
          </div>
        }
      />

      <p className="text-ink/45 mb-4 text-sm">
        Retours pédagogiques pour vos étudiants — ce ne sont pas des notes
        officielles.
      </p>

      {quizzes === null ? (
        <p className="text-ink/45 text-sm">Chargement…</p>
      ) : quizzes.length === 0 ? (
        <EmptyState
          icon={<ClipboardIcon size={22} />}
          title="Aucun quiz"
          description="Créez un quiz pour permettre à vos étudiants de s’auto-évaluer."
          action={
            <button
              onClick={() => setCreating(true)}
              className={buttonClasses('primary', 'md')}
            >
              <PlusIcon size={17} /> Nouveau quiz
            </button>
          }
        />
      ) : (
        <ul className="space-y-1">
          {quizzes.map((q) => (
            <li
              key={q.id}
              className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-oca-tint text-oca">
                <ClipboardIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {q.title}
                </p>
                <p className="text-ink/45 truncate text-sm">
                  {q.questionCount} question{q.questionCount > 1 ? 's' : ''} ·{' '}
                  {q.attemptCount} tentative{q.attemptCount > 1 ? 's' : ''}
                  {q.passingScore !== null
                    ? ` · seuil ${q.passingScore} %`
                    : ''}
                </p>
              </div>
              <Badge tone={STATUS_TONES[q.status]}>
                {STATUS_LABELS[q.status]}
              </Badge>
              <button
                onClick={() => setOpenQuiz(q.id)}
                className="text-sm font-medium text-apple hover:underline"
              >
                Ouvrir
              </button>
            </li>
          ))}
        </ul>
      )}

      <CreateQuizDrawer
        open={creating}
        courseId={courseId}
        onClose={() => setCreating(false)}
        onCreated={(quiz) => {
          setCreating(false)
          load()
          setOpenQuiz(quiz.id)
          onToast('Quiz créé', quiz.title)
        }}
        onError={(m) => onToast('Création impossible', m, true)}
      />

      <GenerateQuizDrawer
        open={generating}
        courseId={courseId}
        modules={scopeModules}
        onClose={() => setGenerating(false)}
        onCreated={(quiz) => {
          setGenerating(false)
          load()
          setOpenQuiz(quiz.id)
          onToast('Brouillon généré', 'Vérifiez-le avant toute publication.')
        }}
      />

      {openQuiz && (
        <QuizEditorDrawer
          quizId={openQuiz}
          onClose={() => {
            setOpenQuiz(null)
            load()
          }}
          onToast={onToast}
        />
      )}
    </Card>
  )
}

function GenerateQuizDrawer({
  open,
  courseId,
  modules,
  onClose,
  onCreated,
}: {
  open: boolean
  courseId: string
  modules: QuizScopeModule[]
  onClose: () => void
  onCreated: (quiz: Quiz) => void
}) {
  const [scope, setScope] = useState('course')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    const [kind, id] = scope.split(':')
    const payload =
      kind === 'module'
        ? { moduleId: id }
        : kind === 'lesson'
        ? { lessonId: id }
        : {}

    try {
      const response = await fetch(`/api/teacher/courses/${courseId}/ai/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Génération impossible')
      onCreated(data)
    } catch (err: any) {
      setError(err.message || 'Génération impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={loading ? () => undefined : onClose}
      title="Générer un quiz brouillon"
      description="À partir du contenu pédagogique existant"
      icon={<ClipboardIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className={buttonClasses('secondary', 'md')}
          >
            Annuler
          </button>
          <Button onClick={submit} loading={loading} disabled={loading}>
            Générer le brouillon
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/70">
            Périmètre
          </span>
          <select
            value={scope}
            onChange={(event) => setScope(event.target.value)}
            disabled={loading}
            className="focus:ring-apple/15 h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
          >
            <option value="course">Tout le cours</option>
            {modules.map((module) => (
              <option key={module.id} value={`module:${module.id}`}>
                Module — {module.title}
              </option>
            ))}
            {modules.flatMap((module) =>
              module.lessons.map((lesson) => (
                <option key={lesson.id} value={`lesson:${lesson.id}`}>
                  Leçon — {module.title} / {lesson.title}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Recommandation de l’assistant : ce quiz restera en brouillon. Relisez
          les questions et leurs réponses avant de le publier manuellement. Ce
          n’est pas une décision académique officielle.
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}
      </div>
    </Drawer>
  )
}

function CreateQuizDrawer({
  open,
  courseId,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean
  courseId: string
  onClose: () => void
  onCreated: (quiz: Quiz) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    passingScore: '',
  })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/teacher/courses/${courseId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Création impossible')
      setForm({ title: '', description: '', passingScore: '' })
      onCreated(data)
    } catch (err: any) {
      onError(err.message || 'Création impossible')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Nouveau quiz"
      description="Vous ajouterez les questions à l’étape suivante"
      icon={<ClipboardIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className={buttonClasses('secondary', 'md')}
          >
            Annuler
          </button>
          <Button onClick={submit} loading={loading}>
            Créer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Titre"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="Quiz — Les principes comptables"
        />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink/70">
            Consigne (optionnel)
          </span>
          <textarea
            value={form.description}
            onChange={(e) =>
              setForm((p) => ({ ...p, description: e.target.value }))
            }
            rows={3}
            className="focus:ring-apple/15 w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] text-ink transition-all duration-200 hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4"
          />
        </label>
        <Input
          label="Seuil de réussite en % (optionnel)"
          type="number"
          value={form.passingScore}
          onChange={(e) =>
            setForm((p) => ({ ...p, passingScore: e.target.value }))
          }
          hint="Indicatif : n’empêche jamais un étudiant de continuer."
        />
      </div>
    </Drawer>
  )
}

function QuizEditorDrawer({
  quizId,
  onClose,
  onToast,
}: {
  quizId: string
  onClose: () => void
  onToast: (title: string, description?: string, error?: boolean) => void
}) {
  const [quiz, setQuiz] = useState<(Quiz & { questions: Question[] }) | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    prompt: '',
    type: 'MULTIPLE_CHOICE' as QuestionType,
    options: ['', ''],
    correctIndex: 0,
    correctBool: 'true',
    explanation: '',
    points: '1',
  })

  const load = useCallback(() => {
    fetch(`/api/teacher/quizzes/${quizId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuiz(d))
      .catch(() => setQuiz(null))
  }, [quizId])

  useEffect(() => {
    load()
  }, [load])

  const addQuestion = async () => {
    setSaving(true)
    setError('')

    const payload: Record<string, unknown> = {
      prompt: form.prompt,
      type: form.type,
      explanation: form.explanation,
      points: form.points,
    }

    if (form.type === 'MULTIPLE_CHOICE') {
      payload.options = form.options
      payload.correctAnswer = [form.correctIndex]
    } else if (form.type === 'TRUE_FALSE') {
      payload.correctAnswer = form.correctBool === 'true'
    }

    try {
      const res = await fetch(`/api/teacher/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Ajout impossible')

      setForm({
        prompt: '',
        type: form.type,
        options: ['', ''],
        correctIndex: 0,
        correctBool: 'true',
        explanation: '',
        points: '1',
      })
      load()
      onToast('Question ajoutée')
    } catch (err: any) {
      setError(err.message || 'Ajout impossible')
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (status: QuizStatus) => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/teacher/quizzes/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Action impossible')
      load()
      onToast(status === 'PUBLISHED' ? 'Quiz publié' : 'Quiz mis à jour')
    } catch (err: any) {
      setError(err.message || 'Action impossible')
      onToast('Action impossible', err.message, true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title={quiz?.title ?? 'Quiz'}
      description={quiz ? `${quiz.questions.length} question(s)` : undefined}
      icon={<ClipboardIcon size={20} />}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {quiz && (
              <Badge tone={STATUS_TONES[quiz.status]}>
                {STATUS_LABELS[quiz.status]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className={buttonClasses('secondary', 'md')}
            >
              Fermer
            </button>
            {quiz?.status === 'PUBLISHED' ? (
              <Button
                onClick={() => setStatus('DRAFT')}
                loading={saving}
                variant="secondary"
              >
                Dépublier
              </Button>
            ) : (
              <Button onClick={() => setStatus('PUBLISHED')} loading={saving}>
                Publier
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {quiz && quiz.questions.length > 0 && (
          <ul className="space-y-2">
            {quiz.questions.map((q, i) => (
              <li
                key={q.id}
                className="rounded-xl border border-hairline bg-white p-3.5"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-cloud text-sm font-medium text-ink/50">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink">
                      {q.prompt}
                    </p>
                    <p className="text-ink/45 mt-0.5 text-sm">
                      {TYPE_LABELS[q.type]} · {q.points} pt
                      {q.points > 1 ? 's' : ''}
                    </p>
                    {q.options && (
                      <ul className="mt-2 space-y-1">
                        {q.options.map((o, j) => {
                          const correct = Array.isArray(q.correctAnswer)
                            ? (q.correctAnswer as number[]).includes(j)
                            : false
                          return (
                            <li
                              key={j}
                              className={
                                'flex items-center gap-2 text-sm ' +
                                (correct
                                  ? 'font-medium text-emerald-600'
                                  : 'text-ink/55')
                              }
                            >
                              {correct ? (
                                <CheckIcon size={14} />
                              ) : (
                                <span className="w-3.5" />
                              )}
                              {o}
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {q.type === 'TRUE_FALSE' && (
                      <p className="mt-2 text-sm font-medium text-emerald-600">
                        Réponse : {q.correctAnswer === true ? 'Vrai' : 'Faux'}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-4 rounded-xl border border-hairline bg-cloud/60 p-4">
          <p className="text-sm font-medium text-ink/70">
            Ajouter une question
          </p>

          <Input
            label="Énoncé"
            value={form.prompt}
            onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
          />

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Type
            </span>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((p) => ({ ...p, type: e.target.value as QuestionType }))
              }
              className="focus:ring-apple/15 h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
            >
              <option value="MULTIPLE_CHOICE">Choix multiple</option>
              <option value="TRUE_FALSE">Vrai / Faux</option>
              <option value="SHORT_TEXT">
                Texte libre (correction manuelle)
              </option>
            </select>
          </label>

          {form.type === 'MULTIPLE_CHOICE' && (
            <div className="space-y-2">
              <span className="block text-sm font-medium text-ink/70">
                Propositions — cochez la bonne réponse
              </span>
              {form.options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={form.correctIndex === i}
                    onChange={() => setForm((p) => ({ ...p, correctIndex: i }))}
                    className="h-4 w-4"
                  />
                  <input
                    value={o}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        options: p.options.map((v, j) =>
                          j === i ? e.target.value : v
                        ),
                      }))
                    }
                    placeholder={`Proposition ${i + 1}`}
                    className="focus:ring-apple/15 h-11 flex-1 rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, options: [...p.options, ''] }))
                }
                className="text-sm font-medium text-apple hover:underline"
              >
                + Ajouter une proposition
              </button>
            </div>
          )}

          {form.type === 'TRUE_FALSE' && (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Bonne réponse
              </span>
              <select
                value={form.correctBool}
                onChange={(e) =>
                  setForm((p) => ({ ...p, correctBool: e.target.value }))
                }
                className="focus:ring-apple/15 h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4"
              >
                <option value="true">Vrai</option>
                <option value="false">Faux</option>
              </select>
            </label>
          )}

          {form.type === 'SHORT_TEXT' && (
            <p className="text-ink/45 text-sm">
              Les réponses libres sont enregistrées mais ne comptent pas dans le
              score automatique.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Points"
              type="number"
              value={form.points}
              onChange={(e) =>
                setForm((p) => ({ ...p, points: e.target.value }))
              }
            />
            <Input
              label="Explication (optionnel)"
              value={form.explanation}
              onChange={(e) =>
                setForm((p) => ({ ...p, explanation: e.target.value }))
              }
            />
          </div>

          <Button onClick={addQuestion} loading={saving} size="md">
            Ajouter la question
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}
      </div>
    </Drawer>
  )
}
