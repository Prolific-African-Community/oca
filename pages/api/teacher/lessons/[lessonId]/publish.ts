import type { NextApiRequest, NextApiResponse } from 'next'
import { ContentStatus } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedLesson } from '../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import { assessLesson } from '../../../../../lib/lessonQuality'

/**
 * Publie une leçon, ou la repasse en brouillon avec `{ published: false }`.
 * Action délibérée de l'enseignant : rien n'est publié automatiquement.
 *
 * Garde-fou : publier une leçon jugée « trop légère » exige `confirm: true`.
 * L'indicateur n'est qu'une heuristique — il ne décide pas à la place de
 * l'enseignant, mais il l'oblige à confirmer une deuxième fois.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedLesson(req, res, req.query.lessonId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const publish = body.published === undefined ? true : body.published === true

  if (publish && body.confirm !== true) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: access.lessonId },
      select: { content: true, contentJson: true, estimatedMinutes: true },
    })

    if (!lesson) return res.status(404).json({ message: 'Leçon introuvable' })

    const quality = assessLesson(lesson)

    if (quality.readiness === 'TOO_LIGHT') {
      return res.status(400).json({
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Cette leçon est jugée trop légère pour être publiée telle quelle. Confirmez si vous souhaitez la rendre visible aux étudiants.',
        readiness: quality.readiness,
        missingSections: quality.missingSections,
        warnings: quality.warnings,
      })
    }
  }

  const updated = await prisma.lesson.update({
    where: { id: access.lessonId },
    data: {
      status: publish ? ContentStatus.PUBLISHED : ContentStatus.DRAFT,
    },
    select: { id: true, title: true, status: true, moduleId: true },
  })

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: publish ? AuditAction.LESSON_PUBLISH : AuditAction.LESSON_UNPUBLISH,
    entityType: 'Lesson',
    entityId: updated.id,
    metadata: {
      courseId: access.courseId,
      moduleId: updated.moduleId,
      status: updated.status,
      // Trace la publication d'un contenu signalé comme faible.
      forced: publish && body.confirm === true,
    },
  })

  return res.status(200).json(updated)
}
