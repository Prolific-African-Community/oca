import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { AIGenerationStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../../lib/audit'
import {
  AI_PROVIDER,
  AiNotConfiguredError,
  AiServiceError,
  getConfiguredAiModel,
} from '../../../../../../lib/ai'
import {
  AI_COURSE_DRAFT_TYPE,
  AiCourseDraftIncompleteError,
  CourseDraftContext,
  CourseDraftMode,
  CourseDraftRequest,
  CourseDraftWarning,
  generateCourseDraft,
} from '../../../../../../lib/aiCourseDraft'

const inFlightGenerations = new Set<string>()
const FAILED_INPUT_COOLDOWN_MS = 10 * 60 * 1000
const QUIZ_RELIABILITY_LESSON_LIMIT = 6
const INCOMPLETE_MESSAGE =
  'Le brouillon généré est incomplet. Réessayez avec moins de modules ou sans quiz.'

export const config = { maxDuration: 180 }

function optionalString(
  body: Record<string, unknown>,
  field: string,
  max: number
): string | undefined {
  const value = body[field]
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new Error(field)
  }
  return value.trim() || undefined
}

function boundedInt(
  body: Record<string, unknown>,
  field: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = body[field] ?? fallback
  const value = typeof raw === 'string' ? Number(raw) : raw
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) {
    throw new Error(field)
  }
  return Number(value)
}

function parseRequest(body: Record<string, unknown>): CourseDraftRequest {
  const mode = body.mode
  if (mode !== 'APPEND_ONLY' && mode !== 'EMPTY_COURSE_ONLY') {
    throw new Error('mode')
  }
  const moduleCount = boundedInt(body, 'moduleCount', 4, 1, 8)
  const lessonsPerModule = boundedInt(body, 'lessonsPerModule', 3, 1, 6)
  if (moduleCount * lessonsPerModule > 30) throw new Error('lessonCount')
  if (
    body.includeQuizzes !== undefined &&
    typeof body.includeQuizzes !== 'boolean'
  ) {
    throw new Error('includeQuizzes')
  }
  return {
    objective: optionalString(body, 'objective', 1200),
    targetLevel: optionalString(body, 'targetLevel', 200),
    moduleCount,
    lessonsPerModule,
    includeQuizzes: body.includeQuizzes === true,
    mode: mode as CourseDraftMode,
  }
}

