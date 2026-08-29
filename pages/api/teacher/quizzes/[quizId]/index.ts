import type { NextApiRequest, NextApiResponse } from 'next';
import { QuizStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAssignedQuiz } from '../../../../../lib/teacherAccess';
import { ValidationError } from '../../../../../lib/validation';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';

/**
 * Détail d'un quiz (GET) et modification (PATCH), y compris publication
 * et archivage — un simple changement de `status`.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedQuiz(req, res, req.query.quizId);
  if (!access) return;

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    const quiz = await prisma.quiz.findUnique({
      where: { id: access.quizId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        passingScore: true,
        order: true,
        moduleId: true,
        lessonId: true,
        questions: {
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
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
        },
        _count: { select: { attempts: true } },
      },
    });

    if (!quiz) return res.status(404).json({ message: 'Quiz introuvable' });

    const { _count, ...rest } = quiz;
    return res.status(200).json({ ...rest, attemptCount: _count.attempts });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const data: Record<string, unknown> = {};

    if ('title' in body) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) throw new ValidationError('Renseignez le titre', 'title');
      data.title = title;
    }

    if ('description' in body) {
      data.description =
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null;
    }

    if ('passingScore' in body) {
      const value =
        body.passingScore === null || body.passingScore === '' ? null : Number(body.passingScore);
      if (value !== null && (!Number.isInteger(value) || value < 0 || value > 100)) {
        throw new ValidationError('Le seuil de réussite : entier attendu entre 0 et 100', 'passingScore');
      }
      data.passingScore = value;
    }

    if ('order' in body) {
      const value = Number(body.order);
      if (!Number.isInteger(value) || value < 0 || value > 999) {
        throw new ValidationError("L'ordre : entier attendu entre 0 et 999", 'order');
      }
      data.order = value;
    }

    let publishing = false;

    if ('status' in body) {
      const status = body.status;
      if (typeof status !== 'string' || !Object.values(QuizStatus).includes(status as QuizStatus)) {
        throw new ValidationError('Statut invalide', 'status');
      }

      // Publier un quiz sans question n'aurait aucun sens côté étudiant.
      if (status === QuizStatus.PUBLISHED) {
        const questionCount = await prisma.quizQuestion.count({ where: { quizId: access.quizId } });
        if (questionCount === 0) {
          throw new ValidationError('Ajoutez au moins une question avant de publier', 'status');
        }
        publishing = true;
      }

      data.status = status;
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: 'Aucune modification fournie' });
    }

    const updated = await prisma.quiz.update({
      where: { id: access.quizId },
      data,
      select: { id: true, title: true, status: true, passingScore: true, order: true },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: publishing ? AuditAction.QUIZ_PUBLISH : AuditAction.QUIZ_UPDATE,
      entityType: 'Quiz',
      entityId: updated.id,
      metadata: { courseId: access.courseId, fields: Object.keys(data), status: updated.status },
    });

    return res.status(200).json(updated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/quizzes:update]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
