import type { NextApiRequest, NextApiResponse } from 'next'
import {
  AIGenerationStatus,
  ContentStatus,
  Prisma,
  QuizStatus,
} from '@prisma/client'
import { prisma } from '../../../../../../../lib/prisma'
import { requireAssignedCourse } from '../../../../../../../lib/teacherAccess'
import { AuditAction, createAuditLog } from '../../../../../../../lib/audit'
import type { GeneratedCourseDraft } from '../../../../../../../lib/aiCourseDraft'
import {
  AI_COURSE_DRAFT_TYPE,
  CourseDraftMode,
  CourseDraftRequest,
  isGeneratedCourseDraft,
} from '../../../../../../../lib/aiCourseDraft'
import {
  structuredLessonContentFromDraft,
  structuredLessonContentJson,
  structuredLessonContentToPlainText,
} from '../../../../../../../lib/lessonContent'
import { normalizeEditedCourseDraft } from '../../../../../../../lib/editedCourseDraft'

const inFlightApplications = new Set<string>()

function generationId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function storedGuidance(value: Prisma.JsonValue): CourseDraftRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const guidance = (value as Record<string, Prisma.JsonValue>).guidance
  if (!guidance || typeof guidance !== 'object' || Array.isArray(guidance))
    return null
  const data = guidance as Record<string, Prisma.JsonValue>
  const mode = data.mode
  if (mode !== 'APPEND_ONLY' && mode !== 'EMPTY_COURSE_ONLY') return null
  if (
    !Number.isInteger(data.moduleCount) ||
    !Number.isInteger(data.lessonsPerModule) ||
    typeof data.includeQuizzes !== 'boolean'
  )
    return null
  return {
    objective: typeof data.objective === 'string' ? data.objective : undefined,
    targetLevel:
      typeof data.targetLevel === 'string' ? data.targetLevel : undefined,
    moduleCount: Number(data.moduleCount),
    lessonsPerModule: Number(data.lessonsPerModule),
    includeQuizzes: data.includeQuizzes,
    mode: mode as CourseDraftMode,
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
  const id = generationId(body.aiGenerationId)
  if (!id) return res.status(400).json({ message: 'Génération IA manquante' })

  const generation = await prisma.aIGeneration.findFirst({
    where: {
      id,
      actorUserId: access.user.id,
      institutionId: access.institutionId,
      courseId: access.courseId,
      type: AI_COURSE_DRAFT_TYPE,
      status: AIGenerationStatus.SUCCESS,
    },
    select: { id: true, inputSummary: true, output: true },
  })
  if (!generation)
    return res.status(404).json({ message: 'Brouillon IA introuvable' })

  const guidance = storedGuidance(generation.inputSummary)
  if (!guidance || !isGeneratedCourseDraft(generation.output, guidance)) {
    return res
      .status(422)
      .json({ message: 'Le brouillon enregistré est invalide.' })
  }

  const concurrencyKey = `${access.user.id}:${generation.id}`
  if (inFlightApplications.has(concurrencyKey)) {
    return res
      .status(409)
      .json({ message: 'Ce brouillon est déjà en cours d’application.' })
  }
  inFlightApplications.add(concurrencyKey)

  try {
    const alreadyApplied = await prisma.auditLog.findFirst({
      where: {
        actorUserId: access.user.id,
        institutionId: access.institutionId,
        action: AuditAction.AI_COURSE_APPLY,
        entityType: 'AIGeneration',
        entityId: generation.id,
      },
      select: { id: true },
    })
    if (alreadyApplied) {
      return res.status(409).json({
        code: 'DRAFT_ALREADY_APPLIED',
        message: 'Ce brouillon a déjà été appliqué.',
      })
    }

    /**
     * Brouillon retouché par l'enseignant, le cas échéant.
     *
     * Il n'est jamais cru sur parole : il repasse par un validateur d'intégrité,
     * ses quiz sont **ignorés** au profit de ceux du brouillon d'origine, et le
     * nombre de modules et de leçons doit rester celui qui a été généré. Rien
     * n'écrase l'enregistrement AIGeneration : la sortie brute du fournisseur
     * reste intacte pour la traçabilité.
     */
    // Capturé une fois : le rétrécissement de type est perdu dans les closures.
    const original: GeneratedCourseDraft = generation.output
    let draft: GeneratedCourseDraft = original
    let editedBeforeApply = false
    let editWarnings: string[] = []

    if (body.editedDraft !== undefined) {
      const edited = normalizeEditedCourseDraft(body.editedDraft, guidance)

      if (!edited) {
        return res
          .status(400)
          .json({ code: 'INVALID_EDIT', message: 'Brouillon modifié illisible.' })
      }
      if (edited.issues.length > 0) {
        return res.status(400).json({
          code: 'INVALID_EDIT',
          message: 'Le brouillon modifié est incomplet.',
          issues: edited.issues,
        })
      }

      // Les quiz proviennent du brouillon d'origine, jamais du client.
      draft = {
        courseSummary: edited.draft.courseSummary,
        modules: edited.draft.modules.map((module, index) => ({
          ...module,
          quizzes: original.modules[index]?.quizzes ?? [],
        })),
      }
      editedBeforeApply = true
      editWarnings = edited.warnings
    }

    const created = await prisma.$transaction(async (tx) => {
      const existingModuleCount = await tx.module.count({
        where: { courseId: access.courseId },
      })
      if (guidance.mode === 'EMPTY_COURSE_ONLY' && existingModuleCount > 0) {
        throw new Error('COURSE_NOT_EMPTY')
      }
      const maxModuleOrder =
        (
          await tx.module.aggregate({
            where: { courseId: access.courseId },
            _max: { order: true },
          })
        )._max.order ?? -1
      let quizOrder =
        (
          await tx.quiz.aggregate({
            where: { courseId: access.courseId },
            _max: { order: true },
          })
        )._max.order ?? -1

      const modules: Array<{ id: string; lessons: Array<{ id: string }> }> = []
      const quizzes: Array<{ id: string; questions: Array<{ id: string }> }> =
        []

      for (
        let moduleIndex = 0;
        moduleIndex < draft.modules.length;
        moduleIndex += 1
      ) {
        const moduleDraft = draft.modules[moduleIndex]
        const objectives = moduleDraft.learningObjectives.length
          ? `\n\nObjectifs d’apprentissage\n${moduleDraft.learningObjectives
              .map((item) => `- ${item}`)
              .join('\n')}`
          : ''
        const module = await tx.module.create({
          data: {
            courseId: access.courseId,
            title: moduleDraft.title.trim(),
            description: `${moduleDraft.description.trim()}${objectives}`,
            order: maxModuleOrder + moduleIndex + 1,
            status: ContentStatus.DRAFT,
            lessons: {
              create: moduleDraft.lessons.map((lesson, lessonIndex) => {
                const structured = structuredLessonContentFromDraft(lesson)
                return {
                  title: lesson.title.trim(),
                  content: structuredLessonContentToPlainText(structured),
                  contentJson: structuredLessonContentJson(structured),
                  estimatedMinutes: lesson.estimatedMinutes,
                  order: lessonIndex,
                  status: ContentStatus.DRAFT,
                }
              }),
            },
          },
          select: { id: true, lessons: { select: { id: true } } },
        })
        modules.push(module)

        for (const quizDraft of moduleDraft.quizzes) {
          quizOrder += 1
          const quiz = await tx.quiz.create({
            data: {
              institutionId: access.institutionId,
              courseId: access.courseId,
              moduleId: module.id,
              title: quizDraft.title.trim(),
              description: quizDraft.description.trim(),
              status: QuizStatus.DRAFT,
              order: quizOrder,
              questions: {
                create: quizDraft.questions.map((question, questionIndex) => ({
                  type: question.type,
                  prompt: question.prompt.trim(),
                  options: question.options as Prisma.InputJsonValue,
                  correctAnswer:
                    question.correctAnswer as Prisma.InputJsonValue,
                  explanation: question.explanation.trim(),
                  points: question.points,
                  order: questionIndex,
                })),
              },
            },
            select: { id: true, questions: { select: { id: true } } },
          })
          quizzes.push(quiz)
        }
      }

      const counts = {
        modules: modules.length,
        lessons: modules.reduce(
          (sum, module) => sum + module.lessons.length,
          0
        ),
        quizzes: quizzes.length,
        questions: quizzes.reduce(
          (sum, quiz) => sum + quiz.questions.length,
          0
        ),
      }
      await tx.auditLog.create({
        data: {
          actorUserId: access.user.id,
          institutionId: access.institutionId,
          action: AuditAction.AI_COURSE_APPLY,
          entityType: 'AIGeneration',
          entityId: generation.id,
          metadata: {
            courseId: access.courseId,
            ...counts,
            // Trace la retouche sans recopier le contenu dans le journal.
            editedBeforeApply,
          },
        },
      })
      return { counts, modules, quizzes }
    })

    await Promise.all([
      ...created.modules.map((module) =>
        createAuditLog({
          actorUserId: access.user.id,
          institutionId: access.institutionId,
          action: AuditAction.MODULE_CREATE,
          entityType: 'Module',
          entityId: module.id,
          metadata: { courseId: access.courseId, source: 'ai-course-draft' },
        })
      ),
      ...created.modules.flatMap((module) =>
        module.lessons.map((lesson) =>
          createAuditLog({
            actorUserId: access.user.id,
            institutionId: access.institutionId,
            action: AuditAction.LESSON_CREATE,
            entityType: 'Lesson',
            entityId: lesson.id,
            metadata: {
              moduleId: module.id,
              courseId: access.courseId,
              source: 'ai-course-draft',
            },
          })
        )
      ),
      ...created.quizzes.map((quiz) =>
        createAuditLog({
          actorUserId: access.user.id,
          institutionId: access.institutionId,
          action: AuditAction.QUIZ_CREATE,
          entityType: 'Quiz',
          entityId: quiz.id,
          metadata: { courseId: access.courseId, source: 'ai-course-draft' },
        })
      ),
      ...created.quizzes.flatMap((quiz) =>
        quiz.questions.map((question) =>
          createAuditLog({
            actorUserId: access.user.id,
            institutionId: access.institutionId,
            action: AuditAction.QUESTION_CREATE,
            entityType: 'QuizQuestion',
            entityId: question.id,
            metadata: {
              quizId: quiz.id,
              courseId: access.courseId,
              source: 'ai-course-draft',
            },
          })
        )
      ),
    ])

    return res.status(201).json({
      aiGenerationId: generation.id,
      created: created.counts,
      status: 'DRAFT',
      editedBeforeApply,
      warnings: editWarnings,
      message:
        'Brouillon appliqué. Relisez puis publiez chaque contenu manuellement.',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'COURSE_NOT_EMPTY') {
      return res.status(409).json({
        code: 'COURSE_NOT_EMPTY',
        message: 'Le cours contient désormais des modules.',
      })
    }
    console.error('[teacher/ai/course-draft/apply]', error)
    return res
      .status(500)
      .json({ message: 'Application du brouillon impossible.' })
  } finally {
    inFlightApplications.delete(concurrencyKey)
  }
}
