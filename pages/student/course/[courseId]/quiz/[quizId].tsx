import { requireEnrolledCoursePage } from '../../../../../lib/pageGuard'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../../../components/app/AppShell'
import { Card } from '../../../../../components/ui/Card'
import { Badge } from '../../../../../components/ui/Badge'
import { Button } from '../../../../../components/ui/Button'
import { EmptyState } from '../../../../../components/ui/EmptyState'
import { Skeleton } from '../../../../../components/ui/Skeleton'
import { Reveal } from '../../../../../components/anim/Reveal'
import { ClipboardIcon, CheckIcon } from '../../../../../components/ui/icons'

type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_TEXT'

interface Question {
  id: string
  prompt: string
  type: QuestionType
  options: string[] | null
  points: number
}

interface AnswerFeedback {
  questionId: string
  response: unknown
  isCorrect: boolean | null
  pointsAwarded: number
  correctAnswer: unknown
  explanation: string | null
}

interface Result {
  score: number
  maxScore: number
  percentage: number | null
  manualQuestions?: number
  answers: AnswerFeedback[]
}

interface QuizView {
  id: string
  title: string
  description: string | null
  passingScore: number | null
  course: { id: string; title: string; code: string }
  module: { id: string; title: string } | null
  questions: Question[]
  lastAttempt: (Result & { id: string; submittedAt: string }) | null
}

