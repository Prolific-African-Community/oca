import type { NextApiRequest, NextApiResponse } from 'next';
import { ProgressStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAccessibleLesson } from '../../../../../lib/studentAccess';

/**
 * Marque une leçon comme consultée par l'étudiant connecté.
 * Idempotent : la première consultation crée la ligne, les suivantes ne font
 * qu'actualiser `lastViewedAt`. Une leçon déjà terminée ne redescend jamais
 * en IN_PROGRESS — la relire ne « dé-valide » pas.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAccessibleLesson(req, res, req.query.lessonId);
  if (!access) return;

  const now = new Date();

  const progress = await prisma.lessonProgress.upsert({
    where: { userId_lessonId: { userId: access.user.id, lessonId: access.lessonId } },
    update: { lastViewedAt: now },
    create: {
      userId: access.user.id,
      lessonId: access.lessonId,
      moduleId: access.moduleId,
      courseId: access.courseId,
      status: ProgressStatus.IN_PROGRESS,
      firstViewedAt: now,
      lastViewedAt: now,
    },
    select: { status: true, firstViewedAt: true, lastViewedAt: true, completedAt: true },
  });

  return res.status(200).json(progress);
}
