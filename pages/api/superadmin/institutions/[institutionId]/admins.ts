import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requirePlatformRole } from '../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'

/**
 * Rattachement d'un administrateur à un établissement existant.
 *
 * C'est l'action de dépannage du super administrateur : un établissement sans
 * administrateur actif ne peut être ouvert par personne, et rien d'autre dans
 * l'application ne permet de le réparer.
 *
 * Quatre situations, traitées différemment :
 *
 *  - **adresse inconnue** → compte créé, mot de passe provisoire généré côté
 *    serveur et renvoyé une seule fois ;
 *  - **compte existant** → rattaché seulement sur confirmation explicite
 *    (`attachExisting`). Son mot de passe n'est jamais touché, et aucun mot de
 *    passe n'est renvoyé ;
 *  - **déjà administrateur actif** → aucune modification, message clair ;
 *  - **administrateur dont l'accès avait été retiré** → l'appartenance est
 *    réactivée plutôt que recréée, la contrainte d'unicité portant sur
 *    (utilisateur, établissement, rôle).
 *
 * Un professeur ou un étudiant peut devenir administrateur sans perdre son
 * rôle actuel : le modèle autorise plusieurs appartenances par établissement.
 *
 * SUPER_ADMIN uniquement. Le rôle n'est jamais lu depuis le client : cette
 * route ne sait créer qu'un ADMIN.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function temporaryPassword(): string {
  return Array.from({ length: 12 }, () =>
    ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  ).join('')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  const { institutionId } = req.query
  if (typeof institutionId !== 'string' || !institutionId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: { id: true, name: true },
  })
  if (!institution) {
    return res.status(404).json({ message: 'Établissement introuvable' })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const text = (key: string) =>
    typeof body[key] === 'string' ? (body[key] as string).trim() : ''

  const email = text('email').toLowerCase()
  const firstName = text('firstName')
  const lastName = text('lastName')
  const attachExisting = body.attachExisting === true

  if (!email || !EMAIL.test(email)) {
    return res
      .status(400)
      .json({ message: 'Une adresse email valide est requise', field: 'email' })
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isActive: true },
  })

  // Un nom est exigé à la création seulement : pour un compte existant, il
  // serait présomptueux de le renommer au passage.
  if (!existing && (!firstName || !lastName)) {
    return res.status(400).json({
      message: 'Le prénom et le nom sont requis pour créer un compte',
      field: !firstName ? 'firstName' : 'lastName',
    })
  }

  if (existing) {
    const membership = await prisma.institutionUser.findUnique({
      where: {
        userId_institutionId_role: {
          userId: existing.id,
          institutionId,
          role: Role.ADMIN,
        },
      },
      select: { id: true, isActive: true },
    })

    if (membership?.isActive) {
      return res.status(200).json({
        outcome: 'UNCHANGED',
        message: `${email} est déjà administrateur de ${institution.name}.`,
        adminEmail: email,
      })
    }

    if (!attachExisting) {
      return res.status(409).json({
        code: 'USER_EXISTS',
        message: membership
          ? 'Cet utilisateur a déjà été administrateur de cette université, mais son accès a été retiré. Le rétablir ?'
          : 'Cet utilisateur existe déjà. Le rattacher comme administrateur de cette université ?',
        field: 'email',
      })
    }

    // Réactivation ou création de l'appartenance ADMIN. Le mot de passe du
    // compte n'est pas touché, et aucun n'est renvoyé.
    await prisma.$transaction(async (tx) => {
      if (membership) {
        await tx.institutionUser.update({
          where: { id: membership.id },
          data: { isActive: true },
        })
      } else {
        await tx.institutionUser.create({
          data: { userId: existing.id, institutionId, role: Role.ADMIN },
        })
      }
    })

    await createAuditLog({
      actorUserId: actor.id,
      institutionId,
      action: AuditAction.INSTITUTION_ADMIN_ATTACH,
      entityType: 'InstitutionUser',
      entityId: existing.id,
      metadata: {
        institutionId,
        adminEmail: email,
        adminExisted: true,
        reactivated: Boolean(membership),
      },
    })

    return res.status(200).json({
      outcome: membership ? 'REACTIVATED' : 'ATTACHED',
      message: membership
        ? `L’accès administrateur de ${email} a été rétabli.`
        : `${email} est désormais administrateur de ${institution.name}.`,
      adminEmail: email,
      adminExisted: true,
      accountInactive: !existing.isActive,
      temporaryPassword: null,
    })
  }

  // Adresse inconnue : compte créé, avec un mot de passe provisoire généré
  // ici et affiché une seule fois. Il n'est stocké nulle part en clair.
  const password = temporaryPassword()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    const created = await prisma.$transaction(async (tx) => {
      const admin = await tx.user.create({
        data: { email, passwordHash, firstName, lastName },
        select: { id: true },
      })

      await tx.institutionUser.create({
        data: { userId: admin.id, institutionId, role: Role.ADMIN },
      })

      return admin
    })

    await createAuditLog({
      actorUserId: actor.id,
      institutionId,
      action: AuditAction.INSTITUTION_ADMIN_CREATE,
      entityType: 'InstitutionUser',
      entityId: created.id,
      // Le mot de passe provisoire ne figure nulle part dans le journal.
      metadata: { institutionId, adminEmail: email, adminExisted: false },
    })

    return res.status(201).json({
      outcome: 'CREATED',
      message: `${email} est désormais administrateur de ${institution.name}.`,
      adminEmail: email,
      adminExisted: false,
      temporaryPassword: password,
    })
  } catch (error) {
    console.error('[superadmin/institutions/admins]', error)
    return res.status(500).json({ message: 'Rattachement impossible' })
  }
}
