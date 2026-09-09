import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { prisma } from '../../../lib/prisma'
import { requireUser } from '../../../lib/serverAuth'
import { clearSessionCookie } from '../../../lib/session'
import { AuditAction, createAuditLog } from '../../../lib/audit'
import { checkNewPassword, minLengthFor } from '../../../lib/passwordPolicy'

/**
 * Changement de mot de passe par la personne elle-même :
 * POST /api/auth/change-password
 * `{ currentPassword, newPassword, confirmPassword }`
 *
 * Trois propriétés tiennent cette route :
 *
 *  - **on ne change que son propre mot de passe.** L'identifiant vient de la
 *    session, jamais du corps de la requête : il n'y a aucun paramètre
 *    permettant de viser quelqu'un d'autre.
 *  - **le mot de passe actuel est exigé.** Un cookie volé ne suffit donc pas
 *    à verrouiller le compte de sa victime.
 *  - **toutes les sessions tombent.** `tokenVersion` est incrémenté, ce qui
 *    invalide immédiatement tous les jetons émis avant — y compris ceux
 *    ouverts sur d'autres appareils. Le cookie courant est effacé dans la
 *    foulée : la personne se reconnecte avec son nouveau mot de passe.
 *
 * Ni l'ancien ni le nouveau mot de passe n'est journalisé, retourné ou
 * conservé ailleurs que dans l'empreinte bcrypt.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const user = await requireUser(req, res)
  if (!user) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const currentPassword = body.currentPassword
  const newPassword = body.newPassword
  const confirmPassword = body.confirmPassword

  if (typeof currentPassword !== 'string' || !currentPassword) {
    return res.status(400).json({
      message: 'Le mot de passe actuel est requis.',
      field: 'currentPassword',
    })
  }

  // Un compte plateforme (SUPER_ADMIN) porte des droits de portée globale :
  // son minimum est plus élevé.
  const isPlatformAccount = user.platformRole !== null

  const check = checkNewPassword(newPassword, confirmPassword, {
    isPlatformAccount,
    currentPassword,
  })
  if (!check.ok) {
    return res.status(400).json({ message: check.message, field: check.field })
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, passwordHash: true, tokenVersion: true },
  })
  if (!account) {
    return res.status(401).json({ message: 'Authentification requise' })
  }

  const matches = await bcrypt.compare(currentPassword, account.passwordHash)
  if (!matches) {
    // Le message ne distingue pas les causes, et l'empreinte n'apparaît nulle part.
    return res.status(400).json({
      message: 'Le mot de passe actuel est incorrect.',
      field: 'currentPassword',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword as string, 10)

    await prisma.user.update({
      where: { id: account.id },
      data: {
        passwordHash,
        // Invalide tous les jetons émis avec la version précédente.
        tokenVersion: { increment: 1 },
      },
    })

    await createAuditLog({
      actorUserId: account.id,
      // Action de compte, pas d'établissement : un SUPER_ADMIN n'en a aucun.
      institutionId: null,
      action: AuditAction.PASSWORD_CHANGED,
      entityType: 'User',
      entityId: account.id,
      metadata: {
        email: user.email,
        platformAccount: isPlatformAccount,
        // Jamais de mot de passe, jamais d'empreinte.
        sessionsInvalidated: true,
      },
    })

    // La session courante est fermée comme les autres : cohérent avec la
    // promesse faite à l'écran, et vérifiable.
    clearSessionCookie(res)

    return res.status(200).json({
      ok: true,
      message:
        'Mot de passe modifié. Toutes vos sessions ont été fermées : reconnectez-vous.',
      minLength: minLengthFor(isPlatformAccount),
    })
  } catch (error) {
    console.error('[auth/change-password]', error)
    return res.status(500).json({ message: 'Changement impossible' })
  }
}
