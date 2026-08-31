import type { NextApiRequest, NextApiResponse } from 'next'
import { ContentStatus } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedModule } from '../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import { assessLesson } from '../../../../../lib/lessonQuality'

/**
 * Publie un module.
 *
 * `includeLessons: true` publie aussi toutes ses leçons en brouillon — c'est
 * la seule publication en lot autorisée, et elle exige `confirm: true` : un
 * enseignant ne doit jamais rendre visible en masse un contenu qu'il n'a pas
 * relu par simple inadvertance.
 *
 * Publier un module sans aucune leçon publiée laisserait l'étudiant devant
 * une coquille vide : c'est désormais refusé. L'enseignant publie d'abord une
 * leçon, ou publie le module et ses leçons en une fois, en confirmant.
 */
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
  const publish = body.published === undefined ? true : body.published === true
  const includeLessons = body.includeLessons === true

  if (publish) {
    const lessons = await prisma.lesson.findMany({
      where: { moduleId: access.moduleId },
      select: {
        id: true,
        status: true,
        content: true,
        contentJson: true,
        estimatedMinutes: true,
      },
    })

    const publishedCount = lessons.filter(
      (l) => l.status === ContentStatus.PUBLISHED
    ).length

    // Un module publié sans aucune leçon publiée n'apporte rien à l'étudiant.
    if (publishedCount === 0 && !(includeLessons && lessons.length > 0)) {
      return res.status(400).json({
        code: 'NO_PUBLISHED_LESSON',
        message:
          lessons.length === 0
            ? "Ce module n'a aucune leçon : ajoutez-en une avant de le publier."
            : 'Publiez au moins une leçon avant de publier ce module, ou publiez le module et ses leçons en une fois.',
      })
    }

    if (includeLessons && body.confirm !== true) {
      // Les leçons faibles sont comptées pour que l'avertissement soit précis.
      const weak = lessons.filter(
        (lesson) =>
          lesson.status === ContentStatus.DRAFT &&
          assessLesson(lesson).readiness === 'TOO_LIGHT'
      ).length

      return res.status(400).json({
        code: 'CONFIRMATION_REQUIRED',
        message:
          'Confirmez la publication de toutes les leçons de ce module après les avoir relues.',
        draftLessons: lessons.filter((l) => l.status === ContentStatus.DRAFT)
          .length,
        weakLessons: weak,
      })
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const module = await tx.module.update({
      where: { id: access.moduleId },
      data: { status: publish ? ContentStatus.PUBLISHED : ContentStatus.DRAFT },
      select: { id: true, title: true, status: true },
    })

    let publishedLessons = 0

    if (publish && includeLessons) {
      const updated = await tx.lesson.updateMany({
        where: { moduleId: access.moduleId, status: ContentStatus.DRAFT },
        data: { status: ContentStatus.PUBLISHED },
      })
      publishedLessons = updated.count
    }

    const remaining = await tx.lesson.count({
      where: { moduleId: access.moduleId, status: ContentStatus.PUBLISHED },
    })

    return { module, publishedLessons, publishedLessonCount: remaining }
  })

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: publish ? AuditAction.MODULE_PUBLISH : AuditAction.MODULE_UNPUBLISH,
    entityType: 'Module',
    entityId: result.module.id,
    metadata: {
      courseId: access.courseId,
      status: result.module.status,
      includeLessons,
    },
  })

  if (result.publishedLessons > 0) {
    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.BULK_PUBLISH,
      entityType: 'Module',
      entityId: result.module.id,
      metadata: {
        courseId: access.courseId,
        publishedLessons: result.publishedLessons,
      },
    })
  }

  return res.status(200).json({
    ...result.module,
    publishedLessons: result.publishedLessons,
    publishedLessonCount: result.publishedLessonCount,
    // Signalé, pas bloqué : l'enseignant peut vouloir préparer la coquille.
    emptyForStudents:
      result.module.status === ContentStatus.PUBLISHED &&
      result.publishedLessonCount === 0,
  })
}
