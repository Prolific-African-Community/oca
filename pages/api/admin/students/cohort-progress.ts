import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { requireInstitutionRole } from '../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../lib/audit'
import {
  cohortStudents,
  progressStudent,
  resolveTargetSemester,
} from '../../../../lib/studentProgression'
import type { ProgressionResult } from '../../../../lib/studentProgression'

/**
 * Progression d'une cohorte entière :
 * POST /api/admin/students/cohort-progress
 *
 * Une cohorte n'est pas un objet du schéma : c'est l'ensemble des étudiants
 * dont l'inscription **active** porte sur un programme et un semestre donnés.
 * La route les retrouve donc par ce couple, jamais par une liste fournie par
 * le client — sauf si l'appelant restreint explicitement à un sous-ensemble,
 * qui est alors intersecté avec la cohorte réelle.
 *
 * Chaque étudiant est traité individuellement, dans sa propre transaction :
 * un échec sur l'un n'annule pas les précédents, et **chaque cas est
 * rapporté**. Un traitement de masse qui avale ses erreurs est pire que pas
 * de traitement de masse du tout.
 *
 * ADMIN uniquement. Source et cible sont revérifiées comme appartenant à
 * l'établissement de la session.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const text = (key: string) =>
    typeof body[key] === 'string' ? (body[key] as string) : ''

  const sourceProgramId = text('sourceProgramId')
  const sourceSemesterId = text('sourceSemesterId')
  const targetProgramId = text('targetProgramId')
  const targetSemesterId = text('targetSemesterId')
  const targetAcademicYearId = text('targetAcademicYearId') || undefined

  if (!sourceProgramId || !sourceSemesterId) {
    return res.status(400).json({ message: 'Cohorte de départ requise' })
  }
  if (!targetProgramId || !targetSemesterId) {
    return res
      .status(400)
      .json({ message: 'Programme et semestre cibles requis' })
  }

  const source = await resolveTargetSemester(scope.institutionId, {
    programId: sourceProgramId,
    semesterId: sourceSemesterId,
  })
  if (!source) {
    return res
      .status(404)
      .json({ message: 'Cohorte de départ inconnue pour cet établissement' })
  }

  const target = await resolveTargetSemester(scope.institutionId, {
    programId: targetProgramId,
    academicYearId: targetAcademicYearId,
    semesterId: targetSemesterId,
  })
  if (!target) {
    return res.status(404).json({
      message:
        'Programme, année ou semestre cible inconnu pour cet établissement, ou incohérents entre eux.',
    })
  }

  if (source.id === target.id) {
    return res.status(400).json({
      message: 'La cohorte de départ et la cohorte cible sont identiques.',
    })
  }

  const members = await cohortStudents(scope.institutionId, {
    programId: source.programId,
    semesterId: source.id,
  })

  // Sous-ensemble éventuel, intersecté avec la cohorte réelle : le client ne
  // peut pas faire progresser un étudiant qui n'en fait pas partie.
  const requested = Array.isArray(body.studentIds)
    ? new Set(
        (body.studentIds as unknown[]).filter(
          (value): value is string => typeof value === 'string'
        )
      )
    : null

  const selected = requested
    ? members.filter((m) => requested.has(m.userId))
    : members

  if (selected.length === 0) {
    return res.status(400).json({
      message: 'Aucun étudiant actif dans cette cohorte.',
      results: [],
    })
  }

  const results: ProgressionResult[] = []

  for (const member of selected) {
    try {
      results.push(
        await progressStudent(scope.institutionId, member.userId, target)
      )
    } catch (error) {
      console.error('[admin/students/cohort-progress]', error)
      results.push({
        studentId: member.userId,
        outcome: 'CONFLICT',
        message: 'Erreur serveur pour cet étudiant.',
      })
    }
  }

  const counts = {
    progressed: results.filter((r) => r.outcome === 'PROGRESSED').length,
    enrolled: results.filter((r) => r.outcome === 'ENROLLED').length,
    unchanged: results.filter((r) => r.outcome === 'UNCHANGED').length,
    failed: results.filter(
      (r) => r.outcome === 'CONFLICT' || r.outcome === 'NOT_FOUND'
    ).length,
  }

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.STUDENT_COHORT_PROGRESS,
    entityType: 'Semester',
    entityId: target.id,
    metadata: {
      sourceProgramId: source.programId,
      sourceSemesterId: source.id,
      targetProgramId: target.programId,
      targetSemesterId: target.id,
      targetSemester: target.name,
      ...counts,
      // Identifiants des cas non traités : de quoi les retrouver, rien de plus.
      failedStudentIds: results
        .filter((r) => r.outcome === 'CONFLICT' || r.outcome === 'NOT_FOUND')
        .map((r) => r.studentId),
    },
  })

  // Le détail par étudiant reste dans la réponse, jamais dans le journal :
  // l'écran doit pouvoir dire précisément qui n'est pas passé, et pourquoi.
  const byId = new Map(members.map((m) => [m.userId, m.user]))

  return res.status(200).json({
    counts,
    total: selected.length,
    results: results.map((result) => ({
      ...result,
      name:
        [byId.get(result.studentId)?.firstName, byId.get(result.studentId)?.lastName]
          .filter(Boolean)
          .join(' ') || byId.get(result.studentId)?.email,
      email: byId.get(result.studentId)?.email,
    })),
  })
}
