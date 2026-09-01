import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { requireInstitutionRole } from '../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'
import {
  isStudentOfInstitution,
  progressStudent,
  resolveTargetSemester,
} from '../../../../../lib/studentProgression'

/**
 * Progression académique d'un étudiant :
 * POST /api/admin/students/{id}/progression
 * `{ programId, academicYearId?, semesterId }`
 *
 * L'inscription active est **close**, pas écrasée : une nouvelle inscription
 * active est créée sur le semestre visé. Le parcours reste donc lisible d'une
 * période à l'autre — c'est ce qui distingue cette route de la correction de
 * rattachement, qui déplace l'inscription sur place.
 *
 * ADMIN uniquement. Étudiant, programme et semestre sont revérifiés comme
 * appartenant à l'établissement de la session ; sinon 404.
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
  const programId = typeof body.programId === 'string' ? body.programId : ''
  const semesterId = typeof body.semesterId === 'string' ? body.semesterId : ''
  const academicYearId =
    typeof body.academicYearId === 'string' ? body.academicYearId : undefined

  if (!programId || !semesterId) {
    return res
      .status(400)
      .json({ message: 'Programme et semestre requis', field: 'semesterId' })
  }

  const target = await resolveTargetSemester(scope.institutionId, {
    programId,
    academicYearId,
    semesterId,
  })

  if (!target) {
    return res.status(404).json({
      message:
        'Programme, année ou semestre inconnu pour cet établissement, ou incohérents entre eux.',
      field: 'semesterId',
    })
  }

  try {
    const result = await progressStudent(scope.institutionId, studentId, target)

    if (result.outcome === 'CONFLICT') {
      return res.status(409).json({ code: 'CONFLICT', ...result })
    }

    if (result.outcome !== 'UNCHANGED') {
      await createAuditLog({
        actorUserId: scope.user.id,
        institutionId: scope.institutionId,
        action: AuditAction.STUDENT_ENROLLMENT_PROGRESS,
        entityType: 'Enrollment',
        entityId: result.next?.id ?? studentId,
        metadata: {
          studentId,
          programId: target.programId,
          previousSemesterId: result.previous?.semesterId ?? null,
          previousStatus: result.previous ? 'COMPLETED' : null,
          targetSemesterId: target.id,
          targetSemester: target.name,
          newStatus: 'ACTIVE',
        },
      })
    }

    return res.status(200).json(result)
  } catch (error) {
    console.error('[admin/students/progression]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  }
}
