import type { NextApiRequest, NextApiResponse } from 'next'
import { EnrollmentStatus, InstitutionStatus, Role } from '@prisma/client'
import { prisma } from '../../../../lib/prisma'
import { requirePlatformRole } from '../../../../lib/serverAuth'
import {
  SETUP_TOTAL,
  computeSetup,
  setupDone,
} from '../../../../lib/institutionSetup'

/**
 * Fiche détaillée d'un établissement, pour le super administrateur.
 *
 * Uniquement des comptages réels et le journal d'audit de cet établissement.
 * Aucune métrique d'activité inventée : ce que la base ne sait pas, l'écran ne
 * l'affiche pas.
 *
 * SUPER_ADMIN uniquement.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const user = await requirePlatformRole(req, res, Role.SUPER_ADMIN)
  if (!user) return

  const { institutionId } = req.query
  if (typeof institutionId !== 'string' || !institutionId) {
    return res.status(400).json({ message: 'Identifiant manquant' })
  }

  res.setHeader('Cache-Control', 'no-store')

  const institution = await prisma.institution.findUnique({
    where: { id: institutionId },
    select: {
      id: true,
      name: true,
      slug: true,
      country: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          faculties: true,
          programs: true,
          courses: true,
          academicYears: true,
        },
      },
    },
  })

  if (!institution) {
    return res.status(404).json({ message: 'Établissement introuvable' })
  }

  const [members, semestersByProgram, activeEnrollments, activity] =
    await Promise.all([
      // Les administrateurs sont listés en entier, y compris ceux dont l'accès
      // a été retiré : c'est justement ce qu'il faut voir pour réparer un
      // établissement devenu inaccessible.
      prisma.institutionUser.findMany({
        where: { institutionId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          isActive: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.program.findMany({
        where: { institutionId },
        select: { _count: { select: { semesters: true } } },
      }),
      prisma.enrollment.count({
        where: { institutionId, status: EnrollmentStatus.ACTIVE },
      }),
      prisma.auditLog.findMany({
        where: { institutionId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
          actor: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
    ])

  const semesters = semestersByProgram.reduce(
    (total, program) => total + program._count.semesters,
    0
  )

  const admins = members.filter((m) => m.role === Role.ADMIN)
  const professors = members.filter(
    (m) => m.role === Role.PROFESSOR && m.isActive
  )
  const students = members.filter((m) => m.role === Role.STUDENT && m.isActive)

  const setup = computeSetup({
    faculties: institution._count.faculties,
    programs: institution._count.programs,
    academicYears: institution._count.academicYears,
    semesters,
    courses: institution._count.courses,
    professors: professors.length,
    students: students.length,
  })

  return res.status(200).json({
    id: institution.id,
    name: institution.name,
    slug: institution.slug,
    country: institution.country,
    status:
      institution.status === InstitutionStatus.ACTIVE ? 'active' : 'inactive',
    createdAt: institution.createdAt,
    updatedAt: institution.updatedAt,
    setup,
    setupDone: setupDone(setup),
    setupTotal: SETUP_TOTAL,
    counts: {
      admins: admins.filter((a) => a.isActive).length,
      professors: professors.length,
      students: students.length,
      faculties: institution._count.faculties,
      programs: institution._count.programs,
      academicYears: institution._count.academicYears,
      semesters,
      courses: institution._count.courses,
      activeEnrollments,
    },
    admins: admins.map((a) => ({
      membershipId: a.id,
      userId: a.user.id,
      email: a.user.email,
      name:
        [a.user.firstName, a.user.lastName].filter(Boolean).join(' ') || null,
      // Deux interrupteurs distincts : l'appartenance à cet établissement,
      // et le compte lui-même. Un compte désactivé ne se connecte nulle part.
      membershipActive: a.isActive,
      accountActive: a.user.isActive,
      since: a.createdAt,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      createdAt: entry.createdAt,
      actor:
        [entry.actor.firstName, entry.actor.lastName]
          .filter(Boolean)
          .join(' ') || entry.actor.email,
    })),
    lastActivityAt: activity[0]?.createdAt ?? null,
  })
}
