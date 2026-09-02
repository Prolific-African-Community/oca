import type { NextApiRequest, NextApiResponse } from 'next'
import { EnrollmentStatus, Prisma, Role } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requireInstitutionRole } from '../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../lib/audit'

/**
 * Correction d'un compte étudiant.
 *
 * `PATCH { firstName?, lastName?, email? }` corrige l'identité.
 * `PATCH { isActive: boolean }` retire ou rétablit l'accès.
 * `PATCH { enrollment: { programId, semesterId } }` corrige le rattachement.
 *
 * Deux précisions qui déterminent la conception.
 *
 * L'accès : c'est l'**appartenance à l'établissement** (`InstitutionUser
 * .isActive`) qui bascule, pas le compte. `lib/serverAuth` ne charge que les
 * appartenances actives, donc l'étudiant perd réellement l'accès à cet
 * établissement, sans que son compte soit bloqué ailleurs. Inscriptions et
 * progression sont conservées.
 *
 * Le rattachement : les cours visibles sont ceux des semestres où l'étudiant
 * a une inscription **ACTIVE**. Corriger le semestre change donc ce qu'il
 * voit — l'interface l'annonce avant d'agir. L'inscription active est
 * déplacée sur place plutôt que dupliquée : le schéma impose une inscription
 * unique par étudiant et par semestre, et deux inscriptions actives
 * cumuleraient silencieusement les cours de deux semestres.
 *
 * ADMIN uniquement. Un étudiant d'un autre établissement répond 404.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const { studentId } = req.query
  if (typeof studentId !== 'string' || !studentId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const membership = await prisma.institutionUser.findFirst({
    where: {
      userId: studentId,
      institutionId: scope.institutionId,
      role: Role.STUDENT,
    },
    select: {
      id: true,
      isActive: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  })

  if (!membership) {
    return res.status(404).json({ message: 'Étudiant introuvable' })
  }

  const body = (req.body ?? {}) as Record<string, unknown>

  /* ------------------------------------------------- accès à l'établissement */

  if (typeof body.isActive === 'boolean') {
    if (body.isActive === membership.isActive) {
      return res
        .status(200)
        .json({ id: membership.user.id, isActive: membership.isActive })
    }

    await prisma.institutionUser.update({
      where: { id: membership.id },
      data: { isActive: body.isActive },
    })

    await createAuditLog({
      actorUserId: scope.user.id,
      institutionId: scope.institutionId,
      action: body.isActive
        ? AuditAction.STUDENT_REACTIVATE
        : AuditAction.STUDENT_DEACTIVATE,
      entityType: 'User',
      entityId: membership.user.id,
      metadata: {
        studentId: membership.user.id,
        studentEmail: membership.user.email,
        isActive: body.isActive,
      },
    })

    return res
      .status(200)
      .json({ id: membership.user.id, isActive: body.isActive })
  }

  /* --------------------------------------------------------- rattachement */

  if (body.enrollment && typeof body.enrollment === 'object') {
    const target = body.enrollment as Record<string, unknown>
    const programId = typeof target.programId === 'string' ? target.programId : ''
    const semesterId =
      typeof target.semesterId === 'string' ? target.semesterId : ''

    if (!programId || !semesterId) {
      return res
        .status(400)
        .json({ message: 'Programme et semestre requis', field: 'semesterId' })
    }

    // Une seule requête verrouille les trois conditions : le semestre existe,
    // appartient au programme, et le programme à l'établissement de la session.
    const semester = await prisma.semester.findFirst({
      where: {
        id: semesterId,
        programId,
        program: { institutionId: scope.institutionId },
      },
      select: { id: true, name: true, programId: true },
    })

    if (!semester) {
      return res.status(400).json({
        message: 'Programme ou semestre inconnu pour cet établissement',
        field: 'semesterId',
      })
    }

    const active = await prisma.enrollment.findFirst({
      where: {
        userId: membership.user.id,
        institutionId: scope.institutionId,
        status: EnrollmentStatus.ACTIVE,
      },
      select: { id: true, programId: true, semesterId: true },
    })

    if (active && active.semesterId === semester.id) {
      return res.status(200).json({ id: active.id, unchanged: true })
    }

    try {
      if (active) {
        const updated = await prisma.enrollment.update({
          where: { id: active.id },
          data: { programId: semester.programId, semesterId: semester.id },
          select: { id: true, programId: true, semesterId: true },
        })

        await createAuditLog({
          actorUserId: scope.user.id,
          institutionId: scope.institutionId,
          action: AuditAction.STUDENT_ENROLLMENT_UPDATE,
          entityType: 'Enrollment',
          entityId: updated.id,
          metadata: {
            studentId: membership.user.id,
            previousSemesterId: active.semesterId,
            programId: updated.programId,
            semesterId: updated.semesterId,
            semester: semester.name,
          },
        })

        return res.status(200).json(updated)
      }

      const created = await prisma.enrollment.create({
        data: {
          institutionId: scope.institutionId,
          userId: membership.user.id,
          programId: semester.programId,
          semesterId: semester.id,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true, programId: true, semesterId: true },
      })

      await createAuditLog({
        actorUserId: scope.user.id,
        institutionId: scope.institutionId,
        action: AuditAction.STUDENT_ENROLLMENT_CREATE,
        entityType: 'Enrollment',
        entityId: created.id,
        metadata: {
          studentId: membership.user.id,
          programId: created.programId,
          semesterId: created.semesterId,
          semester: semester.name,
        },
      })

      return res.status(201).json(created)
    } catch (error) {
      // @@unique([userId, semesterId]) : une inscription close existe déjà
      // sur ce semestre. Mieux vaut le dire que d'écraser en silence.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return res.status(409).json({
          message:
            'Cet étudiant a déjà une inscription sur ce semestre. Choisissez un autre semestre.',
          field: 'semesterId',
        })
      }
      console.error('[admin/students/enrollment]', error)
      return res.status(500).json({ message: 'Erreur serveur' })
    }
  }

  /* -------------------------------------------------------------- identité */

  const data: { firstName?: string; lastName?: string; email?: string } = {}

  if ('firstName' in body) {
    const value = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    if (!value) {
      return res
        .status(400)
        .json({ message: 'Renseignez le prénom', field: 'firstName' })
    }
    data.firstName = value
  }

  if ('lastName' in body) {
    const value = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    if (!value) {
      return res
        .status(400)
        .json({ message: 'Renseignez le nom', field: 'lastName' })
    }
    data.lastName = value
  }

  if ('email' in body) {
    const value =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!EMAIL.test(value)) {
      return res
        .status(400)
        .json({ message: 'Adresse email invalide', field: 'email' })
    }

    if (value !== membership.user.email) {
      // L'adresse est l'identifiant de connexion : unique sur la plateforme.
      const taken = await prisma.user.findUnique({
        where: { email: value },
        select: { id: true },
      })
      if (taken) {
        return res.status(409).json({
          message: 'Cette adresse email est déjà utilisée',
          field: 'email',
        })
      }
      data.email = value
    }
  }

  const fields = Object.keys(data)
  if (fields.length === 0) {
    return res.status(400).json({ message: 'Aucune modification fournie' })
  }

  const updated = await prisma.user.update({
    where: { id: membership.user.id },
    data,
    select: { id: true, email: true, firstName: true, lastName: true },
  })

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.STUDENT_UPDATE,
    entityType: 'User',
    entityId: updated.id,
    // Les champs touchés, jamais leur contenu.
    metadata: { studentId: updated.id, fields },
  })

  return res.status(200).json({ ...updated, isActive: membership.isActive })
}
