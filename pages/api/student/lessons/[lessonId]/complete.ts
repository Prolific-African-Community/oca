import type { NextApiRequest, NextApiResponse } from 'next';
import { ProgressStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAccessibleLesson } from '../../../../../lib/studentAccess';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';

/**
 * Marque une leçon comme terminée, ou revient en arrière avec `{ completed: false }`.
 * Idempotent : `completedAt` conserve la date du premier achèvement.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAccessibleLesson(req, res, req.query.lessonId);
  if (!access) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const completed = body.completed === undefined ? true : body.completed === true;
  const now = new Date();

  const existing = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: access.user.id, lessonId: access.lessonId } },
    select: { completedAt: true },
  });

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: access.user.id, lessonId: access.lessonId } },
    update: {
      status: completed ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS,
      completedAt: completed ? existing?.completedAt ?? now : null,
      lastViewedAt: now,
    },
    create: {
      userId: access.user.id,
      lessonId: access.lessonId,
      moduleId: access.moduleId,
      courseId: access.courseId,
      status: completed ? ProgressStatus.COMPLETED : ProgressStatus.IN_PROGRESS,
      completedAt: completed ? now : null,
      firstViewedAt: now,
      lastViewedAt: now,
    },
    select: { status: true, firstViewedAt: true, lastViewedAt: true, completedAt: true },
  });

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: completed ? AuditAction.LESSON_COMPLETE : AuditAction.LESSON_UNCOMPLETE,
    entityType: 'Lesson',
    entityId: access.lessonId,
    metadata: { courseId: access.courseId, moduleId: access.moduleId },
  });

  return res.status(200).json(progress);
}
