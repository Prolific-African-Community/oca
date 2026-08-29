import type { NextApiRequest, NextApiResponse } from 'next';
import { AttemptStatus, QuizStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireEnrolledCourse } from '../../../../../lib/studentAccess';

/** Quiz publiés d'un cours suivi, avec la meilleure tentative de l'étudiant. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireEnrolledCourse(req, res, req.query.courseId);
  if (!access) return;

  res.setHeader('Cache-Control', 'no-store');

  const quizzes = await prisma.quiz.findMany({
    where: { courseId: access.courseId, status: QuizStatus.PUBLISHED },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      passingScore: true,
      module: { select: { id: true, title: true } },
      _count: { select: { questions: true } },
      attempts: {
        where: { userId: access.user.id, status: AttemptStatus.SUBMITTED },
        orderBy: { submittedAt: 'desc' },
        take: 1,
        select: { id: true, score: true, maxScore: true, submittedAt: true },
      },
    },
  });

  return res.status(200).json(
    quizzes.map(({ _count, attempts, ...q }) => {
      const last = attempts[0] ?? null;

      return {
        ...q,
        questionCount: _count.questions,
        lastAttempt: last
          ? {
              id: last.id,
              score: last.score,
              maxScore: last.maxScore,
              submittedAt: last.submittedAt,
              percentage:
                last.maxScore && last.maxScore > 0
                  ? Math.round(((last.score ?? 0) / last.maxScore) * 100)
                  : null,
            }
          : null,
      };
    })
  );
}
