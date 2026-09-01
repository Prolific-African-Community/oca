import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { requireInstitutionRole } from '../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import {
  isStudentOfInstitution,
  reopenEnrollment,
} from '../../../../../lib/studentProgression'

/**
 * Annulation d'une progression :
 * POST /api/admin/students/{id}/reopen-enrollment
 * `{ enrollmentIdToReopen, currentEnrollmentId? }`
 *
 * L'inscription close désignée redevient active ; celle qu'on quitte passe en
 * `WITHDRAWN` — rattachement retiré, et non semestre accompli. Rien n'est
 * supprimé : ni les inscriptions, ni la progression pédagogique.
 *
 * `currentEnrollmentId` est facultatif mais recommandé : il permet de refuser
 * l'opération si l'inscription active a changé depuis l'affichage, plutôt que
 * d'agir sur un état différent de celui que l'administrateur avait sous les
 * yeux.
 *
 * ADMIN uniquement. Étudiant et inscription revérifiés comme appartenant à
 * l'établissement de la session ; sinon 404.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const { studentId } = req.query
  if (typeof studentId !== 'string' || !studentId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  if (!(await isStudentOfInstitution(scope.institutionId, studentId))) {
    return res.status(404).json({ message: 'Étudiant introuvable' })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const enrollmentIdToReopen =
    typeof body.enrollmentIdToReopen === 'string'
      ? body.enrollmentIdToReopen
      : ''
  const currentEnrollmentId =
    typeof body.currentEnrollmentId === 'string'
      ? body.currentEnrollmentId
      : undefined

  if (!enrollmentIdToReopen) {
    return res.status(400).json({
      message: 'Inscription à rouvrir requise',
      field: 'enrollmentIdToReopen',
    })
  }

  try {
    const result = await reopenEnrollment(
      scope.institutionId,
      studentId,
      enrollmentIdToReopen,
      currentEnrollmentId
    )

    if (result.outcome === 'NOT_FOUND') {
      return res.status(404).json({ message: result.message })
    }
    if (result.outcome === 'CONFLICT') {
      return res.status(409).json({ code: 'CONFLICT', ...result })
    }

    if (result.outcome === 'REOPENED') {
      await createAuditLog({
        actorUserId: scope.user.id,
        institutionId: scope.institutionId,
        action: AuditAction.STUDENT_ENROLLMENT_REOPEN,
        entityType: 'Enrollment',
        entityId: result.reopened?.id ?? enrollmentIdToReopen,
        metadata: {
          studentId,
          reopenedEnrollmentId: result.reopened?.id ?? null,
          reopenedSemesterId: result.reopened?.semesterId ?? null,
          previousActiveEnrollmentId: result.closed?.id ?? null,
          previousActiveSemesterId: result.closed?.semesterId ?? null,
          resultingStatus: result.closed?.status ?? null,
        },
      })
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('[admin/students/reopen-enrollment]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
