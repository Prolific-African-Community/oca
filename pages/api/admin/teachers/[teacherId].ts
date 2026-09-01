import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requireInstitutionRole } from '../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../lib/audit'

/**
 * Correction et activation d'un compte enseignant.
 *
 * `PATCH { firstName?, lastName?, email? }` corrige l'identité.
 * `PATCH { isActive: boolean }` désactive ou réactive l'accès.
 *
 * Sur la désactivation, une précision qui compte : c'est l'**appartenance à
 * l'établissement** (`InstitutionUser.isActive`) qui est basculée, pas le
 * compte utilisateur. `lib/serverAuth` ne charge que les appartenances
 * actives : l'enseignant perd donc réellement l'accès à son espace, sans que
 * son compte soit bloqué dans un autre établissement. Ses affectations et son
 * contenu sont conservés.
 *
 * ADMIN uniquement. L'établissement vient de la session ; un enseignant d'un
 * autre établissement répond 404, comme un identifiant inexistant.
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

  const { teacherId } = req.query
  if (typeof teacherId !== 'string' || !teacherId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const membership = await prisma.institutionUser.findFirst({
    where: {
      userId: teacherId,
      institutionId: scope.institutionId,
      role: Role.PROFESSOR,
    },
    select: {
      id: true,
      isActive: true,
      user: { select: { id: true, email: true, firstName: true, lastName: true } },
    },
  })

  if (!membership) {
    return res.status(404).json({ message: 'Enseignant introuvable' })
  }

  const body = (req.body ?? {}) as Record<string, unknown>

  /* ------------------------------------------------ activation / retrait */

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
        ? AuditAction.TEACHER_REACTIVATE
        : AuditAction.TEACHER_DEACTIVATE,
      entityType: 'User',
      entityId: membership.user.id,
      metadata: {
        teacherId: membership.user.id,
        teacherEmail: membership.user.email,
        isActive: body.isActive,
      },
    })

    return res.status(200).json({ id: membership.user.id, isActive: body.isActive })
  }

  /* ------------------------------------------------------- identité */

  const data: { firstName?: string; lastName?: string; email?: string } = {}

  if ('firstName' in body) {
    const value = typeof body.firstName === 'string' ? body.firstName.trim() : ''
    if (!value) {
      return res.status(400).json({ message: 'Renseignez le prénom', field: 'firstName' })
    }
    data.firstName = value
  }

  if ('lastName' in body) {
    const value = typeof body.lastName === 'string' ? body.lastName.trim() : ''
    if (!value) {
      return res.status(400).json({ message: 'Renseignez le nom', field: 'lastName' })
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
      // L'adresse est l'identifiant de connexion : elle est unique globalement.
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
    action: AuditAction.TEACHER_UPDATE,
    entityType: 'User',
    entityId: updated.id,
    // Les champs touchés, pas leur contenu.
    metadata: { teacherId: updated.id, fields },
  })

  return res.status(200).json({ ...updated, isActive: membership.isActive })
}
