import type { NextApiRequest, NextApiResponse } from 'next';
import { QuizStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAssignedCourse } from '../../../../../lib/teacherAccess';
import { ValidationError } from '../../../../../lib/validation';
import { AuditAction, createAuditLog } from '../../../../../lib/audit';

/** Quiz d'un cours enseigné : liste (GET) et création (POST). */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAssignedCourse(req, res, req.query.courseId);
  if (!access) return;

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    const quizzes = await prisma.quiz.findMany({
      where: { courseId: access.courseId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        passingScore: true,
        order: true,
        moduleId: true,
        lessonId: true,
        _count: { select: { questions: true, attempts: true } },
      },
    });

    return res.status(200).json(
      quizzes.map(({ _count, ...q }) => ({
        ...q,
        questionCount: _count.questions,
        attemptCount: _count.attempts,
      }))
    );
  }

  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) throw new ValidationError('Renseignez le titre', 'title');
    if (title.length > 200) throw new ValidationError('200 caractères maximum', 'title');

    const passingScore =
      body.passingScore === undefined || body.passingScore === null || body.passingScore === ''
        ? null
        : Number(body.passingScore);

    if (passingScore !== null && (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100)) {
      throw new ValidationError('Le seuil de réussite : entier attendu entre 0 et 100', 'passingScore');
    }

    // Un module ou une leçon de rattachement doit relever du cours enseigné.
    const moduleId = typeof body.moduleId === 'string' && body.moduleId ? body.moduleId : null;
    const lessonId = typeof body.lessonId === 'string' && body.lessonId ? body.lessonId : null;

    if (moduleId) {
      const mod = await prisma.module.findFirst({
        where: { id: moduleId, courseId: access.courseId },
        select: { id: true },
      });
      if (!mod) throw new ValidationError('Module inconnu pour ce cours', 'moduleId');
    }

    if (lessonId) {
      const lesson = await prisma.lesson.findFirst({
        where: { id: lessonId, module: { courseId: access.courseId } },
        select: { id: true },
      });
      if (!lesson) throw new ValidationError('Leçon inconnue pour ce cours', 'lessonId');
    }

    const order =
      ((await prisma.quiz.aggregate({
        where: { courseId: access.courseId },
        _max: { order: true },
      }))._max.order ?? -1) + 1;

    const created = await prisma.quiz.create({
      data: {
        institutionId: access.institutionId,
        courseId: access.courseId,
        moduleId,
        lessonId,
        title,
        description:
          typeof body.description === 'string' && body.description.trim()
            ? body.description.trim()
            : null,
        passingScore,
        order,
        status: QuizStatus.DRAFT,
      },
      select: { id: true, title: true, status: true, order: true, passingScore: true },
    });

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.QUIZ_CREATE,
      entityType: 'Quiz',
      entityId: created.id,
      metadata: { courseId: access.courseId, title: created.title },
    });

    return res.status(201).json({ ...created, questionCount: 0, attemptCount: 0 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ message: error.message, field: error.field });
    }
    console.error('[teacher/quizzes:create]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
