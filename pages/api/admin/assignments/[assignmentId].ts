import type { NextApiRequest, NextApiResponse } from 'next'
import { Role, TeacherAssignmentRole } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requireInstitutionRole } from '../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../lib/audit'

/**
 * Retrait ou changement de rôle d'une affectation enseignante.
 *
 * DELETE : l'enseignant n'est plus chargé du cours.
 * PATCH  : `{ "role": "LEAD" | "CO_TEACHER" | "ASSISTANT" }`.
 *
 * ADMIN uniquement. L'identifiant vient du client, l'établissement de la
 * session : l'affectation est revérifiée comme portant sur un cours de cet
 * établissement. Une affectation d'un autre établissement répond 404, comme
 * un identifiant inexistant.
 *
 * Retirer une affectation ne supprime ni l'enseignant ni le cours, ni le
 * contenu qu'il a rédigé : seul le lien disparaît. Le cours retourne alors
 * dans « à affecter », et l'enseignant perd l'accès à son Course Studio.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'DELETE, PATCH')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const { assignmentId } = req.query
  if (typeof assignmentId !== 'string' || !assignmentId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const assignment = await prisma.courseAssignment.findFirst({
    where: {
      id: assignmentId,
      course: { institutionId: scope.institutionId },
    },
    select: {
      id: true,
      role: true,
      userId: true,
      courseId: true,
      user: { select: { email: true } },
      course: { select: { code: true, title: true } },
    },
  })

  if (!assignment) {
    return res.status(404).json({ message: 'Affectation introuvable' })
  }

  if (req.method === 'PATCH') {
    const { role } = (req.body ?? {}) as Record<string, unknown>

    if (
      typeof role !== 'string' ||
      !Object.values(TeacherAssignmentRole).includes(
        role as TeacherAssignmentRole
      )
    ) {
      return res
        .status(400)
        .json({ message: "Rôle d'affectation invalide", field: 'role' })
    }

    if (role === assignment.role) {
      return res.status(200).json({ id: assignment.id, role: assignment.role })
    }

    const updated = await prisma.courseAssignment.update({
      where: { id: assignment.id },
      data: { role: role as TeacherAssignmentRole },
      select: { id: true, role: true },
    })

    await createAuditLog({
      actorUserId: scope.user.id,
      institutionId: scope.institutionId,
      action: AuditAction.ASSIGNMENT_UPDATE,
      entityType: 'CourseAssignment',
      entityId: assignment.id,
      metadata: {
        professorId: assignment.userId,
        courseId: assignment.courseId,
        courseCode: assignment.course.code,
        previousRole: assignment.role,
        role: updated.role,
      },
    })

    return res.status(200).json(updated)
  }

  await prisma.courseAssignment.delete({ where: { id: assignment.id } })

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.ASSIGNMENT_DELETE,
    entityType: 'CourseAssignment',
    entityId: assignment.id,
    metadata: {
      assignmentId: assignment.id,
      professorId: assignment.userId,
      courseId: assignment.courseId,
      courseCode: assignment.course.code,
      role: assignment.role,
    },
  })

  return res.status(200).json({ id: assignment.id, removed: true })
}
