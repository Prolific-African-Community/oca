import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '../../../../../lib/prisma'
import { requireInstitutionRole } from '../../../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../../../lib/audit'

/**
 * Réinitialisation du mot de passe d'un enseignant.
 *
 * Le mot de passe provisoire est généré **côté serveur**, haché avec la même
 * fonction que partout ailleurs, puis renvoyé **une seule fois** à
 * l'administrateur qui en a fait la demande. Il n'est stocké nulle part en
 * clair et n'apparaît pas dans le journal d'audit : celui-ci ne retient que
 * le fait qu'une réinitialisation a eu lieu.
 *
 * ADMIN uniquement, enseignant de son établissement, 404 sinon.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function temporaryPassword(): string {
  return Array.from({ length: 12 }, () =>
    ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
  ).join('')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
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
    select: { user: { select: { id: true, email: true } } },
  })

  if (!membership) {
    return res.status(404).json({ message: 'Enseignant introuvable' })
  }

  const password = temporaryPassword()

  await prisma.user.update({
    where: { id: membership.user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  })

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.TEACHER_PASSWORD_RESET,
    entityType: 'User',
    entityId: membership.user.id,
    // Jamais le mot de passe, jamais son empreinte.
    metadata: {
      teacherId: membership.user.id,
      teacherEmail: membership.user.email,
    },
  })

  return res.status(200).json({
    id: membership.user.id,
    email: membership.user.email,
    password,
    notice: 'Ce mot de passe est affiché une seule fois.',
  })
}
