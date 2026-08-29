import type { NextApiRequest, NextApiResponse } from 'next';
import { AttemptStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAccessibleQuiz } from '../../../../../lib/studentAccess';
import { gradeAnswer, isAutoGraded } from '../../../../../lib/quiz';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';

/**
 * Soumission d'une tentative.
 *
 * La correction est faite **côté serveur** à partir des questions en base :
 * le client n'envoie que ses réponses, jamais de score. Les questions à texte
 * libre sont enregistrées mais exclues du score automatique.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAccessibleQuiz(req, res, req.query.quizId);
  if (!access) return;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawAnswers = Array.isArray(body.answers) ? body.answers : null;

  if (!rawAnswers) {
    return res.status(400).json({ message: 'Réponses attendues', field: 'answers' });
  }

  const questions = await prisma.quizQuestion.findMany({
    where: { quizId: access.quizId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, type: true, correctAnswer: true, explanation: true, points: true },
  });

  if (questions.length === 0) {
    return res.status(400).json({ message: 'Ce quiz ne contient aucune question' });
  }

  const responses = new Map<string, unknown>();
  for (const item of rawAnswers) {
    if (item && typeof item === 'object' && typeof (item as any).questionId === 'string') {
      responses.set((item as any).questionId, (item as any).response);
    }
  }

  let score = 0;
  let maxScore = 0;
  let manualCount = 0;

  const graded = questions.map((q) => {
    const result = gradeAnswer(q, responses.get(q.id));

    if (isAutoGraded(q.type)) {
      maxScore += q.points;
      score += result.pointsAwarded;
    } else {
      manualCount += 1;
    }

    return {
      questionId: q.id,
      response: (responses.get(q.id) ?? null) as Prisma.InputJsonValue,
      isCorrect: result.isCorrect,
      pointsAwarded: result.pointsAwarded,
    };
  });

  const attempt = await prisma.$transaction(async (tx) => {
    const current =
      (await tx.quizAttempt.findFirst({
        where: { quizId: access.quizId, userId: access.user.id, status: AttemptStatus.IN_PROGRESS },
        select: { id: true },
      })) ??
      (await tx.quizAttempt.create({
        data: { quizId: access.quizId, userId: access.user.id },
        select: { id: true },
      }));

    for (const answer of graded) {
      await tx.quizAnswer.upsert({
        where: { attemptId_questionId: { attemptId: current.id, questionId: answer.questionId } },
        update: {
          response: answer.response,
          isCorrect: answer.isCorrect,
          pointsAwarded: answer.pointsAwarded,
        },
        create: { attemptId: current.id, ...answer },
      });
    }

    return tx.quizAttempt.update({
      where: { id: current.id },
      data: {
        status: AttemptStatus.SUBMITTED,
        score,
        maxScore,
        submittedAt: new Date(),
      },
      select: { id: true, score: true, maxScore: true, submittedAt: true },
    });
  });

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: AuditAction.QUIZ_ATTEMPT_SUBMIT,
    entityType: 'QuizAttempt',
    entityId: attempt.id,
    metadata: { quizId: access.quizId, courseId: access.courseId, score, maxScore },
  });

  const byQuestion = new Map(questions.map((q) => [q.id, q]));

  return res.status(200).json({
    attemptId: attempt.id,
    score,
    maxScore,
    percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : null,
    manualQuestions: manualCount,
    submittedAt: attempt.submittedAt,
    answers: graded.map((a) => ({
      ...a,
      correctAnswer: byQuestion.get(a.questionId)?.correctAnswer ?? null,
      explanation: byQuestion.get(a.questionId)?.explanation ?? null,
    })),
  });
}
