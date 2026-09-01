import type { NextApiRequest, NextApiResponse } from 'next';
import { Prisma, Role, TeacherAssignmentRole } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { requireInstitutionRole } from '../../../../lib/serverAuth';
import { AuditAction, createAuditLog } from '../../../../lib/audit';

/**
 * Affectation des enseignants aux cours, dans le périmètre de l'administrateur.
 *
 * GET  : affectations existantes de l'établissement.
 * POST : affecte un PROFESSOR de l'établissement à un cours de l'établissement.
 *
 * Deux vérifications indépendantes avant écriture : l'enseignant est bien
 * PROFESSOR *dans cet établissement*, et le cours appartient bien à ce même
 * établissement. Aucun `institutionId` n'est lu dans la requête.
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

    const assignments = await prisma.courseAssignment.findMany({
      where: { course: { institutionId: scope.institutionId } },
      orderBy: { assignedAt: 'desc' },
      select: {
        id: true,
        role: true,
        assignedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: {
          select: {
            id: true,
            title: true,
            code: true,
            credits: true,
            program: { select: { name: true, code: true } },
            semester: { select: { name: true } },
          },
        },
      },
    });

    return res.status(200).json(assignments);
  }

  const { userId, courseId, role } = (req.body ?? {}) as Record<string, unknown>;

  if (typeof userId !== 'string' || !userId || typeof courseId !== 'string' || !courseId) {
    return res.status(400).json({ message: 'Enseignant et cours requis' });
  }

  const assignmentRole =
    role === undefined || role === null || role === ''
      ? TeacherAssignmentRole.LEAD
      : (role as TeacherAssignmentRole);

  if (!Object.values(TeacherAssignmentRole).includes(assignmentRole)) {
    return res.status(400).json({ message: "Rôle d'affectation invalide", field: 'role' });
  }

  const membership = await prisma.institutionUser.findFirst({
    where: {
      userId,
      institutionId: scope.institutionId,
      role: Role.PROFESSOR,
      isActive: true,
    },
    select: { id: true },
  });

  if (!membership) {
    return res
      .status(400)
      .json({ message: "Cet utilisateur n'est pas enseignant dans cet établissement", field: 'userId' });
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, institutionId: scope.institutionId },
    select: { id: true },
  });

  if (!course) {
    return res
      .status(400)
      .json({ message: 'Cours inconnu pour cet établissement', field: 'courseId' });
  }

  try {
    const created = await prisma.courseAssignment.create({
      data: { userId, courseId, role: assignmentRole },
      select: {
        id: true,
        role: true,
        assignedAt: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        course: {
          select: {
            id: true,
            title: true,
            code: true,
            credits: true,
            program: { select: { name: true, code: true } },
            semester: { select: { name: true } },
          },
        },
      },
    });

    await createAuditLog({
      actorUserId: scope.user.id,
      institutionId: scope.institutionId,
      action: AuditAction.ASSIGNMENT_CREATE,
      entityType: 'CourseAssignment',
      entityId: created.id,
      metadata: {
        teacherEmail: created.user.email,
        courseCode: created.course.code,
        role: created.role,
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    // @@unique([courseId, userId]) : un enseignant n'a qu'un rôle par cours.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res
        .status(409)
        .json({ message: 'Cet enseignant est déjà affecté à ce cours', field: 'courseId' });
    }

    console.error('[admin/assignments]', error);
    return res.status(500).json({ message: 'Erreur serveur' });
  }
}
