import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { requireAssignedModule } from '../../../../lib/teacherAccess';
import { AuditAction, createAuditLog } from '../../../../lib/audit';
import {
  DETACHED_QUIZ_STATUS,
  impactMessage,
  moduleDeletionImpact,
} from '../../../../lib/contentDeletion';
import { ValidationError } from '../../../../lib/validation';
import {
  contentStatus,
  definedOnly,
  optionalInt,
  optionalText,
  requiredText,
} from '../../../../lib/teacherContent';

/**
 * Modification ou suppression d'un module.
 * Seul le professeur affecté au cours y accède.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedModule(req, res, req.query.moduleId);
  if (!access) return;

  const body = (req.body ?? {}) as Record<string, unknown>;

  if (req.method === 'DELETE') {
    return remove(req, res, access, body);
  }

  try {
    const data = definedOnly({
      title: 'title' in body ? requiredText(body, 'title', 'le titre') : undefined,
      description: optionalText(body, 'description', 2000),
      order: optionalInt(body, 'order', "L'ordre", 0, 999) ?? undefined,
      status: contentStatus(body),
    });

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }

    const updated = await prisma.module.update({
      where: { id: access.moduleId },
      data,
      select: { id: true, title: true, description: true, order: true, status: true },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.MODULE_UPDATE,
      entityType: 'Module',
      entityId: updated.id,
      // Champs modifiés, pas le corps de requête : on trace l'intention.
      metadata: { courseId: access.courseId, fields: Object.keys(data), status: updated.status },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/modules:update]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}

/**
 * Suppression d'un module et de ses leçons.
 *
 * Comme pour une leçon, une première requête sans `confirm` ne supprime rien
 * et renvoie le détail des conséquences. La suppression s'appuie ensuite sur
 * les cascades du schéma : les leçons, leur progression et leurs acquis
 * partent avec le module.
 *
 * Les quiz du module et de ses leçons sont conservés, mais archivés dans la
 * même transaction : un quiz sans contexte n'a rien à faire devant un étudiant.
 */
async function remove(
  req: NextApiRequest,
  res: NextApiResponse,
  access: Awaited<ReturnType<typeof requireAssignedModule>> & object,
  body: Record<string, unknown>
) {
  const confirmed = body.confirm === true || req.query.confirm === 'true';

  const module = await prisma.module.findUnique({
    where: { id: access.moduleId },
    select: { id: true, title: true, status: true },
  });

  if (!module) return res.status(404).json({ message: 'Module introuvable' });

  const { impact, quizIdsToHide } = await moduleDeletionImpact(module);
  const message = impactMessage('module', module.title, module.status, impact);

  if (impact.requiresConfirmation && !confirmed) {
    return res.status(400).json({
      code: 'CONFIRMATION_REQUIRED',
      message,
      impact,
      title: module.title,
      status: module.status,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (quizIdsToHide.length > 0) {
      await tx.quiz.updateMany({
        where: { id: { in: quizIdsToHide } },
        data: { status: DETACHED_QUIZ_STATUS },
      });
    }
    await tx.module.delete({ where: { id: module.id } });
  });

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: AuditAction.MODULE_DELETE,
    entityType: 'Module',
    entityId: module.id,
    metadata: {
      courseId: access.courseId,
      moduleId: module.id,
      title: module.title,
      status: module.status,
      lessons: impact.lessons,
      publishedLessons: impact.publishedLessons,
      studentProgress: impact.studentProgress,
      detachedQuizCount: impact.detachedQuizCount,
      hiddenQuizCount: impact.hiddenQuizCount,
      publishedQuizHiddenCount: impact.publishedQuizHiddenCount,
      forced: impact.requiresConfirmation,
    },
  });

  return res.status(200).json({
    id: module.id,
    title: module.title,
    deleted: true,
    impact,
  });
}
