import { ContentStatus, CourseStatus, QuizStatus } from '@prisma/client'
import { prisma } from './prisma'
import { asStructuredLessonContent } from './lessonContent'
import { assessLesson } from './lessonQuality'
import type { Readiness } from './lessonQuality'
import { moduleVisibility } from './lessonVisibility'
import type { Visibility } from './lessonVisibility'

/**
 * Revue des brouillons d'un cours.
 *
 * Rien n'est publié ici : ce module ne fait que rassembler ce qui attend une
 * relecture, et signaler ce qui vient de l'IA. La traçabilité s'appuie sur le
 * journal d'audit (`metadata.source` posé à la création) plutôt que sur un
 * champ dédié : aucune migration, et la trace reste vraie même si l'objet est
 * modifié ensuite.
 */

/** Sources considérées comme générées par l'assistant. */
const AI_SOURCES = new Set(['ai-course-draft', 'ai-draft', 'generated'])

/** En deçà, une leçon est probablement trop courte pour être publiée telle quelle. */
const SHORT_CONTENT_CHARACTERS = 400

export interface DraftLesson {
  id: string
  title: string
  order: number
  estimatedMinutes: number | null
  status: ContentStatus
  /** Longueur du contenu texte, pour repérer les leçons vides ou trop courtes. */
  contentLength: number
  /** La leçon dispose-t-elle d'un contenu structuré valide ? */
  structured: boolean
  /** Indicateur de relecture, pas une évaluation académique. */
  readiness: Readiness
  /** Sections attendues encore vides. */
  missingSections: string[]
  aiGenerated: boolean
  warnings: string[]
}

export interface DraftModule {
  id: string
  title: string
  order: number
  status: ContentStatus
  aiGenerated: boolean
  /** Leçons en brouillon uniquement. */
  draftLessons: DraftLesson[]
  publishedLessonCount: number
  totalLessonCount: number
  visibility: Visibility
}

export interface DraftQuiz {
  id: string
  title: string
  status: QuizStatus
  questionCount: number
  moduleId: string | null
  moduleTitle: string | null
  aiGenerated: boolean
  warnings: string[]
}

export interface LastAiBatch {
  generationId: string
  at: Date
  actorName: string
  counts: Record<string, number>
}

export interface CourseDraftOverview {
  counts: {
    draftModules: number
    draftLessons: number
    draftQuizzes: number
    aiDraftItems: number
    /**
     * Comptés sur **toutes** les leçons du cours, publiées comprises : une
     * leçon trop maigre déjà visible est le cas le plus préoccupant.
     */
    lessonsTooLight: number
    lessonsMissingSections: number
    publishedTooLight: number
  }
  /** Statut du cours : conditionne la visibilité de tout le reste. */
  courseStatus: CourseStatus
  modules: DraftModule[]
  quizzes: DraftQuiz[]
  lastAiBatch: LastAiBatch | null
  lastAiGeneration: LastAiGeneration | null
}

export interface LastAiGeneration {
  id: string
  at: Date
  type: string
  model: string
  status: string
}

function displayName(user: {
  firstName: string | null
  lastName: string | null
  email: string
}): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
}

