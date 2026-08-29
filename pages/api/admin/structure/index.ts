import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';
import { requireInstitutionRole } from '../../../../lib/serverAuth';

/**
 * Structure académique de l'établissement de l'administrateur connecté.
 * Alimente les sélecteurs de l'espace /admin (facultés, programmes, semestres…).
 *
 * Le périmètre vient exclusivement de la session : aucun `institutionId` n'est
 * lu depuis la requête, ni dans le corps ni dans la query.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const scope = await requireInstitutionRole(req, res, Role.ADMIN);
  if (!scope) return;

  res.setHeader('Cache-Control', 'no-store');

  const institutionId = scope.institutionId;

  const [institution, faculties, cycles, programs, academicYears, semesters, courses] = await Promise.all([
    prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, name: true, slug: true },
    }),
    prisma.faculty.findMany({
      where: { institutionId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        departments: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true, code: true },
        },
      },
    }),
    prisma.cycle.findMany({
      where: { institutionId },
      orderBy: { level: 'asc' },
      select: { id: true, name: true, code: true, level: true, durationYears: true, totalCredits: true },
    }),
    prisma.program.findMany({
      where: { institutionId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        facultyId: true,
        departmentId: true,
        durationYears: true,
        cycle: { select: { id: true, name: true, level: true } },
      },
    }),
    prisma.academicYear.findMany({
      where: { institutionId },
      orderBy: { startDate: 'desc' },
      select: { id: true, name: true, isCurrent: true, status: true },
    }),
    prisma.semester.findMany({
      where: { program: { institutionId } },
      orderBy: [{ academicYearId: 'asc' }, { number: 'asc' }],
      select: {
        id: true,
        name: true,
        number: true,
        status: true,
        programId: true,
        academicYearId: true,
        _count: { select: { courses: true } },
      },
    }),
    prisma.course.findMany({
      where: { institutionId },
      orderBy: [{ semesterId: 'asc' }, { order: 'asc' }],
      select: {
        id: true,
        title: true,
        code: true,
        credits: true,
        status: true,
        programId: true,
        semesterId: true,
      },
    }),
  ]);

  return res.status(200).json({
    institution,
    faculties,
    cycles,
    programs,
    academicYears,
    semesters: semesters.map(({ _count, ...s }) => ({ ...s, courseCount: _count.courses })),
    courses,
  });
}
