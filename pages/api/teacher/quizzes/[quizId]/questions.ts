import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../../lib/prisma';
import { requireAssignedQuiz } from '../../../../../lib/teacherAccess';
import { ValidationError } from '../../../../../lib/validation';
import { normalizeQuestion } from '../../../../../lib/quiz';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';

/** Ajout d'une question à un quiz du cours enseigné. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedQuiz(req, res, req.query.quizId);
  if (!access) return;

  try {
    const question = normalizeQuestion((req.body ?? {}) as Record<string, unknown>);

    const order =
      ((await prisma.quizQuestion.aggregate({
        where: { quizId: access.quizId },
        _max: { order: true },
      }))._max.order ?? -1) + 1;

    const created = await prisma.quizQuestion.create({
      data: {
        quizId: access.quizId,
        prompt: question.prompt,
        type: question.type,
        options: question.options ?? undefined,
        correctAnswer: question.correctAnswer ?? undefined,
        explanation: question.explanation,
        points: question.points,
        order,
      },
      select: {
        id: true,
        prompt: true,
        type: true,
        options: true,
        correctAnswer: true,
        explanation: true,
        points: true,
        order: true,
      },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.QUESTION_CREATE,
      entityType: 'QuizQuestion',
      entityId: created.id,
      metadata: { quizId: access.quizId, type: created.type, points: created.points },
    });

    return res.status(201).json(created);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/questions:create]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