/** Identifiants créés par l'IA, relevés dans le journal d'audit. */
async function aiGeneratedIds(
  institutionId: string,
  courseId: string
): Promise<Set<string>> {
  const logs = await prisma.auditLog.findMany({
    where: {
      institutionId,
      entityType: { in: ['Module', 'Lesson', 'Quiz'] },
      action: { in: ['module.create', 'lesson.create', 'quiz.create'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
    select: { entityId: true, metadata: true },
  })

  const ids = new Set<string>()

  for (const log of logs) {
    const meta = (log.metadata ?? {}) as Record<string, unknown>
    if (meta.courseId !== undefined && meta.courseId !== courseId) continue
    if (typeof meta.source === 'string' && AI_SOURCES.has(meta.source)) {
      ids.add(log.entityId)
    }
  }

  return ids
}

async function lastAiBatch(
  institutionId: string,
  courseId: string
): Promise<LastAiBatch | null> {
  const log = await prisma.auditLog.findFirst({
    where: {
      institutionId,
      action: 'ai.course.apply',
      entityType: 'AIGeneration',
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: {
      entityId: true,
      createdAt: true,
      metadata: true,
      actor: { select: { firstName: true, lastName: true, email: true } },
    },
  })

  if (!log) return null

  const meta = (log.metadata ?? {}) as Record<string, unknown>
  if (meta.courseId !== courseId) return null

  const counts: Record<string, number> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (key !== 'courseId' && typeof value === 'number') counts[key] = value
  }

  return {
    generationId: log.entityId,
    at: log.createdAt,
    actorName: displayName(log.actor),
    counts,
  }
}

/** Dernière génération assistée enregistrée pour ce cours, quel qu'en soit le type. */
async function lastAiGeneration(
  institutionId: string,
  courseId: string
): Promise<LastAiGeneration | null> {
  const record = await prisma.aIGeneration.findFirst({
    where: { institutionId, courseId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      type: true,
      model: true,
      status: true,
    },
  })

  if (!record) return null

  return {
    id: record.id,
    at: record.createdAt,
    type: record.type,
    model: record.model,
    status: record.status,
  }
}

function lessonWarnings(lesson: {
  contentLength: number
  estimatedMinutes: number | null
  structured: boolean
}): string[] {
  const warnings: string[] = []

  if (lesson.contentLength === 0) {
    warnings.push('Aucun contenu rédigé')
  } else if (lesson.contentLength < SHORT_CONTENT_CHARACTERS) {
    warnings.push('Contenu très court')
  }

  if (!lesson.estimatedMinutes) warnings.push('Durée non précisée')

  return warnings
}

/** Rassemble tout ce qui attend une relecture pour un cours donné. */
export async function getCourseDraftOverview(
  institutionId: string,
  courseId: string
): Promise<CourseDraftOverview> {
  const [course, modules, quizzes, aiIds, batch, lastGeneration] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true },
    }),
    prisma.module.findMany({
      where: { courseId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
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
          },
        },
      },
    }),
    prisma.quiz.findMany({
      where: { courseId, status: { not: QuizStatus.ARCHIVED } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        moduleId: true,
        module: { select: { title: true } },
        _count: { select: { questions: true } },
      },
    }),
    aiGeneratedIds(institutionId, courseId),
    lastAiBatch(institutionId, courseId),
    lastAiGeneration(institutionId, courseId),
  ])

  const courseStatus = course?.status ?? CourseStatus.DRAFT

  // Qualité évaluée sur toutes les leçons, y compris publiées.
  const allQuality = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      status: lesson.status,
      quality: assessLesson(lesson),
    }))
  )

  const draftModules: DraftModule[] = modules
    .map((module) => {
      const draftLessons = module.lessons
        .filter((lesson) => lesson.status === ContentStatus.DRAFT)
        .map((lesson) => {
          const structured = asStructuredLessonContent(lesson.contentJson) !== null
          const quality = assessLesson(lesson)

          const base = {
            id: lesson.id,
            title: lesson.title,
            order: lesson.order,
            estimatedMinutes: lesson.estimatedMinutes,
            status: lesson.status,
            contentLength: quality.contentLength,
            structured,
            readiness: quality.readiness,
            missingSections: quality.missingSections,
            aiGenerated: aiIds.has(lesson.id),
          }

          return { ...base, warnings: lessonWarnings(base) }
        })

      const publishedLessonCount = module.lessons.filter(
        (l) => l.status === ContentStatus.PUBLISHED
      ).length

      return {
        id: module.id,
        title: module.title,
        order: module.order,
        status: module.status,
        aiGenerated: aiIds.has(module.id),
        draftLessons,
        publishedLessonCount,
        totalLessonCount: module.lessons.length,
        visibility: moduleVisibility({
          courseStatus,
          moduleStatus: module.status,
          publishedLessonCount,
        }),
      }
    })
    // On ne garde que ce qui demande une action : module en brouillon,
    // ou module publié contenant encore des leçons en brouillon.
    .filter(
      (module) =>
        module.status === ContentStatus.DRAFT || module.draftLessons.length > 0
    )

  const draftQuizzes: DraftQuiz[] = quizzes
    .filter((quiz) => quiz.status === QuizStatus.DRAFT)
    .map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      questionCount: quiz._count.questions,
      moduleId: quiz.moduleId,
      moduleTitle: quiz.module?.title ?? null,
      aiGenerated: aiIds.has(quiz.id),
      warnings: quiz._count.questions === 0 ? ['Aucune question'] : [],
    }))

  const draftLessonCount = draftModules.reduce(
    (n, m) => n + m.draftLessons.length,
    0
  )

  const aiDraftItems =
    draftModules.filter((m) => m.aiGenerated && m.status === ContentStatus.DRAFT)
      .length +
    draftModules.reduce(
      (n, m) => n + m.draftLessons.filter((l) => l.aiGenerated).length,
      0
    ) +
    draftQuizzes.filter((q) => q.aiGenerated).length

  return {
    counts: {
      draftModules: draftModules.filter((m) => m.status === ContentStatus.DRAFT)
        .length,
      draftLessons: draftLessonCount,
      draftQuizzes: draftQuizzes.length,
      aiDraftItems,
      lessonsTooLight: allQuality.filter((l) => l.quality.readiness === 'TOO_LIGHT')
        .length,
      lessonsMissingSections: allQuality.filter(
        (l) => l.quality.missingSections.length > 0
      ).length,
      publishedTooLight: allQuality.filter(
        (l) =>
          l.status === ContentStatus.PUBLISHED &&
          l.quality.readiness === 'TOO_LIGHT'
      ).length,
    },
    courseStatus,
    modules: draftModules,
    quizzes: draftQuizzes,
    lastAiBatch: batch,
    lastAiGeneration: lastGeneration,
  }
}
