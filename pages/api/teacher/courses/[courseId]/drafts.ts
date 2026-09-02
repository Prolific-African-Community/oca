import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAssignedCourse } from '../../../../../lib/teacherAccess'
import { getCourseDraftOverview } from '../../../../../lib/teacherDrafts'

/** Brouillons d'un cours enseigné, groupés par module, pour relecture. */
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

  const overview = await getCourseDraftOverview(
    access.institutionId,
    access.courseId
  )

  return res.status(200).json(overview)
}
