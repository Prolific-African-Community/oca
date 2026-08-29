import {
  AttemptStatus,
  ContentStatus,
  EnrollmentStatus,
  ProgressStatus,
  Role,
} from '@prisma/client'
import { prisma } from './prisma'

function percentage(value: number, total: number): number {
  return total > 0 ? Math.round((value / total) * 100) : 0
}

/** Construit les analytics d'un seul cours déjà autorisé par l'appelant. */
export async function getTeacherCourseAnalytics(courseId: string) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      institutionId: true,
      programId: true,
      semesterId: true,
      title: true,
      code: true,
    },
  })
  if (!course) return null

  const [enrollments, modules, quizzes] = await Promise.all([
    prisma.enrollment.findMany({
      where: {
        institutionId: course.institutionId,
        programId: course.programId,
        semesterId: course.semesterId,
        status: EnrollmentStatus.ACTIVE,
        user: {
          isActive: true,
          memberships: {
            some: {
              institutionId: course.institutionId,
              role: Role.STUDENT,
              isActive: true,
            },
          },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
      select: {
        userId: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.module.findMany({
      where: { courseId: course.id, status: ContentStatus.PUBLISHED },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        order: true,
        lessons: {
          where: { status: ContentStatus.PUBLISHED },
          orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, title: true, order: true },
        },
      },
    }),
    prisma.quiz.findMany({
      where: { courseId: course.id },
      select: { id: true, title: true, status: true },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  const studentIds = enrollments.map((enrollment) => enrollment.userId)
  const lessons = modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      ...lesson,
      moduleId: module.id,
      moduleTitle: module.title,
    }))
  )
  const lessonIds = lessons.map((lesson) => lesson.id)
  const quizIds = quizzes.map((quiz) => quiz.id)

  const [progressRows, attempts] = await Promise.all([
    studentIds.length > 0 && lessonIds.length > 0
      ? prisma.lessonProgress.findMany({
          where: {
            userId: { in: studentIds },
            courseId: course.id,
            lessonId: { in: lessonIds },
          },
          select: { userId: true, lessonId: true, status: true },
        })
      : [],
    studentIds.length > 0 && quizIds.length > 0
      ? prisma.quizAttempt.findMany({
          where: { userId: { in: studentIds }, quizId: { in: quizIds } },
          select: {
            userId: true,
            quizId: true,
            status: true,
            score: true,
            maxScore: true,
          },
        })
      : [],
  ])

  const completedRows = progressRows.filter(
    (row) => row.status === ProgressStatus.COMPLETED
  )
  const submittedAttempts = attempts.filter(
    (attempt) => attempt.status === AttemptStatus.SUBMITTED
  )
  const scoredAttempts = submittedAttempts.filter(
    (attempt) =>
      attempt.score !== null &&
      attempt.maxScore !== null &&
      attempt.maxScore > 0
  )
  const averageQuizScore =
    scoredAttempts.length > 0
      ? Math.round(
          scoredAttempts.reduce(
            (sum, attempt) =>
              sum + ((attempt.score ?? 0) / (attempt.maxScore ?? 1)) * 100,
            0
          ) / scoredAttempts.length
        )
      : null

  const moduleProgress = modules.map((module) => {
    const moduleLessonIds = new Set(module.lessons.map((lesson) => lesson.id))
    const completionCount = completedRows.filter((row) =>
      moduleLessonIds.has(row.lessonId)
    ).length
    return {
      id: module.id,
      title: module.title,
      order: module.order,
      publishedLessonCount: module.lessons.length,
      completionCount,
      completionPercentage: percentage(
        completionCount,
        enrollments.length * module.lessons.length
      ),
    }
  })

  const lessonProgress = lessons.map((lesson) => {
    const completionCount = completedRows.filter(
      (row) => row.lessonId === lesson.id
    ).length
    return {
      id: lesson.id,
      title: lesson.title,
      moduleId: lesson.moduleId,
      moduleTitle: lesson.moduleTitle,
      completionCount,
      completionPercentage: percentage(completionCount, enrollments.length),
    }
  })

  const quizPerformance = quizzes.map((quiz) => {
    const quizAttempts = submittedAttempts.filter(
      (attempt) => attempt.quizId === quiz.id
    )
    const scored = quizAttempts.filter(
      (attempt) =>
        attempt.score !== null &&
        attempt.maxScore !== null &&
        attempt.maxScore > 0
    )
    return {
      id: quiz.id,
      title: quiz.title,
      status: quiz.status,
      submittedAttemptCount: quizAttempts.length,
      averageScore:
        scored.length > 0
          ? Math.round(
              scored.reduce(
                (sum, attempt) =>
                  sum + ((attempt.score ?? 0) / (attempt.maxScore ?? 1)) * 100,
                0
              ) / scored.length
            )
          : null,
    }
  })

  const students = enrollments.map((enrollment) => {
    const studentProgress = progressRows.filter(
      (row) => row.userId === enrollment.userId
    )
    const completedLessons = studentProgress.filter(
      (row) => row.status === ProgressStatus.COMPLETED
    ).length
    const studentAttempts = attempts.filter(
      (attempt) => attempt.userId === enrollment.userId
    )
    const studentSubmitted = studentAttempts.filter(
      (attempt) => attempt.status === AttemptStatus.SUBMITTED
    )
    const studentScored = studentSubmitted.filter(
      (attempt) =>
        attempt.score !== null &&
        attempt.maxScore !== null &&
        attempt.maxScore > 0
    )
    const hasActivity = studentProgress.length > 0 || studentAttempts.length > 0
    const completedAllLessons =
      lessonIds.length > 0 && completedLessons === lessonIds.length

    return {
      id: enrollment.userId,
      name:
        [enrollment.user.firstName, enrollment.user.lastName]
          .filter(Boolean)
          .join(' ') || enrollment.user.email,
      email: enrollment.user.email,
      completedLessons,
      publishedLessonCount: lessonIds.length,
      completionPercentage: percentage(completedLessons, lessonIds.length),
      submittedAttemptCount: studentSubmitted.length,
      averageQuizScore:
        studentScored.length > 0
          ? Math.round(
              studentScored.reduce(
                (sum, attempt) =>
                  sum + ((attempt.score ?? 0) / (attempt.maxScore ?? 1)) * 100,
                0
              ) / studentScored.length
            )
          : null,
      activityStatus: !hasActivity
        ? ('NO_ACTIVITY' as const)
        : completedAllLessons
        ? ('COMPLETED' as const)
        : ('IN_PROGRESS' as const),
    }
  })

  return {
    course: { title: course.title, code: course.code },
    enrolledStudentCount: enrollments.length,
    publishedModuleCount: modules.length,
    publishedLessonCount: lessonIds.length,
    lessonCompletionCount: completedRows.length,
    courseCompletionPercentage: percentage(
      completedRows.length,
      enrollments.length * lessonIds.length
    ),
    moduleProgress,
    lessonProgress,
    quizCount: quizzes.length,
    submittedAttemptCount: submittedAttempts.length,
    averageQuizScore,
    studentsWithNoActivity: students.filter(
      (student) => student.activityStatus === 'NO_ACTIVITY'
    ).length,
    studentsInProgress: students.filter(
      (student) => student.activityStatus === 'IN_PROGRESS'
    ).length,
    studentsCompletedAllLessons: students.filter(
      (student) => student.activityStatus === 'COMPLETED'
    ).length,
    quizPerformance,
    students,
  }
}

export type TeacherCourseAnalytics = NonNullable<
  Awaited<ReturnType<typeof getTeacherCourseAnalytics>>
>
