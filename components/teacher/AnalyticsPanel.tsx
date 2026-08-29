import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { EmptyState } from '../ui/EmptyState'
import { ProgressBar } from '../ui/ProgressBar'
import { Skeleton } from '../ui/Skeleton'
import { ClipboardIcon } from '../ui/icons'

type ActivityStatus = 'NO_ACTIVITY' | 'IN_PROGRESS' | 'COMPLETED'

interface Analytics {
  enrolledStudentCount: number
  publishedModuleCount: number
  publishedLessonCount: number
  lessonCompletionCount: number
  courseCompletionPercentage: number
  quizCount: number
  submittedAttemptCount: number
  averageQuizScore: number | null
  studentsWithNoActivity: number
  studentsInProgress: number
  studentsCompletedAllLessons: number
  moduleProgress: Array<{
    id: string
    title: string
    publishedLessonCount: number
    completionCount: number
    completionPercentage: number
  }>
  quizPerformance: Array<{
    id: string
    title: string
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
    submittedAttemptCount: number
    averageScore: number | null
  }>
  students: Array<{
    id: string
    name: string
    email: string
    completedLessons: number
    publishedLessonCount: number
    completionPercentage: number
    submittedAttemptCount: number
    averageQuizScore: number | null
    activityStatus: ActivityStatus
  }>
}

interface TeachingInsights {
  id: string
  source: 'cached' | 'generated'
  label: string
  disclaimer: string
  generatedAt: string
  insights: {
    summary: string
    priorities: Array<{
      title: string
      evidence: string
      recommendation: string
    }>
    remedialActions: string[]
    liveSessionTopics: string[]
    quizAndContentImprovements: string[]
  }
}

const STATUS_LABELS: Record<ActivityStatus, string> = {
  NO_ACTIVITY: 'Sans activité',
  IN_PROGRESS: 'En cours',
  COMPLETED: 'Leçons terminées',
}

