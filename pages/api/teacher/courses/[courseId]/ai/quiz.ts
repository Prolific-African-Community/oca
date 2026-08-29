import type { NextApiRequest, NextApiResponse } from 'next'
import {
  AIGenerationStatus,
  Prisma,
  QuestionType,
  QuizStatus,
} from '@prisma/client'
import { prisma } from '../../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../../lib/audit'
import {
  AI_QUIZ_DRAFT_TYPE,
  QuizSourceSummary,
  generateQuizDraft,
} from '../../../../../../lib/aiQuiz'
import {
  AI_PROVIDER,
  AiNotConfiguredError,
  AiServiceError,
  getConfiguredAiModel,
} from '../../../../../../lib/ai'
import { normalizeQuestion } from '../../../../../../lib/quiz'
import { ValidationError } from '../../../../../../lib/validation'

const inFlightGenerations = new Set<string>()
const MAX_SOURCE_CHARACTERS = 24_000

function stringId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function addSection(
  summary: QuizSourceSummary,
  section: QuizSourceSummary['sections'][number],
  budget: { remaining: number }
) {
  if (budget.remaining <= 0) return
  const content = section.content.trim()
  if (!content) return
  const limited = content.slice(0, budget.remaining)
  budget.remaining -= limited.length
  summary.sections.push({ ...section, content: limited })
}

