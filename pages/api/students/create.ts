import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { Role, EnrollmentStatus } from '@prisma/client'
import { prisma } from '../../../lib/prisma'
import { requireInstitutionRole } from '../../../lib/serverAuth'
import { AuditAction, createAuditLog } from '../../../lib/audit'

/**
 * Création d'un étudiant par un administrateur d'établissement.
 *
 * Depuis le RUN 6, l'inscription pédagogique n'est plus « best effort » :
 * `programId` et `semesterId` sont obligatoires et doivent appartenir à
 * l'établissement de la session. Un étudiant est donc toujours créé avec
 * une inscription réelle, ou pas créé du tout.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  // Le champ `universityId` éventuellement envoyé par le client est ignoré :
  // l'établissement est celui de la session de l'administrateur.
  const scope = await requireInstitutionRole(req, res, Role.ADMIN)
  if (!scope) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const { firstName, lastName, email, password, programId, semesterId } = body

  if (
    typeof firstName !== 'string' ||
    typeof lastName !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !firstName.trim() ||
    !lastName.trim() ||
    !email.trim() ||
    !password
  ) {
    return res
      .status(400)
      .json({ message: 'Nom, prénom, email et mot de passe requis' })
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: 'Le mot de passe doit faire au moins 8 caractères' })
  }

  if (
    typeof programId !== 'string' ||
    typeof semesterId !== 'string' ||
    !programId ||
    !semesterId
  ) {
    return res.status(400).json({ message: 'Programme et semestre requis' })
  }

  // Le semestre doit appartenir au programme, et le programme à l'établissement
  // de l'administrateur : une seule requête verrouille les trois conditions.
  const semester = await prisma.semester.findFirst({
    where: {
      id: semesterId,
      programId,
      program: { institutionId: scope.institutionId },
    },
    select: {
      id: true,
      name: true,
      programId: true,
      program: { select: { name: true, faculty: { select: { name: true } } } },
    },
  })

  if (!semester) {
    return res
      .status(400)
      .json({ message: 'Programme ou semestre inconnu pour cet établissement' })
  }

  const normalizedEmail = email.trim().toLowerCase()

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })

  if (existing) {
    return res
      .status(409)
      .json({ message: 'Cette adresse email est déjà utilisée' })
  }

  const passwordHash = await bcrypt.hash(password, 10)

  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    })

    await tx.institutionUser.create({
      data: {
        userId: created.id,
        institutionId: scope.institutionId,
        role: Role.STUDENT,
      },
    })

    await tx.enrollment.create({
      data: {
        institutionId: scope.institutionId,
        userId: created.id,
        programId: semester.programId,
        semesterId: semester.id,
        status: EnrollmentStatus.ACTIVE,
      },
    })

    return created
  })

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.STUDENT_CREATE,
    entityType: 'User',
    entityId: student.id,
    // Aucun mot de passe ni hash : uniquement l'identité et le rattachement.
    metadata: {
      email: student.email,
      programId: semester.programId,
      semesterId: semester.id,
      semester: semester.name,
    },
  })

  // Forme conservée telle que l'attend l'écran /admin.
  return res.status(201).json({
    id: student.id,
    firstName: student.firstName,
    lastName: student.lastName,
    email: student.email,
    faculty: semester.program.faculty.name,
    program: semester.program.name,
    semester: semester.name,
    enrollmentStatus: EnrollmentStatus.ACTIVE,
    enrolled: true,
  })
}
