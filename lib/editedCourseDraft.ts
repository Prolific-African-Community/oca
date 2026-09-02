import type { CourseDraftRequest, GeneratedCourseDraft } from './aiCourseDraft'
import { cleanPedagogicalList, cleanPedagogicalText } from './textCleanup'

/**
 * Validation d'un brouillon **retouché par l'enseignant** avant application.
 *
 * Pourquoi ne pas réutiliser `normalizeAndValidateCourseDraft` ?
 * Parce qu'elle juge la production du modèle : elle exige des longueurs
 * minimales liées à la durée, quatre paragraphes, et la présence littérale des
 * mots « introduction », « objectif », « concept », « explication » et
 * « malentendu ». Ces règles ont un sens pour contrôler un fournisseur ; les
 * appliquer au texte d'un professeur reviendrait à refuser sa propre rédaction
 * parce qu'elle n'emploie pas un mot attendu.
 *
 * Ce validateur vérifie donc l'**intégrité**, pas la qualité :
 *  - la forme et les bornes de taille, pour ne rien laisser passer d'aberrant ;
 *  - le nombre de modules et de leçons, identique à ce qui a été généré, afin
 *    qu'une retouche ne serve pas à faire créer davantage de contenu ;
 *  - les champs indispensables à une leçon exploitable.
 *
 * Le reste — récapitulatif vide, absence d'exercice — relève de l'avertissement.
 * L'enseignant reste responsable de son contenu.
 *
 * Les quiz ne passent pas par ici : l'appelant les reprend du brouillon
 * d'origine, ce qui évite d'avoir à faire confiance au client sur ce point.
 */

const MAX = {
  courseSummary: 4000,
  title: 200,
  description: 4000,
  objective: 400,
  content: 20000,
  practicalExample: 4000,
  recap: 4000,
  exercise: 4000,
  keyConcept: 400,
}

export interface EditedDraftResult {
  /** Brouillon nettoyé, sans les quiz — l'appelant les réinjecte. */
  draft: Omit<GeneratedCourseDraft, 'modules'> & {
    modules: Array<
      Omit<GeneratedCourseDraft['modules'][number], 'quizzes'>
    >
  }
  /** Bloquants : l'application est refusée. */
  issues: string[]
  /** Signalés à l'enseignant, sans empêcher l'application. */
  warnings: string[]
}

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? cleanPedagogicalText(value).slice(0, max) : ''

const list = (value: unknown, maxItems: number, maxLength: number) =>
  cleanPedagogicalList(
    (Array.isArray(value) ? value : []).map((item) =>
      typeof item === 'string' ? item : ''
    )
  )
    .slice(0, maxItems)
    .map((item) => item.slice(0, maxLength))

export function normalizeEditedCourseDraft(
  value: unknown,
  limits: Pick<CourseDraftRequest, 'moduleCount' | 'lessonsPerModule'>
): EditedDraftResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null

  const raw = value as Record<string, unknown>
  const issues: string[] = []
  const warnings: string[] = []

  const courseSummary = text(raw.courseSummary, MAX.courseSummary)
  if (!courseSummary) issues.push('Le résumé du cours est vide.')

  const rawModules = Array.isArray(raw.modules) ? raw.modules : []
  if (rawModules.length !== limits.moduleCount) {
    issues.push(
      `Nombre de modules modifié : ${limits.moduleCount} attendu(s), ${rawModules.length} reçu(s).`
    )
  }

  const modules = rawModules.slice(0, 8).map((rawModule, moduleIndex) => {
    const module =
      rawModule && typeof rawModule === 'object' && !Array.isArray(rawModule)
        ? (rawModule as Record<string, unknown>)
        : {}

    const position = `Module ${moduleIndex + 1}`
    const title = text(module.title, MAX.title)
    const description = text(module.description, MAX.description)
    const learningObjectives = list(module.learningObjectives, 8, MAX.objective)

    if (!title) issues.push(`${position} : le titre est vide.`)
    if (!description) warnings.push(`${position} : la description est vide.`)
    if (learningObjectives.length === 0) {
      warnings.push(`${position} : aucun objectif d’apprentissage.`)
    }

    const rawLessons = Array.isArray(module.lessons) ? module.lessons : []
    if (rawLessons.length !== limits.lessonsPerModule) {
      issues.push(
        `${position} : ${limits.lessonsPerModule} leçon(s) attendue(s), ${rawLessons.length} reçue(s).`
      )
    }

    const lessons = rawLessons.slice(0, 6).map((rawLesson, lessonIndex) => {
      const lesson =
        rawLesson && typeof rawLesson === 'object' && !Array.isArray(rawLesson)
          ? (rawLesson as Record<string, unknown>)
          : {}

      const place = `${position}, leçon ${lessonIndex + 1}`
      const lessonTitle = text(lesson.title, MAX.title)
      const content = text(lesson.content, MAX.content)
      const practicalExample = text(lesson.practicalExample, MAX.practicalExample)
      const recap = text(lesson.recap, MAX.recap)
      const keyConcepts = list(lesson.keyConcepts, 6, MAX.keyConcept)
      const exercises = list(lesson.exercises, 4, MAX.exercise)

      const minutes =
        typeof lesson.estimatedMinutes === 'number'
          ? lesson.estimatedMinutes
          : Number(lesson.estimatedMinutes)

      const estimatedMinutes =
        Number.isInteger(minutes) && minutes >= 5 && minutes <= 240
          ? minutes
          : 0

      if (!lessonTitle) issues.push(`${place} : le titre est vide.`)
      if (!content) issues.push(`${place} : le contenu principal est vide.`)
      if (estimatedMinutes === 0) {
        issues.push(`${place} : durée attendue entre 5 et 240 minutes.`)
      }

      if (!practicalExample) warnings.push(`${place} : aucun exemple pratique.`)
      if (!recap) warnings.push(`${place} : aucun récapitulatif.`)
      if (keyConcepts.length === 0) warnings.push(`${place} : aucun concept clé.`)
      if (exercises.length === 0) warnings.push(`${place} : aucun exercice.`)

      return {
        title: lessonTitle,
        estimatedMinutes,
        content,
        keyConcepts,
        practicalExample,
        recap,
        exercises,
      }
    })

    return { title, description, order: moduleIndex, learningObjectives, lessons }
  })

  return { draft: { courseSummary, modules }, issues, warnings }
}
