import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus, ProgressStatus } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { accessibleCourseWhere, requireStudent } from '../../../lib/studentAccess';
import type { StudentSummary } from '../../../lib/studentSummary';

/**
 * Synthèse de l'étudiant connecté : inscription, cours, avancement.
 *
 * Ne renvoie que des faits mesurés — inscriptions et leçons terminées.
 * Aucune note, aucun crédit « validé », aucune moyenne : rien de tout cela
 * n'existe en base, et l'avancement de lecture ne vaut pas validation académique.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StudentSummary | { message: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireStudent(req, res);
  if (!scope) return;

  res.setHeader('Cache-Control', 'no-store');

  if (scope.semesterIds.length === 0) {
    return res.status(200).json({
      enrolled: false,
      program: null,
      semester: null,
      courseCount: 0,
      creditsEnrolled: 0,
      lessonCount: 0,
      completedLessons: 0,
      progress: 0,
      courses: [],
    });
  }

  const courses = await prisma.course.findMany({
    where: accessibleCourseWhere(scope),
    orderBy: [{ semesterId: 'asc' }, { order: 'asc' }],
    select: {
      id: true,
      title: true,
      code: true,
      credits: true,
      program: { select: { name: true, code: true } },
      semester: {
        select: { name: true, academicYear: { select: { name: true } } },
      },
      assignments: {
        orderBy: { role: 'asc' },
        select: { role: true, user: { select: { firstName: true, lastName: true } } },
      },
      modules: {
        where: { status: ContentStatus.PUBLISHED },
        select: { _count: { select: { lessons: { where: { status: ContentStatus.PUBLISHED } } } } },
      },
    },
  });

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

  const rows = courses.map((c) => {
    const lessonCount = c.modules.reduce((n, m) => n + m._count.lessons, 0);
    const completedCount = Math.min(completedByCourse.get(c.id) ?? 0, lessonCount);

    return {
      id: c.id,
      title: c.title,
      code: c.code,
      credits: c.credits,
      lessonCount,
      completedLessons: completedCount,
      progress: lessonCount === 0 ? 0 : Math.round((completedCount / lessonCount) * 100),
      teachers: c.assignments.map((a) => ({
        role: a.role,
        name: [a.user.firstName, a.user.lastName].filter(Boolean).join(' '),
      })),
    };
  });

  const lessonCount = rows.reduce((n, c) => n + c.lessonCount, 0);
  const completedLessons = rows.reduce((n, c) => n + c.completedLessons, 0);
  const first = courses[0];

  return res.status(200).json({
    enrolled: true,
    program: first ? first.program : null,
    semester: first
      ? { name: first.semester.name, academicYear: first.semester.academicYear.name }
      : null,
    courseCount: rows.length,
    /// Crédits des cours suivis ce semestre — pas des crédits acquis.
    creditsEnrolled: rows.reduce((n, c) => n + c.credits, 0),
    lessonCount,
    completedLessons,
    progress: lessonCount === 0 ? 0 : Math.round((completedLessons / lessonCount) * 100),
    courses: rows,
  });
}
