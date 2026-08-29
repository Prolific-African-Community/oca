import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus, ProgressStatus } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { requireEnrolledCourse } from '../../../../lib/studentAccess';

/**
 * Détail d'un cours suivi par l'étudiant : modules et leçons **publiés** uniquement.
 * Les brouillons de l'enseignant ne sortent jamais de cette route.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireEnrolledCourse(req, res, req.query.courseId);
  if (!access) return;

  res.setHeader('Cache-Control', 'no-store');

  const course = await prisma.course.findUnique({
    where: { id: access.courseId },
    select: {
      id: true,
      title: true,
      code: true,
      description: true,
      credits: true,
      coefficient: true,
      program: { select: { id: true, name: true, code: true } },
      semester: {
        select: { id: true, name: true, academicYear: { select: { name: true } } },
      },
      assignments: {
        orderBy: { role: 'asc' },
        select: { role: true, user: { select: { firstName: true, lastName: true } } },
      },
      modules: {
        where: { status: ContentStatus.PUBLISHED },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          lessons: {
            where: { status: ContentStatus.PUBLISHED },
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, title: true, order: true, estimatedMinutes: true },
          },
        },
      },
    },
  });

  if (!course) return res.status(404).json({ message: 'Cours introuvable' });

  const progressRows = await prisma.lessonProgress.findMany({
    where: { userId: access.user.id, courseId: course.id },
    select: { lessonId: true, status: true, completedAt: true, lastViewedAt: true },
  });

  const byLesson = new Map(progressRows.map((r) => [r.lessonId, r]));

  const modules = course.modules.map((m) => {
    const lessons = m.lessons.map((l) => {
      const p = byLesson.get(l.id);
      return {
        ...l,
        status: p?.status ?? ProgressStatus.NOT_STARTED,
        completedAt: p?.completedAt ?? null,
        lastViewedAt: p?.lastViewedAt ?? null,
      };
    });

    const completed = lessons.filter((l) => l.status === ProgressStatus.COMPLETED).length;

    return {
      ...m,
      lessons,
      completedLessons: completed,
      progress: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
    };
  });

  const allLessons = modules.flatMap((m) => m.lessons);
  const completedTotal = allLessons.filter((l) => l.status === ProgressStatus.COMPLETED).length;

  // Prochaine leçon = première non terminée, dans l'ordre du cours.
  const nextLesson = allLessons.find((l) => l.status !== ProgressStatus.COMPLETED) ?? null;

  return res.status(200).json({
    ...course,
    modules,
    lessonCount: allLessons.length,
    completedLessons: completedTotal,
    progress: allLessons.length === 0 ? 0 : Math.round((completedTotal / allLessons.length) * 100),
    nextLesson: nextLesson ? { id: nextLesson.id, title: nextLesson.title } : null,
    semester: {
      id: course.semester.id,
      name: course.semester.name,
      academicYear: course.semester.academicYear.name,
    },
    teachers: course.assignments.map((a) => ({
      role: a.role,
      name: [a.user.firstName, a.user.lastName].filter(Boolean).join(' '),
    })),
  });
}
