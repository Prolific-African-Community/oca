import type { Prisma } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Journal d'audit.
 *
 * Règle absolue : **l'audit ne casse jamais l'action métier**. Toute erreur
 * d'écriture est signalée côté serveur et avalée. Un journal manquant est un
 * incident à corriger ; une inscription perdue parce que le journal a échoué
 * serait bien pire.
 *
 * Deuxième règle : `metadata` est une liste blanche choisie par l'appelant.
 * Jamais de mot de passe, de hash, ni de `req.body` brut.
 */

/** Verbes métier journalisés. Un seul endroit pour les nommer. */
export const AuditAction = {
  INSTITUTION_CREATE: 'institution.create',
  STRUCTURE_CREATE: 'structure.create',
  STUDENT_CREATE: 'student.create',
  TEACHER_CREATE: 'teacher.create',
  ASSIGNMENT_CREATE: 'assignment.create',
  MODULE_CREATE: 'module.create',
  MODULE_UPDATE: 'module.update',
  LESSON_CREATE: 'lesson.create',
  LESSON_UPDATE: 'lesson.update',
  LESSON_COMPLETE: 'lesson.complete',
  LESSON_UNCOMPLETE: 'lesson.uncomplete',
  QUIZ_CREATE: 'quiz.create',
  QUIZ_UPDATE: 'quiz.update',
  QUIZ_PUBLISH: 'quiz.publish',
  LESSON_PUBLISH: 'lesson.publish',
  LESSON_UNPUBLISH: 'lesson.unpublish',
  LESSON_STRUCTURED_UPDATE: 'lesson.structured.update',
  LESSON_SECTION_APPLY: 'lesson.section.apply',
  LESSON_SECTION_CLEAR: 'lesson.section.clear',
  AI_LESSON_SECTION_GENERATE: 'ai.lesson.section.generate',
  AI_LESSON_SECTION_IMPROVE: 'ai.lesson.section.improve',
  AI_LESSON_SECTION_REGENERATE: 'ai.lesson.section.regenerate',
  MODULE_PUBLISH: 'module.publish',
  MODULE_UNPUBLISH: 'module.unpublish',
  BULK_PUBLISH: 'bulk.publish',
  QUESTION_CREATE: 'question.create',
  QUESTION_UPDATE: 'question.update',
  QUIZ_ATTEMPT_SUBMIT: 'quiz.attempt.submit',
  AI_INSIGHTS_GENERATE: 'ai.insights.generate',
  AI_QUIZ_GENERATE: 'ai.quiz.generate',
  AI_COURSE_GENERATE: 'ai.course.generate',
  AI_COURSE_APPLY: 'ai.course.apply',
} as const

export type AuditActionValue = typeof AuditAction[keyof typeof AuditAction]

export interface AuditEntry {
  /** Auteur — toujours issu de la session, jamais du client. */
  actorUserId: string
  /** Établissement concerné ; null pour une action de niveau plateforme. */
  institutionId?: string | null
  action: AuditActionValue
  entityType: string
  entityId: string
  /** Champs non sensibles uniquement. */
  metadata?: Prisma.InputJsonValue
}

/**
 * Écrit une entrée de journal. Ne lève jamais : à appeler sans `await` bloquant
 * la réponse si besoin, mais l'`await` reste préférable pour garantir l'ordre.
 */
export async function createAuditLog(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        institutionId: entry.institutionId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    })
  } catch (error) {
    // Volontairement silencieux côté client : l'action métier a déjà réussi.
    console.error('[audit] écriture impossible', {
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      error,
    })
  }
}
