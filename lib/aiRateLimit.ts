import { prisma } from './prisma'
import { AI_LESSON_SECTION_TYPE } from './aiLessonSection'

/**
 * Garde-fou de coût pour les actions IA par section.
 *
 * Chaque clic sur Générer / Améliorer / Régénérer est un appel facturé. Les
 * compteurs s'appuient sur les enregistrements `AIGeneration` déjà présents :
 * aucune table, aucun état en mémoire, donc un comptage qui survit au
 * redémarrage et reste juste avec plusieurs instances.
 *
 * Les limites sont volontairement larges : elles arrêtent l'emballement et les
 * doubles clics, pas l'usage normal.
 */

export const SECTION_LIMITS = {
  /** Générations par enseignant et par heure, toutes leçons confondues. */
  perHour: 20,
  /** Générations par enseignant et par jour. */
  perDay: 80,
  /** Générations pour une même leçon et une même section dans la fenêtre. */
  perSectionWindow: 5,
  /** Fenêtre courte appliquée au couple leçon/section, en minutes. */
  sectionWindowMinutes: 10,
} as const

export interface RateLimitVerdict {
  allowed: boolean
  code?: 'RATE_LIMIT_HOUR' | 'RATE_LIMIT_DAY' | 'RATE_LIMIT_SECTION'
  message?: string
  /** Secondes à attendre avant de réessayer, pour l'en-tête Retry-After. */
  retryAfterSeconds?: number
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60_000)
}

/**
 * Vérifie les quotas **avant** tout appel au fournisseur.
 * Les tentatives bloquées ne créent aucun enregistrement `AIGeneration`.
 */
export async function checkSectionGenerationLimit(params: {
  actorUserId: string
  lessonId: string
  section: string
}): Promise<RateLimitVerdict> {
  const [hourCount, dayCount, sectionRecent] = await Promise.all([
    prisma.aIGeneration.count({
      where: {
        actorUserId: params.actorUserId,
        type: AI_LESSON_SECTION_TYPE,
        createdAt: { gte: minutesAgo(60) },
      },
    }),
    prisma.aIGeneration.count({
      where: {
        actorUserId: params.actorUserId,
        type: AI_LESSON_SECTION_TYPE,
        createdAt: { gte: minutesAgo(60 * 24) },
      },
    }),
    prisma.aIGeneration.findMany({
      where: {
        actorUserId: params.actorUserId,
        type: AI_LESSON_SECTION_TYPE,
        createdAt: { gte: minutesAgo(SECTION_LIMITS.sectionWindowMinutes) },
      },
      select: { inputSummary: true },
      take: 50,
    }),
  ])

  if (hourCount >= SECTION_LIMITS.perHour) {
    return {
      allowed: false,
      code: 'RATE_LIMIT_HOUR',
      message: `Limite de ${SECTION_LIMITS.perHour} générations par heure atteinte. Réessayez plus tard.`,
      retryAfterSeconds: 15 * 60,
    }
  }

  if (dayCount >= SECTION_LIMITS.perDay) {
    return {
      allowed: false,
      code: 'RATE_LIMIT_DAY',
      message: `Limite de ${SECTION_LIMITS.perDay} générations par jour atteinte.`,
      retryAfterSeconds: 60 * 60,
    }
  }

  // Le comptage par section se fait sur le résumé stocké : pas de colonne dédiée.
  const sameSection = sectionRecent.filter((row) => {
    const summary = (row.inputSummary ?? {}) as Record<string, unknown>
    return (
      summary.lessonId === params.lessonId && summary.section === params.section
    )
  }).length

  if (sameSection >= SECTION_LIMITS.perSectionWindow) {
    return {
      allowed: false,
      code: 'RATE_LIMIT_SECTION',
      message: `Vous avez régénéré cette section ${SECTION_LIMITS.perSectionWindow} fois en ${SECTION_LIMITS.sectionWindowMinutes} minutes. Relisez le dernier brouillon avant d’en demander un autre.`,
      retryAfterSeconds: SECTION_LIMITS.sectionWindowMinutes * 60,
    }
  }

  return { allowed: true }
}
