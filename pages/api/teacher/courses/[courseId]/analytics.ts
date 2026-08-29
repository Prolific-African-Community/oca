import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAssignedCourse } from '../../../../../lib/teacherAccess'
import { getTeacherCourseAnalytics } from '../../../../../lib/teacherAnalytics'

/** Analytics issues uniquement des étudiants, contenus et quiz du cours affecté. */
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
  const analytics = await getTeacherCourseAnalytics(access.courseId)
  if (!analytics) return res.status(404).json({ message: 'Cours introuvable' })

  return res.status(200).json(analytics)
}
