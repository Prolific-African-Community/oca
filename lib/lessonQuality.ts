import {
  StructuredLessonContent,
  asStructuredLessonContent,
} from './lessonContent'

/**
 * Indicateurs de qualité d'une leçon.
 *
 * Ce sont des **heuristiques de relecture**, pas un jugement académique :
 * elles signalent ce qui manque manifestement (pas d'exercice, contenu très
 * court au regard de la durée annoncée) pour orienter l'attention de
 * l'enseignant. La décision reste entièrement la sienne.
 */

/** Ordre de grandeur : ~900 caractères de contenu utile par tranche de 10 minutes. */
const CHARACTERS_PER_TEN_MINUTES = 900

/** En deçà, la leçon est trop maigre quelle que soit la durée déclarée. */
const MINIMUM_CHARACTERS = 800

export type Readiness = 'TOO_LIGHT' | 'ACCEPTABLE' | 'STRONG'

export interface LessonQuality {
  /** Longueur du contenu réellement rédigé. */
  contentLength: number
  structured: boolean
  /** Sections attendues manquantes, pour les leçons structurées. */
  missingSections: string[]
  warnings: string[]
  readiness: Readiness
  /** Longueur visée pour la durée déclarée, à titre indicatif. */
  targetLength: number | null
}

const SECTION_LABELS: Record<string, string> = {
  introduction: 'Introduction',
  keyConcepts: 'Concepts clés',
  explanation: 'Explication',
  practicalExample: 'Exemple pratique',
  recap: 'Récapitulatif',
  exercises: 'Exercices',
}

function structuredLength(content: StructuredLessonContent): number {
  return [
    content.introduction,
    content.explanation,
    content.practicalExample,
    content.recap,
    ...content.keyConcepts,
    ...content.exercises,
  ]
    .join(' ')
    .trim().length
}

function missingSectionsOf(content: StructuredLessonContent): string[] {
  const missing: string[] = []

  if (!content.introduction.trim()) missing.push('introduction')
  if (content.keyConcepts.length === 0) missing.push('keyConcepts')
  if (!content.explanation.trim()) missing.push('explanation')
  if (!content.practicalExample.trim()) missing.push('practicalExample')
  if (!content.recap.trim()) missing.push('recap')
  if (content.exercises.length === 0) missing.push('exercises')

  return missing
}

/** Évalue une leçon à partir de son contenu structuré ou, à défaut, de son texte. */
export function assessLesson(lesson: {
  content: string | null
  contentJson: unknown
  estimatedMinutes: number | null
}): LessonQuality {
  const structured = asStructuredLessonContent(lesson.contentJson)

  const contentLength = structured
    ? structuredLength(structured)
    : (lesson.content ?? '').trim().length

  const missingSections = structured ? missingSectionsOf(structured) : []

  const targetLength = lesson.estimatedMinutes
    ? Math.round((lesson.estimatedMinutes / 10) * CHARACTERS_PER_TEN_MINUTES)
    : null

  const warnings: string[] = []

  if (contentLength === 0) {
    warnings.push('Aucun contenu rédigé')
  } else if (contentLength < MINIMUM_CHARACTERS) {
    warnings.push('Contenu très court')
  }

  if (targetLength && contentLength > 0 && contentLength < targetLength * 0.6) {
    warnings.push(
      `Contenu court pour ${lesson.estimatedMinutes} min (~${targetLength} caractères attendus)`
    )
  }

  if (!lesson.estimatedMinutes) warnings.push('Durée non précisée')

  for (const section of missingSections) {
    if (section === 'exercises') warnings.push('Aucun exercice')
    if (section === 'practicalExample') warnings.push('Aucun exemple pratique')
    if (section === 'recap') warnings.push('Aucun récapitulatif')
  }

  // Trois paliers volontairement grossiers : l'indicateur oriente, il ne classe pas.
  const enoughLength = targetLength
    ? contentLength >= targetLength * 0.8
    : contentLength >= MINIMUM_CHARACTERS * 2

  const hasEssentials =
    structured !== null &&
    !missingSections.includes('explanation') &&
    !missingSections.includes('practicalExample') &&
    !missingSections.includes('exercises')

  let readiness: Readiness = 'TOO_LIGHT'

  if (contentLength >= MINIMUM_CHARACTERS && (hasEssentials || enoughLength)) {
    readiness = enoughLength && hasEssentials ? 'STRONG' : 'ACCEPTABLE'
  }

  return {
    contentLength,
    structured: structured !== null,
    missingSections,
    warnings,
    readiness,
    targetLength,
  }
}

export function sectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section
}
