import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { requireInstitutionRole } from '../../../lib/serverAuth';
import { AuditAction, createAuditLog } from '../../../lib/audit';

/**
 * Enseignants de l'établissement de l'administrateur connecté.
 *
 * GET  : liste des PROFESSOR du périmètre, avec leur nombre d'affectations.
 * POST : création d'un compte enseignant (User + InstitutionUser PROFESSOR).
 *
 * L'établissement provient de la session ; aucun identifiant d'établissement
 * n'est lu dans la requête.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN);
  if (!scope) return;

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');

    const memberships = await prisma.institutionUser.findMany({
      where: { institutionId: scope.institutionId, role: Role.PROFESSOR, isActive: true },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            _count: {
              select: {
                courseAssignments: {
                  where: { course: { institutionId: scope.institutionId } },
                },
              },
            },
          },
        },
      },
    });

    return res.status(200).json(
      memberships.map(({ user, createdAt }) => ({
        id: user.id,
        email: user.email,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        assignmentCount: user._count.courseAssignments,
        createdAt,
      }))
    );
  }

  const { firstName, lastName, email, password } = (req.body ?? {}) as Record<string, unknown>;

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
    return res.status(400).json({ message: 'Nom, prénom, email et mot de passe requis' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caractères' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    return res.status(409).json({ message: 'Cette adresse email est déjà utilisée' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const teacher = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    await tx.institutionUser.create({
      data: {
        userId: created.id,
        institutionId: scope.institutionId,
        role: Role.PROFESSOR,
      },
    });

    return created;
  });

  await createAuditLog({
    actorUserId: scope.user.id,
    institutionId: scope.institutionId,
    action: AuditAction.TEACHER_CREATE,
    entityType: 'User',
    entityId: teacher.id,
    metadata: { email: teacher.email },
  });

  return res.status(201).json({ ...teacher, assignmentCount: 0 });
}
