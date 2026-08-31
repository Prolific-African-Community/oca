import { ContentStatus, QuizStatus } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Conséquences d'une suppression de contenu pédagogique.
 *
 * La suppression est irréversible et le produit n'a pas de versionnement :
 * l'enseignant doit voir ce qu'il détruit **avant** de le détruire. Ce module
 * mesure les conséquences et prépare la mise en sécurité ; il ne supprime rien.
 *
 * Ce que dit le schéma :
 *  - les leçons d'un module partent en cascade, ainsi que la progression des
 *    étudiants et les acquis d'apprentissage rattachés ;
 *  - les quiz, eux, **survivent** : `Quiz.moduleId` et `Quiz.lessonId` sont en
 *    SetNull. Sans intervention, un quiz publié rattaché à une leçon supprimée
 *    resterait visible des étudiants, privé de son contexte pédagogique.
 *
 * Règle produit : un quiz qui perd sa leçon ou son module est **archivé** dans
 * la transaction de suppression. Il n'est pas détruit — l'enseignant le
 * retrouve dans son espace, marqué « Archivé » — mais il disparaît de la vue
 * étudiante. Les quiz en brouillon sont archivés eux aussi : un brouillon
 * orphelin n'a plus rien à faire dans la file de relecture.
 */

/** Statut retenu : masqué des étudiants, mais conservé et visible du professeur. */
export const DETACHED_QUIZ_STATUS = QuizStatus.ARCHIVED

export interface DeletionImpact {
  /** Leçons effectivement supprimées (1 pour une leçon, n pour un module). */
  lessons: number
  /** Parmi elles, celles qui étaient publiées. */
  publishedLessons: number
  /** Lignes de progression étudiante détruites. */
  studentProgress: number
  /** Quiz concernés : conservés, jamais supprimés. */
  detachedQuizCount: number
  /** Quiz qui seront archivés par cette suppression. */
  hiddenQuizCount: number
  /** Parmi eux, ceux qui étaient visibles des étudiants. */
  publishedQuizHiddenCount: number
  /** Quiz déjà archivés : rien à faire. */
  alreadyHiddenQuizCount: number
  /** La suppression touche-t-elle du contenu visible ou de la progression ? */
  requiresConfirmation: boolean
}

/** Identifiants des quiz à archiver, retenus avant que le SetNull ne les détache. */
export interface QuizFallout {
  impact: DeletionImpact
  quizIdsToHide: string[]
}

function summarize(
  base: {
    lessons: number
    publishedLessons: number
    studentProgress: number
  },
  quizzes: { id: string; status: QuizStatus }[],
  selfPublished: boolean
): QuizFallout {
  const toHide = quizzes.filter((q) => q.status !== DETACHED_QUIZ_STATUS)

  const impact: DeletionImpact = {
    ...base,
    detachedQuizCount: quizzes.length,
    hiddenQuizCount: toHide.length,
    publishedQuizHiddenCount: quizzes.filter(
      (q) => q.status === QuizStatus.PUBLISHED
    ).length,
    alreadyHiddenQuizCount: quizzes.length - toHide.length,
    requiresConfirmation:
      selfPublished ||
      base.publishedLessons > 0 ||
      base.studentProgress > 0 ||
      quizzes.length > 0,
  }

  return { impact, quizIdsToHide: toHide.map((q) => q.id) }
}

export async function lessonDeletionImpact(lesson: {
  id: string
  status: ContentStatus
}): Promise<QuizFallout> {
  const [studentProgress, quizzes] = await Promise.all([
    prisma.lessonProgress.count({ where: { lessonId: lesson.id } }),
    prisma.quiz.findMany({
      where: { lessonId: lesson.id },
      select: { id: true, status: true },
    }),
  ])

  return summarize(
    {
      lessons: 1,
      publishedLessons: lesson.status === ContentStatus.PUBLISHED ? 1 : 0,
      studentProgress,
    },
    quizzes,
    lesson.status === ContentStatus.PUBLISHED
  )
}

export async function moduleDeletionImpact(module: {
  id: string
  status: ContentStatus
}): Promise<QuizFallout> {
  const [lessons, studentProgress, quizzes] = await Promise.all([
    prisma.lesson.findMany({
      where: { moduleId: module.id },
      select: { status: true },
    }),
    prisma.lessonProgress.count({ where: { moduleId: module.id } }),
    // Quiz rattachés au module, plus ceux rattachés à ses leçons.
    prisma.quiz.findMany({
      where: {
        OR: [{ moduleId: module.id }, { lesson: { moduleId: module.id } }],
      },
      select: { id: true, status: true },
    }),
  ])

  return summarize(
    {
      lessons: lessons.length,
      publishedLessons: lessons.filter(
        (l) => l.status === ContentStatus.PUBLISHED
      ).length,
      studentProgress,
    },
    quizzes,
    module.status === ContentStatus.PUBLISHED
  )
}

/** Accord en nombre : ce texte est lu par des enseignants, pas par un journal. */
const plural = (n: number) => (n > 1 ? 's' : '')

/** Phrase d'avertissement, construite à partir des conséquences réelles. */
export function impactMessage(
  kind: 'lesson' | 'module',
  title: string,
  status: ContentStatus,
  impact: DeletionImpact
): string {
  const parts: string[] = []

  parts.push(
    kind === 'lesson'
      ? `Supprimer définitivement la leçon « ${title} » ?`
      : `Supprimer définitivement le module « ${title} » ?`
  )

  if (kind === 'module') {
    if (impact.lessons === 0) {
      parts.push('Il ne contient aucune leçon.')
    } else {
      parts.push(
        `${impact.lessons} leçon${plural(impact.lessons)} ${
          impact.lessons > 1 ? 'seront supprimées' : 'sera supprimée'
        } avec lui, dont ${impact.publishedLessons} publiée${plural(
          impact.publishedLessons
        )}.`
      )
    }
  } else if (status === ContentStatus.PUBLISHED) {
    parts.push(
      'Elle est publiée : les étudiants inscrits y ont accès en ce moment.'
    )
  }

  if (impact.studentProgress > 0) {
    parts.push(
      `${impact.studentProgress} enregistrement${plural(
        impact.studentProgress
      )} de progression étudiante ${
        impact.studentProgress > 1 ? 'seront perdus' : 'sera perdu'
      }.`
    )
  }

  if (impact.hiddenQuizCount > 0) {
    const many = impact.hiddenQuizCount > 1
    parts.push(
      `${impact.hiddenQuizCount} quiz ${
        many ? 'seront archivés' : 'sera archivé'
      } plutôt que supprimé${plural(impact.hiddenQuizCount)} : ${
        many ? 'ils ne seront plus visibles' : 'il ne sera plus visible'
      } des étudiants, mais ${
        many ? 'vous les retrouverez' : 'vous le retrouverez'
      } dans vos quiz.` +
        (impact.publishedQuizHiddenCount > 0
          ? ` ${impact.publishedQuizHiddenCount} ${
              impact.publishedQuizHiddenCount > 1
                ? 'sont publiés aujourd’hui'
                : 'est publié aujourd’hui'
            }.`
          : '')
    )
  }

  if (impact.alreadyHiddenQuizCount > 0) {
    parts.push(
      `${impact.alreadyHiddenQuizCount} quiz déjà archivé${plural(
        impact.alreadyHiddenQuizCount
      )} ${
        impact.alreadyHiddenQuizCount > 1 ? 'restent inchangés' : 'reste inchangé'
      }.`
    )
  }

  parts.push('Cette action est irréversible.')

  return parts.join(' ')
}
