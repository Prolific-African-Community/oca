import type { NextApiRequest, NextApiResponse } from 'next';
import { AttemptStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAccessibleQuiz } from '../../../../../lib/studentAccess';
import { toStudentQuestion } from '../../../../../lib/quiz';

/**
 * Quiz vu par l'étudiant.
 *
 * Tant que rien n'est soumis, ni `correctAnswer` ni `explanation` ne quittent
 * le serveur : ils ne sont sélectionnés que pour construire la correction d'une
 * tentative déjà soumise.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAccessibleQuiz(req, res, req.query.quizId);
  if (!access) return;

  res.setHeader('Cache-Control', 'no-store');

  const quiz = await prisma.quiz.findUnique({
    where: { id: access.quizId },
    select: {
      id: true,
      title: true,
      description: true,
      passingScore: true,
      course: { select: { id: true, title: true, code: true } },
      module: { select: { id: true, title: true } },
      questions: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, prompt: true, type: true, options: true, points: true, order: true },
      },
    },
  });

  if (!quiz) return res.status(404).json({ message: 'Quiz introuvable' });

  const lastAttempt = await prisma.quizAttempt.findFirst({
    where: { quizId: access.quizId, userId: access.user.id, status: AttemptStatus.SUBMITTED },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      score: true,
      maxScore: true,
      submittedAt: true,
      answers: {
        select: {
          questionId: true,
          response: true,
          isCorrect: true,
          pointsAwarded: true,
          question: { select: { correctAnswer: true, explanation: true } },
        },
      },
    },
  });

  return res.status(200).json({
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    passingScore: quiz.passingScore,
    course: quiz.course,
    module: quiz.module,
    questions: quiz.questions.map(toStudentQuestion),
    // La correction n'accompagne que les tentatives déjà soumises.
    lastAttempt: lastAttempt
      ? {
          id: lastAttempt.id,
          score: lastAttempt.score,
          maxScore: lastAttempt.maxScore,
          submittedAt: lastAttempt.submittedAt,
          percentage:
            lastAttempt.maxScore && lastAttempt.maxScore > 0
              ? Math.round(((lastAttempt.score ?? 0) / lastAttempt.maxScore) * 100)
              : null,
          answers: lastAttempt.answers.map((a) => ({
            questionId: a.questionId,
            response: a.response,
            isCorrect: a.isCorrect,
            pointsAwarded: a.pointsAwarded,
            correctAnswer: a.question.correctAnswer,
            explanation: a.question.explanation,
          })),
        }
      : null,
  });
}