async function saveFailure(params: {
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
        type: AI_COURSE_DRAFT_TYPE,
        provider: AI_PROVIDER,
        output: {},
        status: AIGenerationStatus.FAILED,
      },
    })
  } catch (error) {
    console.error('[ai:course-draft] impossible de journaliser l’échec', error)
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

  let guidance: CourseDraftRequest
  try {
    guidance = parseRequest((req.body ?? {}) as Record<string, unknown>)
  } catch (error) {
    const field = error instanceof Error ? error.message : undefined
    return res.status(400).json({
      code: 'INVALID_COURSE_DRAFT_REQUEST',
      field,
      message:
        field === 'lessonCount'
          ? 'Le brouillon ne peut pas dépasser 30 leçons.'
          : 'Paramètres de génération invalides.',
    })
  }

  const course = await prisma.course.findFirst({
    where: { id: access.courseId, institutionId: access.institutionId },
    select: {
      title: true,
      code: true,
      description: true,
      credits: true,
      program: { select: { name: true } },
      semester: {
        select: { name: true, academicYear: { select: { name: true } } },
      },
      modules: {
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: {
          title: true,
          description: true,
          lessons: {
            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
            select: { title: true },
          },
        },
      },
    },
  })
  if (!course) return res.status(404).json({ message: 'Cours introuvable' })
  if (guidance.mode === 'EMPTY_COURSE_ONLY' && course.modules.length > 0) {
    return res.status(409).json({
      code: 'COURSE_NOT_EMPTY',
      message: 'Ce mode exige un cours sans module existant.',
    })
  }

  const lessonCount = guidance.moduleCount * guidance.lessonsPerModule
  const policyWarnings: CourseDraftWarning[] = []
  const effectiveGuidance = { ...guidance }
  if (guidance.includeQuizzes && lessonCount > QUIZ_RELIABILITY_LESSON_LIMIT) {
    effectiveGuidance.includeQuizzes = false
    policyWarnings.push({
      code: 'QUIZZES_OMITTED_FOR_RELIABILITY',
      message:
        'Les quiz ont été omis pour préserver la qualité de ce brouillon volumineux. Vous pourrez les générer séparément.',
    })
  }

  const context: CourseDraftContext = {
    course: {
      title: course.title,
      code: course.code,
      description: course.description,
      credits: course.credits,
      program: course.program.name,
      semester: `${course.semester.name} — ${course.semester.academicYear.name}`,
    },
    existingStructure: course.modules.map((module) => ({
      title: module.title,
      description: module.description,
      lessons: module.lessons.map((lesson) => lesson.title),
    })),
    guidance: effectiveGuidance,
  }
  const requestFingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        courseId: access.courseId,
        courseUpdatedStructure: context.existingStructure,
        guidance,
      })
    )
    .digest('hex')
  const inputSummary = {
    ...context,
    requestedGuidance: guidance,
    requestFingerprint,
    generationWarnings: policyWarnings,
  } as unknown as Prisma.InputJsonValue

  const recentFailure = await prisma.aIGeneration.findFirst({
    where: {
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      courseId: access.courseId,
      type: AI_COURSE_DRAFT_TYPE,
      status: AIGenerationStatus.FAILED,
      errorMessage: 'INCOMPLETE_DRAFT',
      createdAt: { gte: new Date(Date.now() - FAILED_INPUT_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { inputSummary: true, errorMessage: true, createdAt: true },
  })
  const failedFingerprint =
    recentFailure?.inputSummary &&
    typeof recentFailure.inputSummary === 'object' &&
    !Array.isArray(recentFailure.inputSummary)
      ? (recentFailure.inputSummary as Record<string, Prisma.JsonValue>)
          .requestFingerprint
      : null
  if (failedFingerprint === requestFingerprint && recentFailure) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (recentFailure.createdAt.getTime() +
          FAILED_INPUT_COOLDOWN_MS -
          Date.now()) /
          1000
      )
    )
    res.setHeader('Retry-After', String(retryAfterSeconds))
    return res.status(429).json({
      code: 'IDENTICAL_FAILED_REQUEST_COOLDOWN',
      failureReason: recentFailure.errorMessage,
      retryAfterSeconds,
      message: INCOMPLETE_MESSAGE,
    })
  }
  const concurrencyKey = `${access.user.id}:${access.courseId}`
  if (inFlightGenerations.has(concurrencyKey)) {
    return res.status(409).json({
      code: 'AI_GENERATION_IN_PROGRESS',
      message: 'Une génération de cours est déjà en cours.',
    })
  }

  inFlightGenerations.add(concurrencyKey)
  const model = getConfiguredAiModel()
  try {
    const generated = await generateCourseDraft(context)
    const warnings = [...policyWarnings, ...generated.warnings]
    const generation = await prisma.aIGeneration.create({
      data: {
        actorUserId: access.user.id,
        institutionId: access.institutionId,
        courseId: access.courseId,
        type: AI_COURSE_DRAFT_TYPE,
        provider: generated.provider,
        model: generated.model,
        inputSummary,
        output: generated.draft as unknown as Prisma.InputJsonValue,
        status: AIGenerationStatus.SUCCESS,
      },
      select: { id: true, createdAt: true },
    })

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.AI_COURSE_GENERATE,
      entityType: 'AIGeneration',
      entityId: generation.id,
      metadata: {
        courseId: access.courseId,
        model: generated.model,
        mode: guidance.mode,
        moduleCount: generated.draft.modules.length,
        lessonCount: generated.draft.modules.reduce(
          (sum, module) => sum + module.lessons.length,
          0
        ),
        includeQuizzesRequested: guidance.includeQuizzes,
        quizCount: generated.draft.modules.reduce(
          (sum, module) => sum + module.quizzes.length,
          0
        ),
        warningCodes: warnings.map((warning) => warning.code),
      },
    })

    return res.status(201).json({
      id: generation.id,
      generatedAt: generation.createdAt.toISOString(),
      preview: generated.draft,
      warnings,
      disclaimer:
        'Brouillon créé par l’assistant. Vous devez le relire, l’appliquer puis le publier manuellement.',
    })
  } catch (error) {
    const configured = error instanceof AiNotConfiguredError
    const incomplete = error instanceof AiCourseDraftIncompleteError
    const failureReason = configured
      ? 'AI_NOT_CONFIGURED'
      : incomplete
      ? 'INCOMPLETE_DRAFT'
      : 'AI_SERVICE_ERROR'
    await saveFailure({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      courseId: access.courseId,
      inputSummary,
      model,
      errorMessage: failureReason,
    })
    if (configured) {
      return res
        .status(503)
        .json({ code: 'AI_NOT_CONFIGURED', message: error.message })
    }
    if (incomplete) {
      return res.status(502).json({
        code: 'INCOMPLETE_DRAFT',
        failureReason,
        message: INCOMPLETE_MESSAGE,
      })
    }
    if (error instanceof AiServiceError) {
      return res.status(502).json({
        code: 'AI_SERVICE_ERROR',
        failureReason,
        message: 'Le service de génération est temporairement indisponible.',
      })
    }
    console.error('[teacher/ai/course-draft]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  } finally {
    inFlightGenerations.delete(concurrencyKey)
  }
}