export function AnalyticsPanel({ courseId }: { courseId: string }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [failed, setFailed] = useState(false)
  const [generatingInsights, setGeneratingInsights] = useState(false)
  const [insightsError, setInsightsError] = useState('')
  const [teachingInsights, setTeachingInsights] =
    useState<TeachingInsights | null>(null)

  const load = useCallback(() => {
    if (!courseId) return
    setFailed(false)
    fetch(`/api/teacher/courses/${courseId}/analytics`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setAnalytics)
      .catch(() => setFailed(true))
  }, [courseId])

  const loadSavedInsights = useCallback(() => {
    if (!courseId) return
    setTeachingInsights(null)
    fetch(`/api/teacher/courses/${courseId}/ai/insights`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data) => {
        const latest = Array.isArray(data.insights)
          ? data.insights.find(
              (item: any) => item.status === 'SUCCESS' && item.output
            )
          : null
        if (!latest) return
        setTeachingInsights({
          id: latest.id,
          source: 'cached',
          label: 'Recommandation de l’assistant',
          disclaimer:
            'Aucune décision académique officielle. Validation de l’enseignant requise.',
          generatedAt: latest.generatedAt,
          insights: latest.output,
        })
      })
      .catch(() => {})
  }, [courseId])

  useEffect(() => {
    load()
    loadSavedInsights()
  }, [load, loadSavedInsights])

  const generateInsights = async () => {
    if (generatingInsights) return
    setGeneratingInsights(true)
    setInsightsError('')
    try {
      const response = await fetch(
        `/api/teacher/courses/${courseId}/ai/insights`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: Boolean(teachingInsights) }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Génération impossible')
      setTeachingInsights(data)
    } catch (error: any) {
      setInsightsError(error.message || 'Génération impossible')
    } finally {
      setGeneratingInsights(false)
    }
  }

  if (failed) {
    return (
      <Card>
        <EmptyState
          icon={<ClipboardIcon size={22} />}
          title="Analytics indisponibles"
          description="Les données d’engagement n’ont pas pu être chargées."
        />
      </Card>
    )
  }

  if (!analytics) return <Skeleton className="h-64 w-full" />

  return (
    <section aria-labelledby="analytics-title" className="space-y-5">
      <Card>
        <CardHeader
          title="Assistant pédagogique"
          action={<Badge tone="warning">Recommandation consultative</Badge>}
        />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl text-sm leading-relaxed text-ink/50">
            L’assistant interprète les analytics agrégées du cours. Il ne
            publie, ne modifie et n’applique rien automatiquement.
          </p>
          <Button
            onClick={generateInsights}
            loading={generatingInsights}
            disabled={generatingInsights}
            size="md"
          >
            {teachingInsights
              ? 'Regenerate insights'
              : 'Generate teaching insights'}
          </Button>
        </div>
        {insightsError && (
          <div
            role="alert"
            className="mt-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700"
          >
            {insightsError}
          </div>
        )}
        {teachingInsights && (
          <div className="mt-5 space-y-5 border-t border-hairline pt-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{teachingInsights.label}</Badge>
                <Badge
                  tone={
                    teachingInsights.source === 'generated' ? 'blue' : 'neutral'
                  }
                >
                  {teachingInsights.source === 'generated'
                    ? 'Nouvel insight'
                    : 'Insight sauvegardé'}
                </Badge>
                <Badge tone="neutral">Validation de l’enseignant requise</Badge>
              </div>
              <p className="text-ink/65 mt-3 text-[15px] leading-relaxed">
                {teachingInsights.insights.summary}
              </p>
              <p className="mt-2 text-xs text-ink/40">
                {teachingInsights.disclaimer} · Généré le{' '}
                {new Date(teachingInsights.generatedAt).toLocaleString('fr-FR')}
              </p>
            </div>

            {teachingInsights.insights.priorities.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink/70">
                  Priorités observées
                </h3>
                <ul className="mt-3 space-y-3">
                  {teachingInsights.insights.priorities.map(
                    (priority, index) => (
                      <li
                        key={`${priority.title}-${index}`}
                        className="rounded-xl bg-cloud/70 p-4"
                      >
                        <p className="text-sm font-medium text-ink/75">
                          {priority.title}
                        </p>
                        <p className="text-ink/45 mt-1 text-xs">
                          Indicateur : {priority.evidence}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-ink/60">
                          {priority.recommendation}
                        </p>
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

            <div className="grid gap-5 lg:grid-cols-3">
              <InsightList
                title="Actions de remédiation"
                items={teachingInsights.insights.remedialActions}
              />
              <InsightList
                title="Sujets de session live"
                items={teachingInsights.insights.liveSessionTopics}
              />
              <InsightList
                title="Améliorations quiz et contenus"
                items={teachingInsights.insights.quizAndContentImprovements}
              />
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Analytics"
          action={<Badge tone="neutral">Données d’apprentissage</Badge>}
        />
        <h2 id="analytics-title" className="sr-only">
          Analytics du cours
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric
            label="Étudiants inscrits"
            value={analytics.enrolledStudentCount}
          />
          <Metric
            label="Leçons publiées"
            value={analytics.publishedLessonCount}
          />
          <Metric
            label="Progression du cours"
            value={`${analytics.courseCompletionPercentage} %`}
          />
          <Metric
            label="Score moyen aux quiz"
            value={
              analytics.averageQuizScore === null
                ? '—'
                : `${analytics.averageQuizScore} %`
            }
          />
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-sm text-ink/50">
            <span>{analytics.lessonCompletionCount} achèvements de leçon</span>
            <span>{analytics.courseCompletionPercentage} %</span>
          </div>
          <ProgressBar value={analytics.courseCompletionPercentage} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="neutral">
            {analytics.studentsWithNoActivity} sans activité
          </Badge>
          <Badge tone="blue">{analytics.studentsInProgress} en cours</Badge>
          <Badge tone="success">
            {analytics.studentsCompletedAllLessons} leçons terminées
          </Badge>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Progression par module"
            action={
              <Badge tone="neutral">
                {analytics.publishedModuleCount} publiés
              </Badge>
            }
          />
          {analytics.moduleProgress.length === 0 ? (
            <p className="text-ink/45 text-sm">Aucun module publié.</p>
          ) : (
            <ul className="space-y-4">
              {analytics.moduleProgress.map((module) => (
                <li key={module.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink/70">
                      {module.title}
                    </span>
                    <span className="text-ink/45 shrink-0 tabular-nums">
                      {module.completionPercentage} % ·{' '}
                      {module.publishedLessonCount} leçon
                      {module.publishedLessonCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <ProgressBar value={module.completionPercentage} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Performance aux quiz"
            action={<Badge tone="neutral">{analytics.quizCount} quiz</Badge>}
          />
          {analytics.quizPerformance.length === 0 ? (
            <p className="text-ink/45 text-sm">Aucun quiz pour ce cours.</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {analytics.quizPerformance.map((quiz) => (
                <li
                  key={quiz.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink/70">
                      {quiz.title}
                    </p>
                    <p className="text-xs text-ink/40">
                      {quiz.submittedAttemptCount} tentative
                      {quiz.submittedAttemptCount > 1 ? 's' : ''} soumise
                    </p>
                  </div>
                  <Badge tone={quiz.averageScore === null ? 'neutral' : 'blue'}>
                    {quiz.averageScore === null
                      ? 'Aucun score'
                      : `${quiz.averageScore} % moyen`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink/40">
            Retours d’apprentissage uniquement · aucune note officielle.
          </p>
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Progression des étudiants"
            action={
              <Badge tone="neutral">
                {analytics.submittedAttemptCount} tentatives soumises
              </Badge>
            }
          />
        </div>
        {analytics.students.length === 0 ? (
          <p className="text-ink/45 px-5 pb-6 text-sm sm:px-6">
            Aucun étudiant inscrit.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-ink/45 border-y border-hairline bg-cloud/70 text-xs font-medium">
                <tr>
                  <th className="px-5 py-3 sm:px-6">Étudiant</th>
                  <th className="px-4 py-3">Leçons</th>
                  <th className="px-4 py-3">Progression</th>
                  <th className="px-4 py-3">Quiz soumis</th>
                  <th className="px-4 py-3">Score moyen</th>
                  <th className="px-5 py-3 sm:px-6">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {analytics.students.map((student) => (
                  <tr key={student.id}>
                    <td className="px-5 py-3 sm:px-6">
                      <p className="font-medium text-ink/70">{student.name}</p>
                      <p className="text-xs text-ink/40">{student.email}</p>
                    </td>
                    <td className="text-ink/55 px-4 py-3 tabular-nums">
                      {student.completedLessons} /{' '}
                      {student.publishedLessonCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-[120px] items-center gap-2">
                        <ProgressBar value={student.completionPercentage} />
                        <span className="text-ink/45 shrink-0 text-xs tabular-nums">
                          {student.completionPercentage} %
                        </span>
                      </div>
                    </td>
                    <td className="text-ink/55 px-4 py-3 tabular-nums">
                      {student.submittedAttemptCount}
                    </td>
                    <td className="text-ink/55 px-4 py-3 tabular-nums">
                      {student.averageQuizScore === null
                        ? '—'
                        : `${student.averageQuizScore} %`}
                    </td>
                    <td className="px-5 py-3 sm:px-6">
                      <Badge
                        tone={
                          student.activityStatus === 'COMPLETED'
                            ? 'success'
                            : student.activityStatus === 'IN_PROGRESS'
                            ? 'blue'
                            : 'neutral'
                        }
                      >
                        {STATUS_LABELS[student.activityStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-2xl font-medium tracking-tightest text-ink">{value}</p>
      <p className="text-ink/45 mt-1 text-xs">{label}</p>
    </div>
  )
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-ink/70">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink/40">Aucune suggestion.</p>
      ) : (
        <ul className="text-ink/55 mt-2 space-y-2 text-sm leading-relaxed">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="text-apple">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
