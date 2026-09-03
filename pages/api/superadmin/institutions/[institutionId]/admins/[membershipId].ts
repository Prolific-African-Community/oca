import type { NextApiRequest, NextApiResponse } from 'next'
import { Role } from '@prisma/client'
import { prisma } from '../../../../../../lib/prisma'
import { requirePlatformRole } from '../../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../../lib/audit'
import {
  countOperationalAdmins,
  findAdminMembership,
} from '../../../../../../lib/superadminAdmins'

/**
 * Accès administrateur d'un établissement :
 * POST /api/superadmin/institutions/{institutionId}/admins/{membershipId}
 * `{ action: 'revoke' | 'restore' }`
 *
 * Une seule route pour les deux sens : c'est le même interrupteur, et les
 * séparer aurait dupliqué les mêmes vérifications d'appartenance.
 *
 * Retirer l'accès **ne supprime rien** : ni le compte, ni l'appartenance, ni
 * les autres rôles de la personne, ni ses autres établissements. Seule
 * `isActive` change, et `serverAuth` cesse de charger l'appartenance.
 *
 * Le dernier administrateur actif ne peut pas être retiré : l'établissement
 * deviendrait impilotable.
 *
 * SUPER_ADMIN uniquement. Le rôle n'est jamais lu depuis le client — cette
 * route ne connaît que les appartenances ADMIN.
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

  const action = (req.body ?? {}).action
  if (action !== 'revoke' && action !== 'restore') {
    return res.status(400).json({
      message: 'Action inconnue',
      field: 'action',
    })
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, name: true },
  })
  if (!institution) {
    return res.status(404).json({ message: 'Établissement introuvable' })
  }

  // L'appartenance doit relever de cet établissement : une appartenance
  // d'ailleurs est introuvable, pas interdite.
  const membership = await findAdminMembership(institutionId, membershipId)
  if (!membership) {
    return res
      .status(404)
      .json({ message: 'Administrateur introuvable pour cet établissement' })
  }

  if (action === 'revoke') {
    if (!membership.isActive) {
      return res.status(200).json({
        outcome: 'UNCHANGED',
        message: `L’accès administrateur de ${membership.email} avait déjà été retiré.`,
      })
    }

    // Garde-fou : ne jamais produire un établissement que personne ne peut
    // ouvrir. C'est refusé côté serveur, pas seulement masqué à l'écran.
    if ((await countOperationalAdmins(institutionId)) <= 1) {
      return res.status(409).json({
        code: 'LAST_ADMIN',
        message:
          'Cette université doit conserver au moins un administrateur actif. Rattachez-en un autre avant de retirer celui-ci.',
      })
    }

    await prisma.institutionUser.update({
      where: { id: membership.id },
      data: { isActive: false },
    })

    await createAuditLog({
      actorUserId: actor.id,
      institutionId,
      action: AuditAction.INSTITUTION_ADMIN_REVOKE,
      entityType: 'InstitutionUser',
      entityId: membership.id,
      metadata: {
        institutionId,
        adminMembershipId: membership.id,
        adminUserId: membership.userId,
        adminEmail: membership.email,
      },
    })

    return res.status(200).json({
      outcome: 'REVOKED',
      message: `L’accès administrateur de ${membership.email} a été retiré.`,
    })
  }

  if (membership.isActive) {
    return res.status(200).json({
      outcome: 'UNCHANGED',
      message: `${membership.email} est déjà administrateur actif.`,
    })
  }

  await prisma.institutionUser.update({
    where: { id: membership.id },
    data: { isActive: true },
  })

  await createAuditLog({
    actorUserId: actor.id,
    institutionId,
    action: AuditAction.INSTITUTION_ADMIN_RESTORE,
    entityType: 'InstitutionUser',
    entityId: membership.id,
    metadata: {
      institutionId,
      adminMembershipId: membership.id,
      adminUserId: membership.userId,
      adminEmail: membership.email,
    },
  })

  return res.status(200).json({
    outcome: 'RESTORED',
    // Le compte lui-même peut rester désactivé : le dire plutôt que de
    // laisser croire que l'accès est rétabli.
    message: membership.accountActive
      ? `L’accès administrateur de ${membership.email} a été rétabli.`
      : `L’accès administrateur de ${membership.email} a été rétabli, mais son compte est désactivé : il ne pourra pas se connecter.`,
    accountInactive: !membership.accountActive,
  })
}
