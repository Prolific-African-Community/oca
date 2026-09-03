import type { NextApiRequest, NextApiResponse } from 'next';
import { CourseStatus, InstitutionStatus, Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { requirePlatformRole } from '../../../lib/serverAuth';
import {
  SETUP_TOTAL,
  computeSetup,
  setupDone,
} from '../../../lib/institutionSetup';

/**
 * Vue d'ensemble du réseau pour le super administrateur.
 *
 * Uniquement des comptages réels issus de la base. Aucune métrique d'activité,
 * de tendance ou d'alerte : rien de tout cela n'est mesuré aujourd'hui
 * (ni journal d'audit, ni traces de connexion).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const user = await requirePlatformRole(req, res, Role.SUPER_ADMIN);
  if (!user) return;

  res.setHeader('Cache-Control', 'no-store');

  const [
    institutions,
    membershipsByRole,
    programCount,
    courseCount,
    publishedCourses,
    semestersByProgram,
    lastActivity,
  ] = await Promise.all([
    prisma.institution.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        country: true,
        status: true,
        createdAt: true,
        members: {
          where: { role: Role.ADMIN, isActive: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: {
            user: {
              select: { email: true, firstName: true, lastName: true },
            },
          },
        },
        _count: {
          select: {
            programs: true,
            courses: true,
            faculties: true,
            academicYears: true,
          },
        },
      },
    }),
    prisma.institutionUser.groupBy({
      by: ['role', 'institutionId'],
      where: { isActive: true },
      _count: { _all: true },
    }),
    prisma.program.count(),
    prisma.course.count(),
    prisma.course.count({ where: { status: CourseStatus.PUBLISHED } }),
    // Les semestres pendent des programmes, pas de l'établissement :
    // on les remonte via le programme qui les porte.
    prisma.program.findMany({
      select: { institutionId: true, _count: { select: { semesters: true } } },
    }),
    // Dernière trace réelle par établissement. Le journal est la seule source
    // d'activité dont nous disposions : rien n'est inventé ici.
    prisma.auditLog.groupBy({
      by: ['institutionId'],
      _max: { createdAt: true },
    }),
  ]);

  const semesterCount = new Map<string, number>();
  for (const row of semestersByProgram) {
    semesterCount.set(
      row.institutionId,
      (semesterCount.get(row.institutionId) ?? 0) + row._count.semesters
    );
  }

  const lastActivityAt = new Map<string, Date>();
  for (const row of lastActivity) {
    if (row.institutionId && row._max.createdAt) {
      lastActivityAt.set(row.institutionId, row._max.createdAt);
    }
  }

  // Répartition des rôles, globale et par établissement.
  const perInstitution = new Map<string, { admins: number; professors: number; students: number }>();
  const totals = { admins: 0, professors: 0, students: 0 };

  for (const row of membershipsByRole) {
    const entry =
      perInstitution.get(row.institutionId) ?? { admins: 0, professors: 0, students: 0 };

    if (row.role === Role.ADMIN) {
      entry.admins += row._count._all;
      totals.admins += row._count._all;
    } else if (row.role === Role.PROFESSOR) {
      entry.professors += row._count._all;
      totals.professors += row._count._all;
    } else if (row.role === Role.STUDENT) {
      entry.students += row._count._all;
      totals.students += row._count._all;
    }

    perInstitution.set(row.institutionId, entry);
  }

  const active = institutions.filter((i) => i.status === InstitutionStatus.ACTIVE).length;

  return res.status(200).json({
    totals: {
      institutions: institutions.length,
      activeInstitutions: active,
      inactiveInstitutions: institutions.length - active,
      admins: totals.admins,
      professors: totals.professors,
      students: totals.students,
      programs: programCount,
      courses: courseCount,
      publishedCourses,
    },
    institutions: institutions.map((i) => {
      const counts = perInstitution.get(i.id) ?? { admins: 0, professors: 0, students: 0 };
      const semesters = semesterCount.get(i.id) ?? 0;
      const admin = i.members[0]?.user ?? null;

      // Calculé par `lib/institutionSetup`, comme sur la fiche détaillée :
      // les deux écrans ne peuvent pas diverger.
      const setup = computeSetup({
        faculties: i._count.faculties,
        programs: i._count.programs,
        academicYears: i._count.academicYears,
        semesters,
        courses: i._count.courses,
        professors: counts.professors,
        students: counts.students,
      });
      const done = setupDone(setup);

      return {
        id: i.id,
        name: i.name,
        slug: i.slug,
        country: i.country,
        // Forme conservée pour l'écran : 'active' | 'inactive'.
        status: i.status === InstitutionStatus.ACTIVE ? 'active' : 'inactive',
        adminEmail: admin?.email ?? null,
        adminName:
          admin && (admin.firstName || admin.lastName)
            ? [admin.firstName, admin.lastName].filter(Boolean).join(' ')
            : null,
        createdAt: i.createdAt,
        lastActivityAt: lastActivityAt.get(i.id) ?? null,
        setup,
        setupDone: done,
        setupTotal: SETUP_TOTAL,
        counts: {
          ...counts,
          programs: i._count.programs,
          courses: i._count.courses,
          faculties: i._count.faculties,
          academicYears: i._count.academicYears,
          semesters,
        },
      };
    }),
  });
}