async function saveFailedGeneration(params: {
  actorUserId: string
  institutionId: string
  courseId: string
  inputSummary: Prisma.InputJsonValue
  model: string
  errorMessage: string
}) {
  try {
    await prisma.aIGeneration.create({
      data: {
        ...params,
        type: AI_QUIZ_DRAFT_TYPE,
        provider: AI_PROVIDER,
        output: {},
        status: AIGenerationStatus.FAILED,
      },
    })
  } catch (error) {
    console.error('[ai:quiz] impossible de journaliser l’échec', error)
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedCourse(req, res, req.query.courseId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const moduleId = stringId(body.moduleId)
  const lessonId = stringId(body.lessonId)
  if (moduleId && lessonId) {
    return res.status(400).json({
      message: 'Choisissez un module ou une leçon, pas les deux.',
    })
  }

  const course = await prisma.course.findFirst({
    where: { id: access.courseId, institutionId: access.institutionId },
    select: {
      id: true,
      title: true,
      code: true,
      description: true,
      modules: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          title: true,
          description: true,
          lessons: {
            orderBy: { order: 'asc' },
            select: { id: true, title: true, content: true },
          },
        },
      },
    },
  })
  if (!course) return res.status(404).json({ message: 'Cours introuvable' })

  const selectedModule = moduleId
    ? course.modules.find((module) => module.id === moduleId)
    : null
  const lessonWithModule = lessonId
    ? course.modules
        .flatMap((module) =>
          module.lessons.map((lesson) => ({ lesson, module }))
        )
        .find(({ lesson }) => lesson.id === lessonId)
    : null

  if (moduleId && !selectedModule) {
    return res
      .status(400)
      .json({ message: 'Module inconnu pour ce cours', field: 'moduleId' })
  }
  if (lessonId && !lessonWithModule) {
    return res
      .status(400)
      .json({ message: 'Leçon inconnue pour ce cours', field: 'lessonId' })
  }

  const summary: QuizSourceSummary = {
    scope: {
      type: lessonId ? 'LESSON' : moduleId ? 'MODULE' : 'COURSE',
      courseTitle: course.title,
      courseCode: course.code,
      ...(selectedModule ? { moduleTitle: selectedModule.title } : {}),
      ...(lessonWithModule
        ? {
            moduleTitle: lessonWithModule.module.title,
            lessonTitle: lessonWithModule.lesson.title,
          }
        : {}),
    },
    sections: [],
  }
  const budget = { remaining: MAX_SOURCE_CHARACTERS }

  if (lessonWithModule) {
    addSection(
      summary,
      {
        kind: 'lesson',
        title: lessonWithModule.lesson.title,
        content: lessonWithModule.lesson.content ?? '',
      },
      budget
    )
  } else {
    if (!moduleId) {
      addSection(
        summary,
        {
          kind: 'course',
          title: course.title,
          content: course.description ?? '',
        },
        budget
      )
    }
    const modules = selectedModule ? [selectedModule] : course.modules
    for (const module of modules) {
      addSection(
        summary,
        {
          kind: 'module',
          title: module.title,
          content: module.description ?? '',
        },
        budget
      )
      for (const lesson of module.lessons) {
        addSection(
          summary,
          {
            kind: 'lesson',
            title: lesson.title,
            content: lesson.content ?? '',
          },
          budget
        )
      }
    }
  }

  if (summary.sections.length === 0) {
    return res.status(400).json({
      code: 'QUIZ_SOURCE_EMPTY',
      message: 'Ajoutez du contenu pédagogique avant de générer un quiz.',
    })
  }

  const concurrencyKey = `${access.user.id}:${access.courseId}`
  if (inFlightGenerations.has(concurrencyKey)) {
    return res.status(409).json({
      code: 'AI_GENERATION_IN_PROGRESS',
      message: 'Une génération de quiz est déjà en cours pour ce cours.',
    })
  }

  inFlightGenerations.add(concurrencyKey)
  const model = getConfiguredAiModel()
  const inputSummary = summary as unknown as Prisma.InputJsonValue

  try {
    const generated = await generateQuizDraft(summary)
    const questions = generated.draft.questions.map((question) => {
      const normalized = normalizeQuestion(
        question as unknown as Record<string, unknown>
      )
      if (
        normalized.type !== QuestionType.MULTIPLE_CHOICE &&
        normalized.type !== QuestionType.TRUE_FALSE
      ) {
        throw new ValidationError('Type de question IA interdit', 'type')
      }
      return normalized
    })

    const title = generated.draft.title.trim()
    if (!title || title.length > 200) {
      throw new AiServiceError('Titre de brouillon IA invalide.')
    }

    const created = await prisma.$transaction(async (tx) => {
      const order =
        (
          await tx.quiz.aggregate({
            where: { courseId: access.courseId },
            _max: { order: true },
          })
        )._max.order ?? -1

      const quiz = await tx.quiz.create({
        data: {
          institutionId: access.institutionId,
          courseId: access.courseId,
          moduleId: selectedModule?.id ?? lessonWithModule?.module.id ?? null,
          lessonId: lessonWithModule?.lesson.id ?? null,
          title,
          description: generated.draft.description.trim() || null,
          status: QuizStatus.DRAFT,
          order: order + 1,
          questions: {
            create: questions.map((question, index) => ({
              prompt: question.prompt,
              type: question.type,
              options: question.options ?? undefined,
              correctAnswer: question.correctAnswer as Prisma.InputJsonValue,
              explanation: question.explanation,
              points: question.points,
              order: index,
            })),
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          order: true,
          passingScore: true,
          questions: { select: { id: true, type: true, points: true } },
        },
      })

      const generation = await tx.aIGeneration.create({
        data: {
          actorUserId: access.user.id,
          institutionId: access.institutionId,
          courseId: access.courseId,
          type: AI_QUIZ_DRAFT_TYPE,
          provider: generated.provider,
          model: generated.model,
          inputSummary,
          output: generated.draft as unknown as Prisma.InputJsonValue,
          status: AIGenerationStatus.SUCCESS,
        },
        select: { id: true },
      })
      return { quiz, generationId: generation.id }
    })

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.AI_QUIZ_GENERATE,
      entityType: 'Quiz',
      entityId: created.quiz.id,
      metadata: {
        courseId: access.courseId,
        model: generated.model,
        scope: summary.scope.type,
        questionCount: created.quiz.questions.length,
      },
    })
    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.QUIZ_CREATE,
      entityType: 'Quiz',
      entityId: created.quiz.id,
      metadata: {
        courseId: access.courseId,
        title: created.quiz.title,
        source: 'ai-draft',
      },
    })
    await Promise.all(
      created.quiz.questions.map((question) =>
        createAuditLog({
          actorUserId: access.user.id,
          institutionId: access.institutionId,
          action: AuditAction.QUESTION_CREATE,
          entityType: 'QuizQuestion',
          entityId: question.id,
          metadata: {
            quizId: created.quiz.id,
            type: question.type,
            points: question.points,
            source: 'ai-draft',
          },
        })
      )
    )

    const { questions: createdQuestions, ...quiz } = created.quiz
    return res.status(201).json({
      ...quiz,
      questionCount: createdQuestions.length,
      attemptCount: 0,
      aiGenerationId: created.generationId,
      source: 'generated',
      disclaimer:
        'Brouillon généré par l’assistant. Validation et publication manuelles requises.',
    })
  } catch (error) {
    const errorMessage =
      error instanceof AiNotConfiguredError
        ? 'AI_NOT_CONFIGURED'
        : 'AI_SERVICE_ERROR'
    await saveFailedGeneration({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      courseId: access.courseId,
      inputSummary,
      model,
      errorMessage,
    })

    if (error instanceof AiNotConfiguredError) {
      return res
        .status(503)
        .json({ code: 'AI_NOT_CONFIGURED', message: error.message })
    }
    if (error instanceof AiServiceError || error instanceof ValidationError) {
      return res.status(502).json({
        code: 'AI_SERVICE_ERROR',
        message: 'Le brouillon reçu est invalide. Réessayez plus tard.',
      })
    }
    console.error('[teacher/ai/quiz]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  } finally {
    inFlightGenerations.delete(concurrencyKey)
  }
}
