import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '../../../../../../../lib/prisma'
import { requirePlatformRole } from '../../../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../../../lib/audit'
import {
  findAdminMembership,
  temporaryPassword,
} from '../../../../../../../lib/superadminAdmins'

/**
 * Mot de passe provisoire pour un administrateur d'établissement :
 * POST /api/superadmin/institutions/{institutionId}/admins/{membershipId}/reset-password
 *
 * Le mot de passe est généré ici, haché, puis renvoyé une seule fois. Il
 * n'est stocké nulle part en clair et ne figure jamais dans le journal — le
 * journal retient qu'une réinitialisation a eu lieu, pas ce qu'elle a produit.
 *
 * SUPER_ADMIN uniquement, et seulement pour un administrateur de
 * l'établissement visé.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const actor = await requirePlatformRole(req, res, Role.SUPER_ADMIN)
  if (!actor) return

  const { institutionId, membershipId } = req.query
  if (
    typeof institutionId !== 'string' ||
    !institutionId ||
    typeof membershipId !== 'string' ||
    !membershipId
  ) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true },
  })
  if (!institution) {
    return res.status(404).json({ message: 'Établissement introuvable' })
  }

  const membership = await findAdminMembership(institutionId, membershipId)
  if (!membership) {
    return res
      .status(404)
      .json({ message: 'Administrateur introuvable pour cet établissement' })
  }

  try {
    const password = temporaryPassword()
    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: membership.userId },
      data: { passwordHash },
    })

    await createAuditLog({
      actorUserId: actor.id,
      institutionId,
      action: AuditAction.INSTITUTION_ADMIN_PASSWORD_RESET,
      entityType: 'User',
      entityId: membership.userId,
      // Ni le mot de passe, ni son empreinte.
      metadata: {
        institutionId,
        adminMembershipId: membership.id,
        adminUserId: membership.userId,
        adminEmail: membership.email,
      },
    })

    return res.status(200).json({
      email: membership.email,
      temporaryPassword: password,
    })
  } catch (error) {
    console.error('[superadmin/admins/reset-password]', error)
    return res.status(500).json({ message: 'Réinitialisation impossible' })
  }
}
