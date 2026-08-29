import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role, InstitutionStatus } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { requirePlatformRole } from '../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../lib/audit'

/** Slug lisible et stable, dérivé du nom, unicité garantie par suffixe. */
function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

async function uniqueSlug(base: string): Promise<string> {
  const root = base || 'etablissement'
  let candidate = root
  let n = 2

  while (
    await prisma.institution.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
  ) {
    candidate = `${root}-${n++}`
  }

  return candidate
}

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

  const { name, adminEmail, adminPassword, country } = (req.body ??
    {}) as Record<string, unknown>

  if (
    typeof name !== 'string' ||
    typeof adminEmail !== 'string' ||
    typeof adminPassword !== 'string' ||
    !name.trim() ||
    !adminEmail.trim() ||
    !adminPassword
  ) {
    return res
      .status(400)
      .json({ message: 'Nom, email et mot de passe administrateur requis' })
  }

  if (adminPassword.length < 8) {
    return res
      .status(400)
      .json({ message: 'Le mot de passe doit faire au moins 8 caractères' })
  }

  const email = adminEmail.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existing) {
    return res
      .status(409)
      .json({ message: 'Cette adresse email est déjà utilisée' })
  }

  const slug = await uniqueSlug(slugify(name))
  const passwordHash = await bcrypt.hash(adminPassword, 10)

  // Établissement + compte administrateur + appartenance, en une transaction :
  // pas d'université orpheline si la création du compte échoue.
  const institution = await prisma.$transaction(async (tx) => {
    const created = await tx.institution.create({
      data: {
        name: name.trim(),
        slug,
        country:
          typeof country === 'string' && country.trim() ? country.trim() : null,
        status: InstitutionStatus.ACTIVE,
      },
    })

    const admin = await tx.user.create({
      data: { email, passwordHash },
    })

    await tx.institutionUser.create({
      data: {
        userId: admin.id,
        institutionId: created.id,
        role: Role.ADMIN,
      },
    })

    return created
  })

  await createAuditLog({
    actorUserId: user.id,
    institutionId: institution.id,
    action: AuditAction.INSTITUTION_CREATE,
    entityType: 'Institution',
    entityId: institution.id,
    metadata: {
      name: institution.name,
      slug: institution.slug,
      adminEmail: email,
    },
  })

  // Les champs `programs` / `courses` envoyés par le tiroir de l'écran actuel
  // sont des libellés statiques, sans correspondance dans le référentiel :
  // ils sont volontairement ignorés (voir rapport RUN 5).
  return res.status(201).json({
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    adminEmail: email,
    status: 'active',
  })
}
