import type { NextApiRequest, NextApiResponse } from 'next'
import { QuizStatus } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedQuiz } from '../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'

/**
 * Publie un quiz, ou le repasse en brouillon avec `{ published: false }`.
 * Un quiz sans question reste refusé : il n'aurait aucun sens côté étudiant.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedQuiz(req, res, req.query.quizId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const publish = body.published === undefined ? true : body.published === true

  if (publish) {
    const questionCount = await prisma.quizQuestion.count({
      where: { quizId: access.quizId },
    })

    if (questionCount === 0) {
      return res.status(400).json({
        message: 'Ajoutez au moins une question avant de publier',
        field: 'status',
      })
    }
  }

  const updated = await prisma.quiz.update({
    where: { id: access.quizId },
    data: { status: publish ? QuizStatus.PUBLISHED : QuizStatus.DRAFT },
    select: { id: true, title: true, status: true },
  })

  await createAuditLog({
    actorUserId: access.user.id,
    institutionId: access.institutionId,
    action: AuditAction.QUIZ_PUBLISH,
    entityType: 'Quiz',
    entityId: updated.id,
    metadata: { courseId: access.courseId, status: updated.status },
  })

  return res.status(200).json(updated)
}
