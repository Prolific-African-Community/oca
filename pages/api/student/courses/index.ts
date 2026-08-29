import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus, ProgressStatus } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { accessibleCourseWhere, requireStudent } from '../../../../lib/studentAccess';

/** Cours des semestres où l'étudiant connecté est inscrit. Contenus publiés uniquement. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireStudent(req, res);
  if (!scope) return;

  res.setHeader('Cache-Control', 'no-store');

  if (scope.semesterIds.length === 0) {
    return res.status(200).json({ enrolled: false, courses: [] });
  }

  const courses = await prisma.course.findMany({
    where: accessibleCourseWhere(scope),
    orderBy: [{ semesterId: 'asc' }, { order: 'asc' }],
    select: {
      id: true,
      title: true,
      code: true,
      description: true,
      credits: true,
      program: { select: { id: true, name: true, code: true } },
      semester: {
        select: {
          id: true,
          name: true,
          number: true,
          academicYear: { select: { name: true, isCurrent: true } },
        },
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
          _count: { select: { lessons: { where: { status: ContentStatus.PUBLISHED } } } },
        },
      },
    },
  });

  // Progression : une seule requête agrégée pour tous les cours, plutôt qu'une par cours.
  const completed = await prisma.lessonProgress.groupBy({
    by: ['courseId'],
    where: {
      userId: scope.user.id,
      status: ProgressStatus.COMPLETED,
      courseId: { in: courses.map((c) => c.id) },
    },
    _count: { _all: true },
  });

  const completedByCourse = new Map(completed.map((r) => [r.courseId, r._count._all]));

  // Dernière leçon consultée : sert de point de reprise sur le tableau de bord.
  const lastViewed = await prisma.lessonProgress.findFirst({
    where: { userId: scope.user.id, courseId: { in: courses.map((c) => c.id) } },
    orderBy: { lastViewedAt: 'desc' },
    select: {
      lessonId: true,
      courseId: true,
      lastViewedAt: true,
      status: true,
      lesson: { select: { title: true } },
      module: { select: { title: true } },
    },
  });

  return res.status(200).json({
    enrolled: true,
    resume: lastViewed
      ? {
          courseId: lastViewed.courseId,
          lessonId: lastViewed.lessonId,
          lessonTitle: lastViewed.lesson.title,
          moduleTitle: lastViewed.module.title,
          lastViewedAt: lastViewed.lastViewedAt,
          status: lastViewed.status,
        }
      : null,
    courses: courses.map((c) => {
      const lead = c.assignments[0]?.user;
      const lessonCount = c.modules.reduce((n, m) => n + m._count.lessons, 0);
      const completedCount = Math.min(completedByCourse.get(c.id) ?? 0, lessonCount);

      return {
        id: c.id,
        title: c.title,
        code: c.code,
        description: c.description,
        credits: c.credits,
        program: c.program,
        semester: {
          id: c.semester.id,
          name: c.semester.name,
          number: c.semester.number,
          academicYear: c.semester.academicYear.name,
          isCurrentYear: c.semester.academicYear.isCurrent,
        },
        teacher: lead ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') : null,
        moduleCount: c.modules.length,
        lessonCount,
        completedLessons: completedCount,
        // Avancement dérivé du nombre de leçons publiées : recalculé à chaque
        // lecture, donc toujours cohérent si l'enseignant publie ou dépublie.
        progress: lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100),
        // Premier module publié non vide : point d'entrée proposé sur le tableau de bord.
        firstModule: c.modules.find((m) => m._count.lessons > 0) ?? null,
      };
    }),
  });
}
