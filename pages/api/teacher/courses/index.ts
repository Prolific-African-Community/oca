import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { requireInstitutionRole } from '../../../../lib/serverAuth';

/**
 * Cours affectés à l'enseignant connecté.
 * PROFESSOR uniquement, restreint à son établissement et à ses propres
 * affectations : `userId` vient de la session, jamais de la requête.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireInstitutionRole(req, res, Role.PROFESSOR);
  if (!scope) return;

  res.setHeader('Cache-Control', 'no-store');

  const assignments = await prisma.courseAssignment.findMany({
    where: {
      userId: scope.user.id,
      course: { institutionId: scope.institutionId },
    },
    orderBy: [{ course: { semesterId: 'asc' } }, { course: { order: 'asc' } }],
    select: {
      id: true,
      role: true,
      assignedAt: true,
      course: {
        select: {
          id: true,
          title: true,
          code: true,
          description: true,
          credits: true,
          coefficient: true,
          status: true,
          program: { select: { id: true, name: true, code: true } },
          semester: {
            select: {
              id: true,
              name: true,
              number: true,
              academicYear: { select: { name: true, isCurrent: true } },
            },
          },
          _count: { select: { modules: true } },
        },
      },
    },
  });

  return res.status(200).json(
    assignments.map((a) => ({
      assignmentId: a.id,
      role: a.role,
      assignedAt: a.assignedAt,
      id: a.course.id,
      title: a.course.title,
      code: a.course.code,
      description: a.course.description,
      credits: a.course.credits,
      coefficient: a.course.coefficient,
      status: a.course.status,
      program: a.course.program,
      semester: {
        id: a.course.semester.id,
        name: a.course.semester.name,
        number: a.course.semester.number,
        academicYear: a.course.semester.academicYear.name,
        isCurrentYear: a.course.semester.academicYear.isCurrent,
      },
      moduleCount: a.course._count.modules,
    }))
  );
}
