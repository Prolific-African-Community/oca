import type { NextApiRequest, NextApiResponse } from 'next'
import { ContentStatus } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedModule } from '../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import { ValidationError } from '../../../../../lib/validation'
import {
  contentStatus,
  optionalInt,
  optionalText,
  requiredText,
} from '../../../../../lib/teacherContent'

/** Création d'une leçon dans un module du professeur connecté. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedModule(req, res, req.query.moduleId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>

  try {
    const explicitOrder = optionalInt(body, 'order', "L'ordre", 0, 999)

    const order =
      explicitOrder ??
      ((
        await prisma.lesson.aggregate({
          where: { moduleId: access.moduleId },
          _max: { order: true },
        })
      )._max.order ?? -1) + 1

    const created = await prisma.lesson.create({
      data: {
        moduleId: access.moduleId,
        title: requiredText(body, 'title', 'le titre'),
        // Contenu en texte simple à ce stade : ni éditeur riche, ni pièces jointes.
        content: optionalText(body, 'content') ?? null,
        estimatedMinutes:
          optionalInt(body, 'estimatedMinutes', 'La durée', 0, 1440) ?? null,
        order,
        status: contentStatus(body) ?? ContentStatus.DRAFT,
      },
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
      action: AuditAction.LESSON_CREATE,
      entityType: 'Lesson',
      entityId: created.id,
      metadata: {
        courseId: access.courseId,
        moduleId: access.moduleId,
        title: created.title,
        status: created.status,
      },
    })

    return res.status(201).json(created)
  } catch (error) {
    if (error instanceof ValidationError) {
      return res
        .status(400)
        .json({ message: error.message, field: error.field })
    }
    console.error('[teacher/lessons:create]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
