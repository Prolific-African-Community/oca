import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role, InstitutionStatus } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { requirePlatformRole } from '../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../lib/audit'

/**
 * Création d'un établissement et de son administrateur principal.
 *
 * Deux principes gouvernent cette route :
 *
 *  - le mot de passe provisoire est **généré côté serveur** et renvoyé une
 *    seule fois. Il n'est jamais saisi par l'appelant, jamais stocké en clair,
 *    jamais journalisé — le journal retient seulement qu'un compte a été créé ;
 *  - un établissement sans administrateur ne peut pas être exploité. Les deux
 *    sont donc créés dans la **même transaction** : pas d'université orpheline
 *    si la création du compte échoue.
 *
 * Une adresse déjà connue n'est jamais rattachée en silence : il faut le
 * demander explicitement (`attachExisting`), et le mot de passe du compte
 * existant reste inchangé.
 *
 * SUPER_ADMIN uniquement.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function temporaryPassword(): string {
  return Array.from({ length: 12 }, () =>
    ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  ).join('')
}

/** Slug lisible et stable, dérivé du nom. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
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

  const user = await requirePlatformRole(req, res, Role.SUPER_ADMIN)
  if (!user) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const text = (key: string) =>
    typeof body[key] === 'string' ? (body[key] as string).trim() : ''

  const name = text('name')
  const country = text('country')
  const adminFirstName = text('adminFirstName')
  const adminLastName = text('adminLastName')
  const email = text('adminEmail').toLowerCase()
  const attachExisting = body.attachExisting === true

  if (!name) {
    return res
      .status(400)
      .json({ message: 'Le nom de l’université est requis', field: 'name' })
  }
  if (!email || !EMAIL.test(email)) {
    return res.status(400).json({
      message: 'Une adresse email valide est requise pour l’administrateur',
      field: 'adminEmail',
    })
  }

  // Le slug proposé est normalisé : il sert d'identifiant d'URL, il ne peut
  // pas contenir n'importe quoi. À défaut, il est dérivé du nom.
  const slug = slugify(text('slug') || name)
  if (!slug) {
    return res.status(400).json({
      message:
        'L’identifiant ne peut pas être déduit de ce nom. Saisissez-en un.',
      field: 'slug',
    })
  }

  const slugTaken = await prisma.institution.findUnique({
    where: { slug },
    select: { id: true, name: true },
  })
  if (slugTaken) {
    return res.status(409).json({
      code: 'SLUG_TAKEN',
      message: `L’identifiant « ${slug} » est déjà utilisé par ${slugTaken.name}. Choisissez-en un autre.`,
      field: 'slug',
    })
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, lastName: true },
  })

  // Rattacher un compte existant est possible, mais jamais implicite : le
  // super administrateur doit confirmer, car cela donne à cette personne les
  // pleins droits sur un nouvel établissement.
  if (existingUser && !attachExisting) {
    return res.status(409).json({
      code: 'EMAIL_EXISTS',
      message:
        'Cette adresse correspond déjà à un compte. Confirmez pour en faire l’administrateur de cette université — son mot de passe ne sera pas modifié.',
      field: 'adminEmail',
    })
  }

  const password = existingUser ? null : temporaryPassword()
  const passwordHash = password ? await bcrypt.hash(password, 10) : null

  try {
    const created = await prisma.$transaction(async (tx) => {
      const institution = await tx.institution.create({
        data: {
          name,
          slug,
          country: country || null,
          status: InstitutionStatus.ACTIVE,
        },
      })

      const admin = existingUser
        ? existingUser
        : await tx.user.create({
            data: {
              email,
              passwordHash: passwordHash as string,
              firstName: adminFirstName || null,
              lastName: adminLastName || null,
            },
            select: { id: true, firstName: true, lastName: true },
          })

      await tx.institutionUser.create({
        data: {
          userId: admin.id,
          institutionId: institution.id,
          role: Role.ADMIN,
        },
      })

      return { institution, adminId: admin.id }
    })

    await createAuditLog({
      actorUserId: user.id,
      institutionId: created.institution.id,
      action: AuditAction.INSTITUTION_CREATE,
      entityType: 'Institution',
      entityId: created.institution.id,
      // L'email identifie l'administrateur ; le mot de passe provisoire, lui,
      // ne figure nulle part.
      metadata: {
        name: created.institution.name,
        slug: created.institution.slug,
        adminEmail: email,
        adminExisted: Boolean(existingUser),
      },
    })

    return res.status(201).json({
      id: created.institution.id,
      name: created.institution.name,
      slug: created.institution.slug,
      status: 'active',
      adminEmail: email,
      adminExisted: Boolean(existingUser),
      // Renvoyé une seule fois, et seulement si le compte vient d'être créé.
      temporaryPassword: password,
    })
  } catch (error) {
    console.error('[universities/create]', error)
    return res.status(500).json({ message: 'Création impossible' })
  }
}
