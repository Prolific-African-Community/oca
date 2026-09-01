import { EnrollmentStatus, Prisma, Role } from '@prisma/client'
import { prisma } from './prisma'

/**
 * Progression académique d'un étudiant.
 *
 * Il faut distinguer deux gestes que l'interface présente séparément, et que
 * ce module traite différemment :
 *
 *  - **corriger** un rattachement, c'est réparer une erreur de saisie :
 *    l'inscription active est déplacée sur place (RUN 43B) ;
 *  - **faire progresser**, c'est franchir une période académique :
 *    l'inscription active est **close** (`COMPLETED`) et une nouvelle est
 *    créée. Le parcours reste lisible : on sait où l'étudiant est passé.
 *
 * Écraser l'inscription à chaque passage de semestre effacerait le parcours
 * année après année. C'est précisément ce que ce module évite.
 *
 * Ce qui n'est pas touché : la progression pédagogique (`LessonProgress`).
 * Elle reste attachée à l'étudiant et aux leçons ; seuls les cours visibles
 * changent, puisqu'ils dépendent du semestre de l'inscription active.
 */

export type ProgressionOutcome =
  | 'PROGRESSED'
  | 'ENROLLED'
  | 'UNCHANGED'
  | 'CONFLICT'
  | 'NOT_FOUND'

export interface ProgressionResult {
  studentId: string
  outcome: ProgressionOutcome
  message?: string
  previous?: { id: string; semesterId: string; status: EnrollmentStatus } | null
  next?: { id: string; semesterId: string } | null
}

export interface ResolvedTarget {
  id: string
  name: string
  programId: string
  academicYearId: string
}

/**
 * Vérifie en une requête que le semestre visé existe, appartient au programme
 * annoncé, relève de l'année annoncée, et que le tout est bien dans
 * l'établissement de la session.
 */
export async function resolveTargetSemester(
  institutionId: string,
  target: { programId: string; academicYearId?: string; semesterId: string }
): Promise<ResolvedTarget | null> {
  const semester = await prisma.semester.findFirst({
    where: {
      id: target.semesterId,
      programId: target.programId,
      ...(target.academicYearId
        ? { academicYearId: target.academicYearId }
        : {}),
      program: { institutionId },
    },
    select: { id: true, name: true, programId: true, academicYearId: true },
  })

  return semester ?? null
}

/** L'étudiant appartient-il bien à cet établissement ? */
export async function isStudentOfInstitution(
  institutionId: string,
  studentId: string
): Promise<boolean> {
  const membership = await prisma.institutionUser.findFirst({
    where: { userId: studentId, institutionId, role: Role.STUDENT },
    select: { id: true },
  })
  return Boolean(membership)
}

/**
 * Fait progresser un étudiant vers un semestre.
 *
 * Toute l'opération tient dans une transaction : on ne veut jamais d'un
 * état où l'ancienne inscription est close sans que la nouvelle existe.
 */
export async function progressStudent(
  institutionId: string,
  studentId: string,
  target: ResolvedTarget
): Promise<ProgressionResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, institutionId },
    select: { id: true, status: true, semesterId: true },
  })

  const active = enrollments.find((e) => e.status === EnrollmentStatus.ACTIVE)

  if (active && active.semesterId === target.id) {
    return {
      studentId,
      outcome: 'UNCHANGED',
      message: 'Déjà inscrit dans ce semestre.',
      previous: active,
      next: { id: active.id, semesterId: active.semesterId },
    }
  }

  // Une inscription close existe déjà sur le semestre visé : la contrainte
  // d'unicité l'interdit, et la réactiver en silence masquerait un parcours
  // atypique (redoublement, retour). On le signale.
  const closed = enrollments.find(
    (e) => e.semesterId === target.id && e.status !== EnrollmentStatus.ACTIVE
  )
  if (closed) {
    return {
      studentId,
      outcome: 'CONFLICT',
      message: `Cet étudiant a déjà une inscription ${closed.status.toLowerCase()} sur ce semestre.`,
      previous: active ?? null,
    }
  }

  try {
    const next = await prisma.$transaction(async (tx) => {
      if (active) {
        await tx.enrollment.update({
          where: { id: active.id },
          data: { status: EnrollmentStatus.COMPLETED },
        })
      }

      return tx.enrollment.create({
        data: {
          institutionId,
          userId: studentId,
          programId: target.programId,
          semesterId: target.id,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true, semesterId: true },
      })
    })

    return {
      studentId,
      outcome: active ? 'PROGRESSED' : 'ENROLLED',
      previous: active ?? null,
      next,
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return {
        studentId,
        outcome: 'CONFLICT',
        message: 'Une inscription existe déjà sur ce semestre.',
        previous: active ?? null,
      }
    }
    throw error
  }
}

