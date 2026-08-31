import { PrismaClient } from '@prisma/client'

/**
 * Empreinte des données réelles, pour prouver qu'une exécution du seed de
 * démonstration ne les a pas touchées.
 *
 * Lecture seule. À exécuter avant puis après `npm run seed:studio-test` :
 *   npx tsx scripts/check-demo-isolation.ts
 */

const prisma = new PrismaClient()

const REAL_COURSES = ['COMPTA-101', 'MICRO-101']

async function main() {
  const courses = await prisma.course.findMany({
    where: { code: { in: REAL_COURSES } },
    select: {
      code: true,
      status: true,
      updatedAt: true,
      modules: {
        orderBy: { order: 'asc' },
        select: {
          title: true,
          status: true,
          updatedAt: true,
          lessons: {
            orderBy: { order: 'asc' },
            select: {
              title: true,
              status: true,
              content: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  })

  const fingerprint = courses.map((course) => ({
    code: course.code,
    status: course.status,
    updatedAt: course.updatedAt.toISOString(),
    modules: course.modules.map((module) => ({
      title: module.title,
      status: module.status,
      updatedAt: module.updatedAt.toISOString(),
      lessons: module.lessons.map((lesson) => ({
        title: lesson.title,
        status: lesson.status,
        length: (lesson.content ?? '').length,
        updatedAt: lesson.updatedAt.toISOString(),
      })),
    })),
  }))

  const demo = await prisma.institution.findUnique({
    where: { slug: 'demo-studio' },
    select: {
      id: true,
      _count: { select: { courses: true, members: true } },
    },
  })

  const demoCourse = await prisma.course.findFirst({
    where: { code: 'TEST-COURSE-STUDIO' },
    select: {
      id: true,
      status: true,
      _count: { select: { modules: true, quizzes: true } },
      modules: { select: { _count: { select: { lessons: true } } } },
    },
  })

  console.log(
    JSON.stringify(
      {
        real: fingerprint,
        demoInstitution: demo,
        demoCourse: demoCourse && {
          id: demoCourse.id,
          status: demoCourse.status,
          modules: demoCourse._count.modules,
          quizzes: demoCourse._count.quizzes,
          lessons: demoCourse.modules.reduce(
            (n, m) => n + m._count.lessons,
            0
          ),
        },
      },
      null,
      2
    )
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
