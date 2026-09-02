import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../lib/teacherAccess'

/**
 * Détail d'un cours enseigné : métadonnées, modules et leçons.
 * Accessible au seul professeur affecté à ce cours.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedCourse(req, res, req.query.courseId)
  if (!access) return

  res.setHeader('Cache-Control', 'no-store')

  const course = await prisma.course.findUnique({
    where: { id: access.courseId },
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
      modules: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          description: true,
          order: true,
          status: true,
          lessons: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              title: true,
              content: true,
              contentJson: true,
              order: true,
              estimatedMinutes: true,
              status: true,
            },
          },
        },
      },
    },
  })

  if (!course) return res.status(404).json({ message: 'Cours introuvable' })

  return res.status(200).json({
    ...course,
    semester: {
      id: course.semester.id,
      name: course.semester.name,
      number: course.semester.number,
      academicYear: course.semester.academicYear.name,
      isCurrentYear: course.semester.academicYear.isCurrent,
    },
    assignmentRole: access.assignmentRole,
  })
}
