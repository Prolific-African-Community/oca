import type { NextApiRequest, NextApiResponse } from 'next'
import { AIGenerationStatus } from '@prisma/client'
import { prisma } from '../../../../../../lib/prisma'
import { requireAssignedLesson } from '../../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../../lib/audit'
import { AiNotConfiguredError, AiServiceError } from '../../../../../../lib/ai'
import { asStructuredLessonContent } from '../../../../../../lib/lessonContent'
import type { StructuredLessonContent } from '../../../../../../lib/lessonContent'
import { checkSectionGenerationLimit } from '../../../../../../lib/aiRateLimit'
import {
  AI_LESSON_SECTION_TYPE,
  SectionMode,
  generateLessonSection,
  isListSection,
  isSectionKey,
  isSectionMode,
} from '../../../../../../lib/aiLessonSection'

/**
 * Brouillon assisté d'une section de leçon.
 *
 * Renvoie **uniquement un aperçu** : l'écriture passe ensuite par
 * `PATCH /api/teacher/lessons/[lessonId]/structured-content`, sur décision
 * explicite de l'enseignant. Aucune publication, aucune donnée étudiante.
 */

const EMPTY: StructuredLessonContent = {
  introduction: '',
  keyConcepts: [],
  explanation: '',
  practicalExample: '',
  recap: '',
  exercises: [],
}

/** Une génération à la fois par leçon : évite les doubles soumissions. */
const inFlight = new Set<string>()

const AUDIT_BY_MODE = {
  GENERATE: AuditAction.AI_LESSON_SECTION_GENERATE,
  IMPROVE: AuditAction.AI_LESSON_SECTION_IMPROVE,
  REGENERATE: AuditAction.AI_LESSON_SECTION_REGENERATE,
} as const

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const access = await requireAssignedLesson(req, res, req.query.lessonId)
  if (!access) return

  const body = (req.body ?? {}) as Record<string, unknown>
  const section = body.section
  const mode = body.mode

  if (!isSectionKey(section)) {
    return res.status(400).json({ message: 'Section inconnue', field: 'section' })
  }
  if (!isSectionMode(mode)) {
    return res.status(400).json({ message: 'Action inconnue', field: 'mode' })
  }

  const instruction =
    typeof body.instruction === 'string' && body.instruction.trim()
      ? body.instruction.trim().slice(0, 1000)
      : undefined

  const lesson = await prisma.lesson.findUnique({
    where: { id: access.lessonId },
    select: {
      id: true,
      title: true,
      estimatedMinutes: true,
      content: true,
      contentJson: true,
      module: {
        select: {
          title: true,
          description: true,
          course: {
            select: {
              id: true,
              title: true,
              code: true,
              program: { select: { name: true } },
            },
          },
        },
      },
    },
  })

  if (!lesson) return res.status(404).json({ message: 'Leçon introuvable' })

  const current =
    asStructuredLessonContent(lesson.contentJson) ??
    ({ ...EMPTY, explanation: (lesson.content ?? '').trim() } as StructuredLessonContent)

  const currentIsEmpty = isListSection(section)
    ? (current[section] as string[]).length === 0
    : (current[section] as string).trim().length === 0

  if (mode !== 'GENERATE' && currentIsEmpty) {
    return res.status(400).json({
      code: 'SECTION_EMPTY',
      message: 'Cette section est vide : utilisez Générer.',
      field: 'mode',
    })
  }

  // Quota vérifié avant tout appel au fournisseur : une requête bloquée ne
  // coûte rien et ne laisse aucun enregistrement AIGeneration.
  const verdict = await checkSectionGenerationLimit({
    actorUserId: access.user.id,
    lessonId: lesson.id,
    section,
  })

  if (!verdict.allowed) {
    if (verdict.retryAfterSeconds) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds))
    }
    return res.status(429).json({
      code: verdict.code,
      message: verdict.message,
    })
  }

  if (inFlight.has(lesson.id)) {
    return res.status(409).json({
      code: 'GENERATION_IN_PROGRESS',
      message: 'Une génération est déjà en cours pour cette leçon.',
    })
  }

  inFlight.add(lesson.id)

  // Résumé conservé pour la gouvernance : aucun contenu d'étudiant, aucune clé.
  const inputSummary = {
    courseId: lesson.module.course.id,
    lessonId: lesson.id,
    section,
    mode,
    hasInstruction: Boolean(instruction),
    currentLength: isListSection(section)
      ? (current[section] as string[]).length
      : (current[section] as string).length,
  }

  try {
    const generated = await generateLessonSection({
      course: {
        title: lesson.module.course.title,
        code: lesson.module.course.code,
        programName: lesson.module.course.program.name,
      },
      module: {
        title: lesson.module.title,
        description: lesson.module.description,
      },
      lesson: {
        title: lesson.title,
        estimatedMinutes: lesson.estimatedMinutes,
        current,
      },
      section,
      mode: mode as SectionMode,
      instruction,
    })

    const record = await prisma.aIGeneration.create({
      data: {
        actorUserId: access.user.id,
        institutionId: access.institutionId,
        courseId: lesson.module.course.id,
        type: AI_LESSON_SECTION_TYPE,
        provider: generated.provider,
        model: generated.model,
        inputSummary,
        output: generated.draft as any,
        status: AIGenerationStatus.SUCCESS,
      },
      select: { id: true, createdAt: true },
    })

    await createAuditLog({
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      action: AUDIT_BY_MODE[mode as SectionMode],
      entityType: 'Lesson',
      entityId: lesson.id,
      metadata: {
        courseId: lesson.module.course.id,
        moduleId: access.moduleId,
        section,
        mode,
      },
    })

    return res.status(200).json({
      id: record.id,
      generatedAt: record.createdAt,
      section,
      mode,
      preview: generated.draft,
      disclaimer:
        'Brouillon généré : relisez-le puis appliquez-le vous-même. Rien n’est enregistré ni publié automatiquement.',
    })
  } catch (error) {
    const failure =
      error instanceof AiNotConfiguredError
        ? { code: 'AI_NOT_CONFIGURED', status: 503, message: error.message }
        : error instanceof AiServiceError
        ? { code: 'AI_UNAVAILABLE', status: 502, message: error.message }
        : { code: 'AI_UNAVAILABLE', status: 502, message: 'Génération impossible.' }

    // La configuration manquante n'est pas un incident fournisseur : on ne
    // consigne que les échecs réellement survenus côté service.
    if (!(error instanceof AiNotConfiguredError)) {
      await prisma.aIGeneration
        .create({
          data: {
            actorUserId: access.user.id,
            institutionId: access.institutionId,
            courseId: lesson.module.course.id,
            type: AI_LESSON_SECTION_TYPE,
            provider: 'openai',
            model: process.env.OPENAI_MODEL?.trim() || 'gpt-4.1-mini',
            inputSummary,
            output: {},
            status: AIGenerationStatus.FAILED,
            errorMessage: failure.message.slice(0, 500),
          },
        })
        .catch(() => undefined)
    }

    return res
      .status(failure.status)
      .json({ code: failure.code, message: failure.message })
  } finally {
    inFlight.delete(lesson.id)
  }
}
