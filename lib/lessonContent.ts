import type { Prisma } from '@prisma/client'
import type { GeneratedCourseDraft } from './aiCourseDraft'

export interface StructuredLessonContent {
  introduction: string
  keyConcepts: string[]
  explanation: string
  practicalExample: string
  recap: string
  exercises: string[]
}

const textWithin = (value: unknown, max: number) =>
  typeof value === 'string' && value.length <= max

/** Validation défensive des JSON stockés : un objet invalide retombe sur `content`. */
export function asStructuredLessonContent(
  value: unknown
): StructuredLessonContent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const content = value as Record<string, unknown>
  if (
    !textWithin(content.introduction, 6000) ||
    !Array.isArray(content.keyConcepts) ||
    content.keyConcepts.length > 20 ||
    !content.keyConcepts.every((item) => textWithin(item, 1000)) ||
    !textWithin(content.explanation, 20_000) ||
    !textWithin(content.practicalExample, 8000) ||
    !textWithin(content.recap, 6000) ||
    !Array.isArray(content.exercises) ||
    content.exercises.length > 20 ||
    !content.exercises.every((item) => textWithin(item, 4000))
  ) {
    return null
  }
  return content as unknown as StructuredLessonContent
}

export function structuredLessonContentFromDraft(
  lesson: GeneratedCourseDraft['modules'][number]['lessons'][number]
): StructuredLessonContent {
  const paragraphs = lesson.content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return {
    introduction: paragraphs[0] ?? '',
    // Les concepts clés viennent désormais d'un champ dédié du brouillon.
    keyConcepts: (lesson.keyConcepts ?? [])
      .map((concept) => concept.trim())
      .filter(Boolean),
    explanation:
      paragraphs.length > 1
        ? paragraphs.slice(1).join('\n\n')
        : lesson.content.trim(),
    practicalExample: lesson.practicalExample.trim(),
    recap: lesson.recap.trim(),
    exercises: (lesson.exercises ?? [])
      .map((exercise) => exercise.trim())
      .filter(Boolean),
  }
}

export function structuredLessonContentToPlainText(
  content: StructuredLessonContent
): string {
  return [
    content.introduction,
    content.keyConcepts.length
      ? `Concepts clés\n${content.keyConcepts
          .map((item) => `- ${item}`)
          .join('\n')}`
      : '',
    content.explanation,
    content.practicalExample
      ? `Exemple pratique\n${content.practicalExample}`
      : '',
    content.recap ? `Récapitulatif\n${content.recap}` : '',
    content.exercises.length
      ? `Exercices\n${content.exercises.map((item) => `- ${item}`).join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function structuredLessonContentJson(
  content: StructuredLessonContent
): Prisma.InputJsonValue {
  return content as unknown as Prisma.InputJsonValue
}
