import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '../../../../lib/prisma';
import { requireAssignedQuestion } from '../../../../lib/teacherAccess';
import { ValidationError } from '../../../../lib/validation';
import { normalizeQuestion } from '../../../../lib/quiz';
import { AuditAction, createAuditLog } from '../../../../lib/audit';

/**
 * Modification d'une question. La question est revalidée en entier :
 * changer le type sans changer la réponse attendue produirait sinon des
 * questions incohérentes, donc incorrigibles.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedQuestion(req, res, req.query.questionId);
  if (!access) return;

  try {
    const existing = await prisma.quizQuestion.findUnique({
      where: { id: access.questionId },
      select: { prompt: true, type: true, options: true, correctAnswer: true, explanation: true, points: true, order: true },
    });

    if (!existing) return res.status(404).json({ message: 'Question introuvable' });

    const body = (req.body ?? {}) as Record<string, unknown>;

    const merged = {
      prompt: 'prompt' in body ? body.prompt : existing.prompt,
      type: 'type' in body ? body.type : existing.type,
      options: 'options' in body ? body.options : existing.options,
      correctAnswer: 'correctAnswer' in body ? body.correctAnswer : existing.correctAnswer,
      explanation: 'explanation' in body ? body.explanation : existing.explanation,
      points: 'points' in body ? body.points : existing.points,
    };

    const question = normalizeQuestion(merged);

    const order =
      'order' in body ? Number(body.order) : existing.order;

    if (!Number.isInteger(order) || order < 0 || order > 999) {
      throw new ValidationError("L'ordre : entier attendu entre 0 et 999", 'order');
    }

    const updated = await prisma.quizQuestion.update({
      where: { id: access.questionId },
      data: {
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
      action: AuditAction.QUESTION_UPDATE,
      entityType: 'QuizQuestion',
      entityId: updated.id,
      metadata: { quizId: access.quizId, fields: Object.keys(body), type: updated.type },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/questions:update]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
