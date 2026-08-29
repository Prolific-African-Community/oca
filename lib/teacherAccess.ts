import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from './prisma';
import { requireInstitutionRole } from './serverAuth';
import type { SafeUser } from './serverAuth';

/**
 * Contrôle d'accès des enseignants aux contenus d'un cours.
 *
 * Un professeur n'accède à un cours que s'il y est **affecté**
 * (`CourseAssignment`) et que ce cours relève de son établissement.
 * L'identité et l'établissement viennent de la session ; le client ne fournit
 * qu'un identifiant de cours, de module ou de leçon, toujours revérifié ici.
 */

export interface CourseAccess {
  user: SafeUser;
  institutionId: string;
  courseId: string;
  /** Rôle de l'enseignant sur ce cours (LEAD, CO_TEACHER, ASSISTANT). */
  assignmentRole: string;
}

/** Accès à un cours par son identifiant. Répond 401/403/404 et renvoie null si refusé. */
export async function requireAssignedCourse(
  req: NextApiRequest,
  res: NextApiResponse,
  courseId: unknown
): Promise<CourseAccess | null> {
  const scope = await requireInstitutionRole(req, res, Role.PROFESSOR);
  if (!scope) return null;

  if (typeof courseId !== 'string' || !courseId) {
    res.status(400).json({ message: 'Identifiant de cours manquant' });
    return null;
  }

  const assignment = await prisma.courseAssignment.findFirst({
    where: {
      userId: scope.user.id,
      courseId,
      course: { institutionId: scope.institutionId },
    },
    select: { role: true },
  });

  // Même réponse qu'un cours inexistant : ne pas révéler l'existence d'un
  // cours auquel l'enseignant n'est pas affecté.
  if (!assignment) {
    res.status(404).json({ message: 'Cours introuvable' });
    return null;
  }

  return {
    user: scope.user,
    institutionId: scope.institutionId,
    courseId,
    assignmentRole: assignment.role,
  };
}

/** Accès à un module : résolu vers son cours, puis contrôlé comme ci-dessus. */
export async function requireAssignedModule(
  req: NextApiRequest,
  res: NextApiResponse,
  moduleId: unknown
): Promise<(CourseAccess & { moduleId: string }) | null> {
  if (typeof moduleId !== 'string' || !moduleId) {
    res.status(400).json({ message: 'Identifiant de module manquant' });
    return null;
  }

  const mod = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { id: true, courseId: true },
  });

  // Le contrôle d'affectation reste fait même si le module n'existe pas,
  // pour ne pas transformer cette route en oracle d'existence.
  const access = await requireAssignedCourse(req, res, mod?.courseId ?? 'inexistant');
  if (!access || !mod) {
    if (access && !mod) res.status(404).json({ message: 'Module introuvable' });
    return null;
  }

  return { ...access, moduleId: mod.id };
}

/** Accès à une leçon : résolue vers son module puis son cours. */
export async function requireAssignedLesson(
  req: NextApiRequest,
  res: NextApiResponse,
  lessonId: unknown
): Promise<(CourseAccess & { lessonId: string; moduleId: string }) | null> {
  if (typeof lessonId !== 'string' || !lessonId) {
    res.status(400).json({ message: 'Identifiant de leçon manquant' });
    return null;
  }

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, moduleId: true, module: { select: { courseId: true } } },
  });

  const access = await requireAssignedCourse(req, res, lesson?.module.courseId ?? 'inexistant');
  if (!access || !lesson) {
    if (access && !lesson) res.status(404).json({ message: 'Leçon introuvable' });
    return null;
  }

  return { ...access, lessonId: lesson.id, moduleId: lesson.moduleId };
}

/** Accès à un quiz : résolu vers son cours, puis contrôlé par affectation. */
export async function requireAssignedQuiz(
  req: NextApiRequest,
  res: NextApiResponse,
  quizId: unknown
): Promise<(CourseAccess & { quizId: string }) | null> {
  if (typeof quizId !== 'string' || !quizId) {
    res.status(400).json({ message: 'Identifiant de quiz manquant' });
    return null;
  }

  const quiz = await prisma.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, courseId: true },
  });

  const access = await requireAssignedCourse(req, res, quiz?.courseId ?? 'inexistant');
  if (!access || !quiz) {
    if (access && !quiz) res.status(404).json({ message: 'Quiz introuvable' });
    return null;
  }

  return { ...access, quizId: quiz.id };
}

/** Accès à une question : résolue vers son quiz puis son cours. */
export async function requireAssignedQuestion(
  req: NextApiRequest,
  res: NextApiResponse,
  questionId: unknown
): Promise<(CourseAccess & { quizId: string; questionId: string }) | null> {
  if (typeof questionId !== 'string' || !questionId) {
    res.status(400).json({ message: 'Identifiant de question manquant' });
    return null;
  }

  const question = await prisma.quizQuestion.findUnique({
    where: { id: questionId },
    select: { id: true, quizId: true, quiz: { select: { courseId: true } } },
  });

  const access = await requireAssignedCourse(req, res, question?.quiz.courseId ?? 'inexistant');
  if (!access || !question) {
    if (access && !question) res.status(404).json({ message: 'Question introuvable' });
    return null;
  }

  return { ...access, quizId: question.quizId, questionId: question.id };
}
