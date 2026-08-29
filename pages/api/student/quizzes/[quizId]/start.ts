import type { NextApiRequest, NextApiResponse } from 'next';
import { AttemptStatus } from '@prisma/client';
import { prisma } from '../../../../../lib/prisma';
import { requireAccessibleQuiz } from '../../../../../lib/studentAccess';

/**
 * Ouvre une tentative, ou reprend celle déjà en cours.
 * Idempotent : un étudiant n'accumule pas de tentatives fantômes en
 * rafraîchissant la page.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const access = await requireAccessibleQuiz(req, res, req.query.quizId);
  if (!access) return;

  const existing = await prisma.quizAttempt.findFirst({
    where: { quizId: access.quizId, userId: access.user.id, status: AttemptStatus.IN_PROGRESS },
    select: { id: true, status: true, createdAt: true },
  });

  if (existing) return res.status(200).json(existing);

  const attempt = await prisma.quizAttempt.create({
    data: { quizId: access.quizId, userId: access.user.id, status: AttemptStatus.IN_PROGRESS },
    select: { id: true, status: true, createdAt: true },
  });

  return res.status(201).json(attempt);
}
