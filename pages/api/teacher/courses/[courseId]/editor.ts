import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../lib/teacherAccess'
import { asStructuredLessonContent } from '../../../../../lib/lessonContent'
import { assessLesson } from '../../../../../lib/lessonQuality'
import {
  lessonVisibility,
  moduleVisibility,
} from '../../../../../lib/lessonVisibility'

/**
 * Arborescence complète du cours pour l'éditeur enseignant :
 * modules, leçons, contenu structuré et indicateurs de relecture.
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
      credits: true,
      status: true,
      program: { select: { name: true, code: true } },
      semester: {
        select: { name: true, academicYear: { select: { name: true } } },
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
              order: true,
              status: true,
              content: true,
              contentJson: true,
              estimatedMinutes: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  })

  if (!course) return res.status(404).json({ message: 'Cours introuvable' })

  const modules = course.modules.map((module) => {
    const publishedLessonCount = module.lessons.filter(
      (l) => l.status === 'PUBLISHED'
    ).length

    return {
      id: module.id,
      title: module.title,
      description: module.description,
      order: module.order,
      status: module.status,
      publishedLessonCount,
      visibility: moduleVisibility({
        courseStatus: course.status,
        moduleStatus: module.status,
        publishedLessonCount,
      }),
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        order: lesson.order,
        status: lesson.status,
        estimatedMinutes: lesson.estimatedMinutes,
        updatedAt: lesson.updatedAt,
        // `structuredContent` est null pour les leçons en texte simple :
        // l'éditeur bascule alors sur son repli textarea.
        structuredContent: asStructuredLessonContent(lesson.contentJson),
        plainContent: lesson.content,
        quality: assessLesson(lesson),
        visibility: lessonVisibility({
          courseStatus: course.status,
          moduleStatus: module.status,
          lessonStatus: lesson.status,
        }),
      })),
    }
  })

  const allLessons = modules.flatMap((m) => m.lessons)

  return res.status(200).json({
    id: course.id,
    title: course.title,
    code: course.code,
    credits: course.credits,
    program: course.program,
    semester: {
      name: course.semester.name,
      academicYear: course.semester.academicYear.name,
    },
    status: course.status,
    assignmentRole: access.assignmentRole,
    // Résumé de relecture : ce qui reste à traiter, sans rien publier.
    review: {
      draftModules: modules.filter((m) => m.status === 'DRAFT').length,
      draftLessons: allLessons.filter((l) => l.status === 'DRAFT').length,
      tooLightLessons: allLessons.filter(
        (l) => l.quality.readiness === 'TOO_LIGHT'
      ).length,
      lessonsMissingSections: allLessons.filter(
        (l) => l.quality.missingSections.length > 0
      ).length,
      publishedTooLight: allLessons.filter(
        (l) => l.status === 'PUBLISHED' && l.quality.readiness === 'TOO_LIGHT'
      ).length,
      visibleLessons: allLessons.filter((l) => l.visibility.visible).length,
      totalLessons: allLessons.length,
    },
    modules,
  })
}
