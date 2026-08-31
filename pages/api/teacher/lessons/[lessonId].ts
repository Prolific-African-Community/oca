import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requireAssignedLesson } from '../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../lib/audit'
import { ValidationError } from '../../../../lib/validation'
import {
  contentStatus,
  definedOnly,
  optionalInt,
  optionalText,
  requiredText,
} from '../../../../lib/teacherContent'

/** Modification d'une leçon. Seul le professeur affecté au cours y accède. */
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

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    const plainContent = optionalText(body, 'content')
    const data = definedOnly({
      title:
        'title' in body ? requiredText(body, 'title', 'le titre') : undefined,
      content: plainContent,
      // Une édition manuelle du texte devient la source d'affichage afin de ne
      // jamais masquer le changement derrière un ancien JSON structuré.
      contentJson: plainContent !== undefined ? Prisma.DbNull : undefined,
      estimatedMinutes: optionalInt(
        body,
        'estimatedMinutes',
        'La durée',
        0,
        1440
      ),
      order: optionalInt(body, 'order', "L'ordre", 0, 999) ?? undefined,
      status: contentStatus(body),
    })

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' })
    }

    const updated = await prisma.lesson.update({
      where: { id: access.lessonId },
      data,
      select: {
        id: true,
        title: true,
        content: true,
        contentJson: true,
        order: true,
        estimatedMinutes: true,
        status: true,
      },
    })

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.LESSON_UPDATE,
      entityType: 'Lesson',
      entityId: updated.id,
      metadata: {
        courseId: access.courseId,
        moduleId: access.moduleId,
        fields: Object.keys(data),
        status: updated.status,
      },
    })

    return res.status(200).json(updated)
  } catch (error) {
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ message: error.message, field: error.field })
    }
    console.error('[teacher/lessons:update]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