/** Étudiants actifs d'une cohorte source, dans l'ordre d'affichage. */
export async function cohortStudents(
  institutionId: string,
  source: { programId: string; semesterId: string }
) {
  return prisma.enrollment.findMany({
    where: {
      institutionId,
      programId: source.programId,
      semesterId: source.semesterId,
      status: EnrollmentStatus.ACTIVE,
    },
    orderBy: { enrolledAt: 'asc' },
    select: {
      userId: true,
      user: { select: { firstName: true, lastName: true, email: true } },
    },
  })
}

/* ------------------------------------------------- annulation ------------ */

/**
 * Réouverture d'une inscription close : l'annulation d'une progression.
 *
 * Le statut appliqué à l'inscription qu'on quitte mérite d'être explicité.
 * `COMPLETED` signifie « l'étudiant a suivi ce semestre » ; or une progression
 * annulée n'a jamais eu lieu du point de vue académique. L'inscription
 * abandonnée reçoit donc **`WITHDRAWN`**, qui dit exactement cela :
 * rattachement retiré, pas semestre accompli. Le parcours reste lisible — on
 * distingue un semestre validé d'une erreur corrigée.
 *
 * Rien n'est supprimé : ni l'inscription, ni la progression pédagogique.
 */
export interface ReopenResult {
  outcome: 'REOPENED' | 'UNCHANGED' | 'CONFLICT' | 'NOT_FOUND'
  message?: string
  reopened?: { id: string; semesterId: string } | null
  closed?: { id: string; semesterId: string; status: EnrollmentStatus } | null
}

export async function reopenEnrollment(
  institutionId: string,
  studentId: string,
  enrollmentIdToReopen: string,
  expectedCurrentEnrollmentId?: string
): Promise<ReopenResult> {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: studentId, institutionId },
    select: { id: true, status: true, semesterId: true },
  })

  const target = enrollments.find((e) => e.id === enrollmentIdToReopen)
  if (!target) {
    return {
      outcome: 'NOT_FOUND',
      message: 'Inscription introuvable pour cet étudiant.',
    }
  }

  if (target.status === EnrollmentStatus.ACTIVE) {
    return {
      outcome: 'UNCHANGED',
      message: 'Cette inscription est déjà active.',
      reopened: { id: target.id, semesterId: target.semesterId },
    }
  }

  const actives = enrollments.filter(
    (e) => e.status === EnrollmentStatus.ACTIVE
  )

  // Garde-fou d'accord : si l'appelant annonce l'inscription active qu'il
  // pense fermer et qu'elle a changé entre-temps, on refuse plutôt que
  // d'agir sur un état différent de celui affiché.
  if (
    expectedCurrentEnrollmentId &&
    !actives.some((e) => e.id === expectedCurrentEnrollmentId)
  ) {
    return {
      outcome: 'CONFLICT',
      message:
        'L’inscription active a changé depuis l’affichage. Rechargez la page.',
    }
  }

  const closedList = await prisma.$transaction(async (tx) => {
    // Toutes les inscriptions actives sont fermées : deux inscriptions
    // actives cumuleraient les cours de deux semestres.
    for (const active of actives) {
      await tx.enrollment.update({
        where: { id: active.id },
        data: { status: EnrollmentStatus.WITHDRAWN },
      })
    }

    await tx.enrollment.update({
      where: { id: target.id },
      data: { status: EnrollmentStatus.ACTIVE },
    })

    return actives
  })

  return {
    outcome: 'REOPENED',
    reopened: { id: target.id, semesterId: target.semesterId },
    closed: closedList[0]
      ? {
          id: closedList[0].id,
          semesterId: closedList[0].semesterId,
          status: EnrollmentStatus.WITHDRAWN,
        }
      : null,
  }
}
