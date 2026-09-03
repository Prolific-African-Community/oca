import { Role } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Gestion de l'accès administrateur d'un établissement, côté super admin.
 *
 * Deux principes tiennent tout ce module :
 *
 *  - **rien n'est supprimé.** Retirer l'accès désactive l'appartenance
 *    (`InstitutionUser.isActive = false`) ; le compte, ses autres rôles et
 *    ses autres établissements sont intacts. `safeUserSelect` de
 *    `serverAuth` ne charge que les appartenances actives : la révocation
 *    retire donc réellement l'accès, elle ne fait pas que l'afficher.
 *
 *  - **un établissement ne doit jamais devenir impilotable.** Retirer le
 *    dernier administrateur actif produirait exactement l'anomalie que le
 *    cockpit signale comme « Sans admin », et que seul le super admin peut
 *    réparer. C'est refusé ici, pas seulement caché dans l'écran.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Mot de passe provisoire, généré côté serveur et affiché une seule fois. */
export function temporaryPassword(): string {
  return Array.from({ length: 12 }, () =>
    ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  ).join('')
}

export interface AdminMembership {
  id: string
  isActive: boolean
  userId: string
  email: string
  name: string | null
  accountActive: boolean
}

/**
 * Retrouve une appartenance ADMIN **de cet établissement**.
 *
 * Le filtre porte à la fois sur l'identifiant, l'établissement et le rôle :
 * une appartenance d'un autre établissement, ou d'un autre rôle, est
 * introuvable plutôt qu'interdite — pas d'oracle d'existence.
 */
export async function findAdminMembership(
  institutionId: string,
  membershipId: string
): Promise<AdminMembership | null> {
  const membership = await prisma.institutionUser.findFirst({
    where: { id: membershipId, institutionId, role: Role.ADMIN },
    select: {
      id: true,
      isActive: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      },
    },
  })

  if (!membership) return null

  return {
    id: membership.id,
    isActive: membership.isActive,
    userId: membership.user.id,
    email: membership.user.email,
    name:
      [membership.user.firstName, membership.user.lastName]
        .filter(Boolean)
        .join(' ') || null,
    accountActive: membership.user.isActive,
  }
}

/** Nombre d'administrateurs encore capables d'ouvrir l'établissement. */
export async function countOperationalAdmins(
  institutionId: string
): Promise<number> {
  return prisma.institutionUser.count({
    where: {
      institutionId,
      role: Role.ADMIN,
      isActive: true,
      // Un compte désactivé ne se connecte nulle part : il ne compte pas
      // comme administrateur opérationnel.
      user: { isActive: true },
    },
  })
}