export default function StudentQuizPage() {
  const router = useRouter()
  const { courseId, quizId } = router.query

  const [quiz, setQuiz] = useState<QuizView | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof quizId !== 'string') return

    fetch(`/api/student/quizzes/${quizId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) {
          setNotFound(true)
          return
        }
        setQuiz(d)
        if (d.lastAttempt) setResult(d.lastAttempt)
      })
      .catch(() => setNotFound(true))
  }, [quizId])

  const start = async () => {
    if (typeof quizId !== 'string') return
    setResult(null)
    setAnswers({})
    await fetch(`/api/student/quizzes/${quizId}/start`, {
      method: 'POST',
    }).catch(() => {})
  }

  const submit = async () => {
    if (typeof quizId !== 'string' || !quiz) return
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`/api/student/quizzes/${quizId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: quiz.questions.map((q) => ({
            questionId: q.id,
            response: answers[q.id] ?? null,
          })),
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Envoi impossible')
      setResult(data)
    } catch (err: any) {
      setError(err.message || 'Envoi impossible')
    } finally {
      setSubmitting(false)
    }
  }

  const backHref =
    typeof courseId === 'string'
      ? `/student/course/${courseId}`
      : '/student/courses'
  const feedback = result
    ? new Map(result.answers.map((a) => [a.questionId, a]))
    : new Map<string, AnswerFeedback>()

  return (
    <AppShell
      role="student"
      requiredRole="student"
      maxWidth="narrow"
      title={quiz?.title ?? 'Quiz'}
      subtitle={
        quiz
          ? `${quiz.course.code}${quiz.module ? ` · ${quiz.module.title}` : ''}`
          : undefined
      }
    >
      <Link
        href={backHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← {quiz?.course.title ?? 'Retour au cours'}
      </Link>

      {notFound ? (
        <Card>
          <EmptyState
            icon={<ClipboardIcon size={22} />}
            title="Quiz indisponible"
            description="Ce quiz n’est pas publié ou ne fait pas partie de vos cours."
          />
        </Card>
      ) : !quiz ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Reveal>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral">{quiz.questions.length} questions</Badge>
                {quiz.passingScore !== null && (
                  <Badge tone="neutral">
                    Seuil indicatif {quiz.passingScore} %
                  </Badge>
                )}
                <Badge tone="warning">
                  Entraînement · pas une note officielle
                </Badge>
              </div>
              {quiz.description && (
                <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
                  {quiz.description}
                </p>
              )}
            </Card>
          </Reveal>

          {result && (
            <Reveal delay={60}>
              <Card className="mt-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="text-ink/45 text-sm">Votre résultat</p>
                    <p className="text-2xl font-medium tracking-tightest text-ink">
                      {result.score}
                      <span className="text-ink/30">
                        {' '}
                        / {result.maxScore} points
                      </span>
                      {result.percentage !== null && (
                        <span className="text-ink/45 ml-2">
                          ({result.percentage} %)
                        </span>
                      )}
                    </p>
                  </div>
                  <Button onClick={start} variant="secondary" size="md">
                    Refaire le quiz
                  </Button>
                </div>
                <p className="text-ink/45 mt-3 text-sm">
                  Ce résultat est un retour d’apprentissage. Il n’entre pas dans
                  votre relevé académique et ne vaut aucune validation.
                  {result.manualQuestions
                    ? ` ${result.manualQuestions} question(s) à texte libre seront relues par votre enseignant.`
                    : ''}
                </p>
              </Card>
            </Reveal>
          )}

          <div className="mt-5 space-y-4">
            {quiz.questions.map((q, i) => {
              const fb = feedback.get(q.id)
              const given = answers[q.id]

              return (
                <Reveal key={q.id} delay={i * 40}>
                  <Card>
                    <div className="flex items-start gap-3">
                      <span
                        className={
                          'grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-medium ' +
                          (fb?.isCorrect === true
                            ? 'bg-emerald-50 text-emerald-600'
                            : fb?.isCorrect === false
                            ? 'bg-red-50 text-red-500'
                            : 'bg-cloud text-ink/50')
                        }
                      >
                        {fb?.isCorrect === true ? (
                          <CheckIcon size={16} />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-medium text-ink">
                          {q.prompt}
                        </p>
                        <p className="mt-0.5 text-sm text-ink/40">
                          {q.points} pt{q.points > 1 ? 's' : ''}
                          {q.type === 'SHORT_TEXT'
                            ? ' · correction manuelle'
                            : ''}
                        </p>

                        {q.type === 'MULTIPLE_CHOICE' && q.options && (
                          <ul className="mt-3 space-y-2">
                            {q.options.map((o, j) => {
                              const isCorrectOption =
                                fb && Array.isArray(fb.correctAnswer)
                                  ? (fb.correctAnswer as number[]).includes(j)
                                  : false

                              return (
                                <li key={j}>
                                  <label
                                    className={
                                      'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ' +
                                      (isCorrectOption
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                        : 'border-hairline bg-white text-ink/70 hover:bg-cloud')
                                    }
                                  >
                                    <input
                                      type="radio"
                                      name={q.id}
                                      disabled={Boolean(result)}
                                      checked={given === j}
                                      onChange={() =>
                                        setAnswers((p) => ({ ...p, [q.id]: j }))
                                      }
                                      className="h-4 w-4"
                                    />
                                    {o}
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        )}

                        {q.type === 'TRUE_FALSE' && (
                          <div className="mt-3 flex gap-2">
                            {[true, false].map((v) => (
                              <label
                                key={String(v)}
                                className={
                                  'flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ' +
                                  (fb && fb.correctAnswer === v
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-hairline bg-white text-ink/70 hover:bg-cloud')
                                }
                              >
                                <input
                                  type="radio"
                                  name={q.id}
                                  disabled={Boolean(result)}
                                  checked={given === v}
                                  onChange={() =>
                                    setAnswers((p) => ({ ...p, [q.id]: v }))
                                  }
                                  className="h-4 w-4"
                                />
                                {v ? 'Vrai' : 'Faux'}
                              </label>
                            ))}
                          </div>
                        )}

                        {q.type === 'SHORT_TEXT' && (
                          <textarea
                            rows={3}
                            disabled={Boolean(result)}
                            value={typeof given === 'string' ? given : ''}
                            onChange={(e) =>
                              setAnswers((p) => ({
                                ...p,
                                [q.id]: e.target.value,
                              }))
                            }
                            className="focus:ring-apple/15 mt-3 w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 disabled:bg-cloud"
                          />
                        )}

                        {fb?.explanation && (
                          <p className="mt-3 rounded-xl bg-cloud px-3.5 py-2.5 text-sm text-ink/60">
                            {fb.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  </Card>
                </Reveal>
              )
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}

          {!result && quiz.questions.length > 0 && (
            <div className="mt-5 flex justify-end">
              <Button onClick={submit} loading={submitting}>
                Envoyer mes réponses
              </Button>
            </div>
          )}
        </>
      )}
    </AppShell>
  )
}

// Protection côté serveur : étudiant inscrit au cours ; le quiz lui-même est
// revérifié par l'API (publié, cours accessible).
export const getServerSideProps = requireEnrolledCoursePage()
