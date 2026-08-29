import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus, ProgressStatus } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { accessibleCourseWhere, requireStudent } from '../../../../lib/studentAccess';

/**
 * Leçon consultée par un étudiant.
 * La leçon doit être publiée, dans un module publié, d'un cours d'un semestre
 * où l'étudiant est inscrit. Toute autre situation renvoie 404.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireStudent(req, res);
  if (!scope) return;

  const { lessonId } = req.query;

  if (typeof lessonId !== 'string' || !lessonId || scope.semesterIds.length === 0) {
    return res.status(404).json({ message: 'Leçon introuvable' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      status: ContentStatus.PUBLISHED,
      module: {
        status: ContentStatus.PUBLISHED,
        course: accessibleCourseWhere(scope),
      },
    },
    select: {
      id: true,
      title: true,
      content: true,
      estimatedMinutes: true,
      order: true,
      module: {
        select: {
          id: true,
          title: true,
          course: { select: { id: true, title: true, code: true } },
          lessons: {
            where: { status: ContentStatus.PUBLISHED },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!lesson) return res.status(404).json({ message: 'Leçon introuvable' });

  // Navigation séquentielle à l'intérieur du module.
  const siblings = lesson.module.lessons;
  const index = siblings.findIndex((l) => l.id === lesson.id);

  const progress = await prisma.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: scope.user.id, lessonId: lesson.id } },
    select: { status: true, firstViewedAt: true, lastViewedAt: true, completedAt: true },
  });

  return res.status(200).json({
    id: lesson.id,
    title: lesson.title,
    content: lesson.content,
    estimatedMinutes: lesson.estimatedMinutes,
    module: { id: lesson.module.id, title: lesson.module.title },
    course: lesson.module.course,
    position: { index: index + 1, total: siblings.length },
    previous: index > 0 ? siblings[index - 1] : null,
    next: index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null,
    progress: progress ?? { status: ProgressStatus.NOT_STARTED, completedAt: null },
  });
}
