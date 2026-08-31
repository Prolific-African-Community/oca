import { useCallback, useMemo, useRef, useState } from 'react'

/**
 * Génération d'un brouillon de cours : état et appels réseau.
 *
 * Extrait de l'ancien tiroir pour que le Course Studio n'en réécrive pas une
 * seconde version. Les deux routes existantes sont inchangées ; ce module ne
 * fait qu'orchestrer l'aperçu, puis l'application décidée par l'enseignant.
 *
 * Rien n'est publié : le brouillon appliqué arrive en DRAFT.
 */

export interface DraftLessonPreview {
  title: string
  estimatedMinutes: number
  keyConcepts?: string[]
  exercises?: string[]
  content: string
}

export interface DraftModulePreview {
  title: string
  description: string
  learningObjectives: string[]
  lessons: DraftLessonPreview[]
  quizzes: Array<{ title: string; questions: unknown[] }>
}

export interface DraftPreview {
  courseSummary: string
  modules: DraftModulePreview[]
}

export interface DraftWarning {
  code: string
  message: string
  path?: string
}

export interface GeneratedDraft {
  id: string
  preview: DraftPreview
  disclaimer: string
  warnings: DraftWarning[]
}

/** États visibles de bout en bout, y compris les échecs. */
export type BuildStatus =
  | 'CONFIGURING'
  | 'GENERATING'
  | 'PREVIEW'
  | 'APPLYING'
  | 'APPLIED'
  | 'FAILED'

export interface DraftForm {
  objective: string
  targetLevel: string
  moduleCount: string
  lessonsPerModule: string
  includeQuizzes: boolean
  mode: string
}

const INITIAL_FORM: DraftForm = {
  objective: '',
  targetLevel: '',
  moduleCount: '2',
  lessonsPerModule: '2',
  includeQuizzes: false,
  mode: 'APPEND_ONLY',
}

export function useCourseDraft(courseId: string) {
  const [form, setForm] = useState<DraftForm>(INITIAL_FORM)
  const [status, setStatus] = useState<BuildStatus>('CONFIGURING')
  const [generated, setGenerated] = useState<GeneratedDraft | null>(null)
  const [error, setError] = useState('')
  const [failureReason, setFailureReason] = useState('')

  /** Empêche une double soumission, quelle que soit la vitesse du clic. */
  const inFlight = useRef(false)

  const counts = useMemo(() => {
    const modules = generated?.preview.modules ?? []
    const lessons = modules.flatMap((m) => m.lessons)
    const quizzes = modules.flatMap((m) => m.quizzes)

    return {
      modules: modules.length,
      lessons: lessons.length,
      quizzes: quizzes.length,
      questions: quizzes.reduce((n, q) => n + q.questions.length, 0),
      keyConcepts: lessons.reduce((n, l) => n + (l.keyConcepts?.length ?? 0), 0),
      exercises: lessons.reduce((n, l) => n + (l.exercises?.length ?? 0), 0),
      averageContentLength:
        lessons.length === 0
          ? 0
          : Math.round(
              lessons.reduce((n, l) => n + l.content.length, 0) / lessons.length
            ),
    }
  }, [generated])

  const generate = useCallback(async () => {
    if (inFlight.current) return
    inFlight.current = true
    setStatus('GENERATING')
    setError('')
    setFailureReason('')
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
        setFailureReason(data.failureReason || data.code || '')
        throw new Error(data.message || 'Génération impossible')
      }

      setGenerated(data)
      setStatus('PREVIEW')
    } catch (caught: any) {
      setError(caught.message || 'Génération impossible')
      setStatus('FAILED')
    } finally {
      inFlight.current = false
    }
  }, [courseId, form])

  /**
   * Applique le brouillon relu. Renvoie les compteurs créés pour que l'appelant
   * puisse rafraîchir sa vue et sélectionner la première leçon produite.
   */
  const apply = useCallback(async (): Promise<{
    modules: number
    lessons: number
    quizzes: number
  } | null> => {
    if (!generated || inFlight.current) return null
    inFlight.current = true
    setStatus('APPLYING')
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
      if (!response.ok) throw new Error(data.message || 'Application impossible')

      setStatus('APPLIED')
      return data.created ?? null
    } catch (caught: any) {
      setError(caught.message || 'Application impossible')
      setStatus('FAILED')
      return null
    } finally {
      inFlight.current = false
    }
  }, [courseId, generated])

  const reset = useCallback(() => {
    setGenerated(null)
    setError('')
    setFailureReason('')
    setStatus('CONFIGURING')
  }, [])

  return {
    form,
    setForm,
    status,
    generated,
    counts,
    error,
    failureReason,
    generate,
    apply,
    reset,
    busy: status === 'GENERATING' || status === 'APPLYING',
  }
}
