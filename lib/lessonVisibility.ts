import { ContentStatus, CourseStatus } from '@prisma/client'

/**
 * Visibilité réelle d'un contenu pour les étudiants.
 *
 * La règle est celle appliquée côté étudiant (`lib/studentAccess.ts`) : une
 * leçon n'est lisible que si elle est publiée, dans un module publié, d'un
 * cours publié. Cet utilitaire ne fait que **rendre cette règle lisible** dans
 * l'interface enseignante : il n'accorde ni ne restreint aucun accès.
 *
 * Réserve importante : l'inscription de l'étudiant au semestre du cours n'est
 * pas évaluée ici — elle dépend de chaque étudiant. « Visible » signifie donc
 * « visible des étudiants inscrits », jamais « visible de tous ».
 */

export type VisibilityCode =
  | 'VISIBLE'
  | 'LESSON_DRAFT'
  | 'MODULE_DRAFT'
  | 'COURSE_NOT_PUBLISHED'

export interface Visibility {
  visible: boolean
  code: VisibilityCode
  /** Libellé court, pour une pastille. */
  label: string
  /** Cause de la non-visibilité, ou confirmation quand elle est acquise. */
  reason: string
}

const HIDDEN = 'Masqué aux étudiants'

function courseBlock(courseStatus: CourseStatus): Visibility | null {
  if (courseStatus === CourseStatus.PUBLISHED) return null

  return {
    visible: false,
    code: 'COURSE_NOT_PUBLISHED',
    label: HIDDEN,
    reason:
      courseStatus === CourseStatus.ARCHIVED
        ? "Le cours est archivé : aucun contenu n'est accessible aux étudiants."
        : "Le cours n'est pas encore publié : aucun contenu n'est accessible aux étudiants. Cette publication relève de l'administration.",
  }
}

/** Visibilité d'un module, indépendamment de ses leçons. */
export function moduleVisibility(params: {
  courseStatus: CourseStatus
  moduleStatus: ContentStatus
  publishedLessonCount: number
}): Visibility {
  const blocked = courseBlock(params.courseStatus)
  if (blocked) return blocked

  if (params.moduleStatus !== ContentStatus.PUBLISHED) {
    return {
      visible: false,
      code: 'MODULE_DRAFT',
      label: HIDDEN,
      reason: 'Le module est en brouillon : ses leçons restent invisibles.',
    }
  }

  return {
    visible: true,
    code: 'VISIBLE',
    label: 'Visible aux étudiants',
    reason:
      params.publishedLessonCount === 0
        ? 'Module publié, mais sans aucune leçon publiée : les étudiants inscrits le voient vide.'
        : `Module publié avec ${params.publishedLessonCount} leçon(s) publiée(s).`,
  }
}

/**
 * Visibilité d'une leçon. Les causes sont évaluées de la plus englobante à la
 * plus locale : on affiche celle que l'enseignant doit lever en premier.
 */
export function lessonVisibility(params: {
  courseStatus: CourseStatus
  moduleStatus: ContentStatus
  lessonStatus: ContentStatus
}): Visibility {
  const blocked = courseBlock(params.courseStatus)
  if (blocked) return blocked

  if (params.moduleStatus !== ContentStatus.PUBLISHED) {
    return {
      visible: false,
      code: 'MODULE_DRAFT',
      label: HIDDEN,
      reason:
        params.lessonStatus === ContentStatus.PUBLISHED
          ? 'Leçon publiée, mais son module est en brouillon : elle reste invisible.'
          : 'Le module et la leçon sont en brouillon.',
    }
  }

  if (params.lessonStatus !== ContentStatus.PUBLISHED) {
    return {
      visible: false,
      code: 'LESSON_DRAFT',
      label: HIDDEN,
      reason: 'La leçon est en brouillon : seul son module est publié.',
    }
  }

  return {
    visible: true,
    code: 'VISIBLE',
    label: 'Visible aux étudiants',
    reason: 'Leçon publiée dans un module publié d’un cours publié.',
  }
}
