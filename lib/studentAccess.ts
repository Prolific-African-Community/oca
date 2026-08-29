import type { NextApiRequest, NextApiResponse } from 'next';
import { ContentStatus, CourseStatus, EnrollmentStatus, QuizStatus, Role } from '@prisma/client';
import { prisma } from './prisma';
import { requireInstitutionRole } from './serverAuth';
import type { SafeUser } from './serverAuth';

/**
 * Accès des étudiants aux contenus pédagogiques.
 *
 * Un étudiant n'accède qu'aux cours des semestres où il est **inscrit**
 * (`Enrollment` actif), dans son établissement, et uniquement aux contenus
 * publiés. L'identité vient de la session : ni `userId` ni `institutionId`
 * ne sont lus dans la requête.
 */

/** Ne montrer que ce qui est publié : les brouillons appartiennent à l'enseignant. */
export const PUBLISHED_CONTENT = { status: ContentStatus.PUBLISHED } as const;

export interface StudentScope {
  user: SafeUser;
  institutionId: string;
  /** Semestres où l'étudiant a une inscription active. */
  semesterIds: string[];
}

/** Session étudiante + périmètre d'inscriptions actives. Répond 401/403 si refusé. */
export async function requireStudent(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<StudentScope | null> {
  const scope = await requireInstitutionRole(req, res, Role.STUDENT);
  if (!scope) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: scope.user.id,
      institutionId: scope.institutionId,
      status: EnrollmentStatus.ACTIVE,
    },
    select: { semesterId: true },
  });

  return {
    user: scope.user,
    institutionId: scope.institutionId,
    semesterIds: enrollments.map((e) => e.semesterId),
  };
}

/** Clause Prisma des cours accessibles à un étudiant : inscrits, publiés, bon tenant. */
export function accessibleCourseWhere(scope: StudentScope) {
  return {
    institutionId: scope.institutionId,
    semesterId: { in: scope.semesterIds },
    status: CourseStatus.PUBLISHED,
  };
}

export interface CourseAccess extends StudentScope {
  courseId: string;
}

/**
 * Accès à un cours précis. Répond 404 — et non 403 — si le cours existe mais
 * n'est pas accessible : ne pas transformer la route en oracle d'existence.
 */
export async function requireEnrolledCourse(
  req: NextApiRequest,
  res: NextApiResponse,
  courseId: unknown
): Promise<CourseAccess | null> {
  const scope = await requireStudent(req, res);
  if (!scope) return null;

  if (typeof courseId !== 'string' || !courseId) {
    res.status(400).json({ message: 'Identifiant de cours manquant' });
    return null;
  }

  const course = await prisma.course.findFirst({
    where: { id: courseId, ...accessibleCourseWhere(scope) },
    select: { id: true },
  });

  if (!course) {
    res.status(404).json({ message: 'Cours introuvable' });
    return null;
  }

  return { ...scope, courseId };
}

export interface LessonAccess extends StudentScope {
  lessonId: string;
  moduleId: string;
  courseId: string;
}

/**
 * Accès à une leçon précise : publiée, dans un module publié, d'un cours d'un
 * semestre où l'étudiant est inscrit. Renvoie aussi son module et son cours,
 * qui servent à enregistrer la progression sans jamais faire confiance au client.
 */
export async function requireAccessibleLesson(
  req: NextApiRequest,
  res: NextApiResponse,
  lessonId: unknown
): Promise<LessonAccess | null> {
  const scope = await requireStudent(req, res);
  if (!scope) return null;

  if (typeof lessonId !== 'string' || !lessonId || scope.semesterIds.length === 0) {
    res.status(404).json({ message: 'Leçon introuvable' });
    return null;
  }

  const lesson = await prisma.lesson.findFirst({
    where: {
      id: lessonId,
      status: ContentStatus.PUBLISHED,
      module: {
        status: ContentStatus.PUBLISHED,
        course: accessibleCourseWhere(scope),
      },
    },
    select: { id: true, moduleId: true, module: { select: { courseId: true } } },
  });

  if (!lesson) {
    res.status(404).json({ message: 'Leçon introuvable' });
    return null;
  }

  return {
    ...scope,
    lessonId: lesson.id,
    moduleId: lesson.moduleId,
    courseId: lesson.module.courseId,
  };
}

export interface QuizAccess extends StudentScope {
  quizId: string;
  courseId: string;
}

/**
 * Accès étudiant à un quiz : publié, rattaché à un cours d'un semestre où
 * l'étudiant est inscrit. Toute autre situation renvoie 404.
 */
export async function requireAccessibleQuiz(
  req: NextApiRequest,
  res: NextApiResponse,
  quizId: unknown
): Promise<QuizAccess | null> {
  const scope = await requireStudent(req, res);
  if (!scope) return null;

  if (typeof quizId !== 'string' || !quizId || scope.semesterIds.length === 0) {
    res.status(404).json({ message: 'Quiz introuvable' });
    return null;
  }

  const quiz = await prisma.quiz.findFirst({
    where: {
      id: quizId,
      status: QuizStatus.PUBLISHED,
      course: accessibleCourseWhere(scope),
    },
    select: { id: true, courseId: true },
  });

  if (!quiz) {
    res.status(404).json({ message: 'Quiz introuvable' });
    return null;
  }

  return { ...scope, quizId: quiz.id, courseId: quiz.courseId };
}
