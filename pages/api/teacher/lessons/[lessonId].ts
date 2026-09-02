import type { NextApiRequest, NextApiResponse } from 'next'
import { Prisma } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requireAssignedLesson } from '../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../lib/audit'
import {
  DETACHED_QUIZ_STATUS,
  impactMessage,
  lessonDeletionImpact,
} from '../../../../lib/contentDeletion'
import { ValidationError } from '../../../../lib/validation'
import {
  contentStatus,
  definedOnly,
  optionalInt,
  optionalText,
  requiredText,
} from '../../../../lib/teacherContent'

/**
 * Modification ou suppression d'une leçon.
 * Seul le professeur affecté au cours y accède.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedLesson(req, res, req.query.lessonId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>

  if (req.method === 'DELETE') {
    return remove(req, res, access, body)
  }

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

/**
 * Suppression d'une leçon.
 *
 * Une première requête sans `confirm` ne supprime rien : elle renvoie 400 avec
 * le détail de ce qui serait détruit. L'enseignant décide ensuite en
 * connaissance de cause.
 *
 * Les cascades du schéma emportent la progression étudiante et les acquis
 * rattachés. Les quiz survivent au SetNull : ils sont archivés dans la même
 * transaction, faute de quoi un quiz publié resterait visible des étudiants
 * sans sa leçon.
 */
async function remove(
  req: NextApiRequest,
  res: NextApiResponse,
  access: Awaited<ReturnType<typeof requireAssignedLesson>> & object,
  body: Record<string, unknown>
) {
  const confirmed = body.confirm === true || req.query.confirm === 'true'

  const lesson = await prisma.lesson.findUnique({
    where: { id: access.lessonId },
    select: { id: true, title: true, status: true, moduleId: true },
  })

  if (!lesson) return res.status(404).json({ message: 'Leçon introuvable' })

  const { impact, quizIdsToHide } = await lessonDeletionImpact(lesson)
  const message = impactMessage('lesson', lesson.title, lesson.status, impact)

  if (impact.requiresConfirmation && !confirmed) {
    return res.status(400).json({
      code: 'CONFIRMATION_REQUIRED',
      message,
      impact,
      title: lesson.title,
      status: lesson.status,
    })
  }

  // Archivage puis suppression dans la même transaction : aucun instant
  // pendant lequel un quiz orphelin resterait visible.
  await prisma.$transaction(async (tx) => {
    if (quizIdsToHide.length > 0) {
      await tx.quiz.updateMany({
        where: { id: { in: quizIdsToHide } },
        data: { status: DETACHED_QUIZ_STATUS },
      })
    }
    await tx.lesson.delete({ where: { id: lesson.id } })
  })

  // Le journal survit à l'objet : entityId reste un texte libre.
  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: AuditAction.LESSON_DELETE,
    entityType: 'Lesson',
    entityId: lesson.id,
    metadata: {
      courseId: access.courseId,
      moduleId: lesson.moduleId,
      lessonId: lesson.id,
      title: lesson.title,
      status: lesson.status,
      studentProgress: impact.studentProgress,
      detachedQuizCount: impact.detachedQuizCount,
      hiddenQuizCount: impact.hiddenQuizCount,
      publishedQuizHiddenCount: impact.publishedQuizHiddenCount,
      // Suppression d'un contenu visible ou porteur de progression.
      forced: impact.requiresConfirmation,
    },
  })

  return res.status(200).json({
    id: lesson.id,
    moduleId: lesson.moduleId,
    title: lesson.title,
    deleted: true,
    impact,
  })
}
