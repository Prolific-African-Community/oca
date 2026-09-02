import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedLesson } from '../../../../../lib/teacherAccess'
import { ValidationError } from '../../../../../lib/validation'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import {
  StructuredLessonContent,
  asStructuredLessonContent,
  structuredLessonContentJson,
  structuredLessonContentToPlainText,
} from '../../../../../lib/lessonContent'
import { assessLesson } from '../../../../../lib/lessonQuality'

/**
 * Modification **section par section** du contenu structuré d'une leçon.
 *
 * Deux garanties tenues ici :
 *  - une section modifiée ne détruit pas les autres : le corps de requête est
 *    fusionné avec le contenu existant, jamais substitué ;
 *  - `Lesson.content` est régénéré à partir du structuré, pour que le repli
 *    texte reste cohérent avec ce que voit l'étudiant.
 */

const EMPTY: StructuredLessonContent = {
  introduction: '',
  keyConcepts: [],
  explanation: '',
  practicalExample: '',
  recap: '',
  exercises: [],
}

function text(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Texte attendu', field)
  }
  if (value.length > max) {
    throw new ValidationError(`${max} caractères maximum`, field)
  }
  return value
}

function list(value: unknown, field: string, max: number, itemMax: number) {
  if (!Array.isArray(value)) {
    throw new ValidationError('Liste attendue', field)
  }
  if (value.length > max) {
    throw new ValidationError(`${max} éléments maximum`, field)
  }
  return value
    .map((item) => text(item, field, itemMax).trim())
    .filter((item) => item.length > 0)
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedLesson(req, res, req.query.lessonId)
  if (!access) return

  const lesson = await prisma.lesson.findUnique({
    where: { id: access.lessonId },
    select: { contentJson: true, content: true, estimatedMinutes: true },
  })

  if (!lesson) return res.status(404).json({ message: 'Leçon introuvable' })

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    // Point de départ : le structuré existant. À défaut, un squelette vide dont
    // l'explication reprend le texte simple, pour ne rien perdre en migrant.
    const current =
      asStructuredLessonContent(lesson.contentJson) ??
      ({ ...EMPTY, explanation: (lesson.content ?? '').trim() } as StructuredLessonContent)

    const next: StructuredLessonContent = {
      introduction:
        'introduction' in body
          ? text(body.introduction, 'introduction', 6000)
          : current.introduction,
      keyConcepts:
        'keyConcepts' in body
          ? list(body.keyConcepts, 'keyConcepts', 20, 1000)
          : current.keyConcepts,
      explanation:
        'explanation' in body
          ? text(body.explanation, 'explanation', 20_000)
          : current.explanation,
      practicalExample:
        'practicalExample' in body
          ? text(body.practicalExample, 'practicalExample', 8000)
          : current.practicalExample,
      recap: 'recap' in body ? text(body.recap, 'recap', 6000) : current.recap,
      exercises:
        'exercises' in body
          ? list(body.exercises, 'exercises', 20, 4000)
          : current.exercises,
    }

    const touched = [
      'introduction',
      'keyConcepts',
      'explanation',
      'practicalExample',
      'recap',
      'exercises',
    ].filter((field) => field in body)

    if (touched.length === 0) {
      return res.status(400).json({ message: 'Aucune section fournie' })
    }

    const updated = await prisma.lesson.update({
      where: { id: access.lessonId },
      data: {
        contentJson: structuredLessonContentJson(next),
        // Repli texte régénéré : jamais saisi à la main, donc jamais divergent.
        content: structuredLessonContentToPlainText(next),
      },
      select: {
        id: true,
        title: true,
        status: true,
        content: true,
        contentJson: true,
        estimatedMinutes: true,
        updatedAt: true,
      },
    })

    // `intent` ne change rien à l'écriture : il précise seulement la trace
    // laissée dans le journal (édition manuelle, application d'un brouillon IA,
    // ou effacement volontaire d'une section).
    const intent =
      body.intent === 'APPLY_AI'
        ? AuditAction.LESSON_SECTION_APPLY
        : body.intent === 'CLEAR'
        ? AuditAction.LESSON_SECTION_CLEAR
        : AuditAction.LESSON_STRUCTURED_UPDATE

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: intent,
      entityType: 'Lesson',
      entityId: updated.id,
      metadata: {
        courseId: access.courseId,
        moduleId: access.moduleId,
        sections: touched,
        aiGenerationId:
          typeof body.aiGenerationId === 'string' ? body.aiGenerationId : null,
      },
    })

    return res.status(200).json({
      id: updated.id,
      title: updated.title,
      status: updated.status,
      estimatedMinutes: updated.estimatedMinutes,
      updatedAt: updated.updatedAt,
      structuredContent: asStructuredLessonContent(updated.contentJson),
      plainContent: updated.content,
      quality: assessLesson(updated),
    })
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field })
    }
    console.error('[teacher/lessons:structured-content]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
