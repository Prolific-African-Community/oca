import type { NextApiRequest, NextApiResponse } from 'next'
import { AIGenerationStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../../lib/teacherAccess'
import { getTeacherCourseAnalytics } from '../../../../../../lib/teacherAnalytics'
import {
  AI_INSIGHTS_TYPE,
  AI_PROVIDER,
  AiNotConfiguredError,
  AiServiceError,
  fingerprintAiSummary,
  generateTeachingInsights,
  getConfiguredAiModel,
  isTeachingInsights,
  toAiAnalyticsSummary,
} from '../../../../../../lib/ai'
import { AuditAction, createAuditLog } from '../../../../../../lib/audit'

const inFlightGenerations = new Set<string>()

function responseFromSaved(generation: {
  id: string
  output: Prisma.JsonValue
  createdAt: Date
}) {
  if (!isTeachingInsights(generation.output)) return null
  return {
    id: generation.id,
    source: 'cached' as const,
    label: 'Recommandation de l’assistant',
    disclaimer:
      'Aucune décision académique officielle. Validation de l’enseignant requise.',
    generatedAt: generation.createdAt.toISOString(),
    insights: generation.output,
  }
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
        type: AI_INSIGHTS_TYPE,
        provider: AI_PROVIDER,
        output: {},
        status: AIGenerationStatus.FAILED,
      },
    })
  } catch (error) {
    console.error('[ai:insights] impossible de journaliser l’échec', error)
  }
}

/** Historique (GET) et génération/réutilisation (POST) des recommandations. */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedCourse(req, res, req.query.courseId)
  if (!access) return

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store')
    const generations = await prisma.aIGeneration.findMany({
      where: {
        institutionId: access.institutionId,
        courseId: access.courseId,
        type: AI_INSIGHTS_TYPE,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        provider: true,
        model: true,
        output: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    })

    return res.status(200).json({
      insights: generations.map((generation) => ({
        id: generation.id,
        source: 'cached' as const,
        provider: generation.provider,
        model: generation.model,
        status: generation.status,
        errorMessage: generation.errorMessage,
        generatedAt: generation.createdAt.toISOString(),
        output:
          generation.status === AIGenerationStatus.SUCCESS &&
          isTeachingInsights(generation.output)
            ? generation.output
            : null,
      })),
    })
  }

  const analytics = await getTeacherCourseAnalytics(access.courseId)
  if (!analytics) return res.status(404).json({ message: 'Cours introuvable' })

  const summary = toAiAnalyticsSummary(analytics)
  const analyticsFingerprint = fingerprintAiSummary(summary)
  const inputSummary = { analyticsFingerprint, analytics: summary }
  const force =
    (req.body as Record<string, unknown> | undefined)?.force === true

  if (!force) {
    const latest = await prisma.aIGeneration.findFirst({
      where: {
        actorUserId: access.user.id,
        institutionId: access.institutionId,
        courseId: access.courseId,
        type: AI_INSIGHTS_TYPE,
        status: AIGenerationStatus.SUCCESS,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, inputSummary: true, output: true, createdAt: true },
    })

    const savedFingerprint =
      latest?.inputSummary &&
      typeof latest.inputSummary === 'object' &&
      !Array.isArray(latest.inputSummary)
        ? (latest.inputSummary as Record<string, Prisma.JsonValue>)
            .analyticsFingerprint
        : null
    if (latest && savedFingerprint === analyticsFingerprint) {
      const cached = responseFromSaved(latest)
      if (cached) return res.status(200).json(cached)
    }
  }

  const concurrencyKey = `${access.user.id}:${access.courseId}`
  if (inFlightGenerations.has(concurrencyKey)) {
    return res.status(409).json({
      code: 'AI_GENERATION_IN_PROGRESS',
      message: 'Une génération est déjà en cours pour ce cours.',
    })
  }

  inFlightGenerations.add(concurrencyKey)
  const model = getConfiguredAiModel()

  try {
    const generated = await generateTeachingInsights(summary)
    const generation = await prisma.aIGeneration.create({
      data: {
        actorUserId: access.user.id,
        institutionId: access.institutionId,
        courseId: access.courseId,
        type: AI_INSIGHTS_TYPE,
        provider: AI_PROVIDER,
        model: generated.model,
        inputSummary,
        output: generated.insights as unknown as Prisma.InputJsonValue,
        status: AIGenerationStatus.SUCCESS,
      },
      select: { id: true, createdAt: true },
    })

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AuditAction.AI_INSIGHTS_GENERATE,
      entityType: 'Course',
      entityId: access.courseId,
      metadata: {
        model: generated.model,
        source: 'teacher-analytics',
        forced: force,
      },
    })

    return res.status(200).json({
      id: generation.id,
      source: 'generated',
      label: 'Recommandation de l’assistant',
      disclaimer:
        'Aucune décision académique officielle. Validation de l’enseignant requise.',
      generatedAt: generation.createdAt.toISOString(),
      insights: generated.insights,
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
    if (error instanceof AiServiceError) {
      return res
        .status(502)
        .json({ code: 'AI_SERVICE_ERROR', message: error.message })
    }
    console.error('[teacher/ai/insights]', error)
    return res.status(500).json({ message: 'Erreur serveur' })
  } finally {
    inFlightGenerations.delete(concurrencyKey)
  }
}
