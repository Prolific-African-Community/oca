import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { requireInstitutionRole } from '../../../lib/serverAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  // Le périmètre vient de la session, jamais de la requête.
  const scope = await requireInstitutionRole(req, res, Role.ADMIN);
  if (!scope) return;

  res.setHeader('Cache-Control', 'no-store');

  const memberships = await prisma.institutionUser.findMany({
    where: {
      institutionId: scope.institutionId,
      role: Role.STUDENT,
      // Les comptes sans accès restent listés : les masquer priverait
      // l'administrateur du seul moyen de les retrouver.
    },
    orderBy: { createdAt: 'asc' },
    select: {
      createdAt: true,
      isActive: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          // Tout l'historique : la progression conserve les inscriptions
          // closes, et l'administrateur doit pouvoir le constater.
          enrollments: {
            where: { institutionId: scope.institutionId },
            orderBy: [{ status: 'asc' }, { enrolledAt: 'desc' }],
            select: {
              id: true,
              status: true,
              programId: true,
              semesterId: true,
              semester: {
                select: {
                  name: true,
                  academicYear: { select: { id: true, name: true } },
                },
              },
              program: {
                select: { name: true, faculty: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  });

  // Forme conservée telle que l'attend l'écran /admin :
  // { id, firstName, lastName, email, faculty, program }.
  return res.status(200).json(
    memberships.map(({ user, createdAt, isActive }) => {
      // Les champs plats décrivent l'inscription active ; l'historique est
      // fourni à part, pour ne rien changer aux écrans existants.
      const enrollment =
        user.enrollments.find((e) => e.status === 'ACTIVE') ??
        user.enrollments[0];

      return {
        id: user.id,
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email,
        faculty: enrollment?.program.faculty.name ?? '—',
        program: enrollment?.program.name ?? '—',
        semester: enrollment?.semester.name ?? null,
        enrollmentStatus: enrollment?.status ?? null,
        enrollmentId: enrollment?.id ?? null,
        // Ajouts pour l'espace Étudiants : cohortes, filtres, état d'accès.
        programId: enrollment?.programId ?? null,
        semesterId: enrollment?.semesterId ?? null,
        academicYear: enrollment?.semester.academicYear.name ?? null,
        academicYearId: enrollment?.semester.academicYear.id ?? null,
        isActive,
        enrollments: user.enrollments.map((e) => ({
          id: e.id,
          status: e.status,
          program: e.program.name,
          programId: e.programId,
          semester: e.semester.name,
          semesterId: e.semesterId,
          academicYear: e.semester.academicYear.name,
        })),
        createdAt,
      };
    })
  );
}
