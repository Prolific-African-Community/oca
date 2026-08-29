import {
  PrismaClient,
  Role,
  InstitutionStatus,
  AcademicStatus,
  CycleLevel,
  CourseStatus,
  ContentStatus,
  EnrollmentStatus,
  TeacherAssignmentRole,
  CompetencyLevel,
  PrerequisiteKind,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/** Mots de passe de démonstration — à remplacer avant toute mise en ligne. */
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD ?? 'Oca2026!'

async function upsertUser(input: {
  email: string
  firstName: string
  lastName: string
  passwordHash: string
  platformRole?: Role
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      platformRole: input.platformRole ?? null,
    },
    create: input,
  })
}

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  const superAdmin = await upsertUser({
    email: 'superadmin@oca.africa',
    firstName: 'Super',
    lastName: 'Admin',
    passwordHash,
    platformRole: Role.SUPER_ADMIN,
  })

  const institution = await prisma.institution.upsert({
    where: { slug: 'universite-test' },
    update: {},
    create: {
      name: 'Université de Test',
      slug: 'universite-test',
      country: 'CI',
      status: InstitutionStatus.ACTIVE,
    },
  })

  const admin = await upsertUser({
    email: 'admin@universite-test.oca.africa',
    firstName: 'Aïcha',
    lastName: 'Koné',
    passwordHash,
  })

  const professor = await upsertUser({
    email: 'professeur@universite-test.oca.africa',
    firstName: 'Moussa',
    lastName: 'Diallo',
    passwordHash,
  })

  const student = await upsertUser({
    email: 'etudiant@universite-test.oca.africa',
    firstName: 'Fatou',
    lastName: 'Traoré',
    passwordHash,
  })

  for (const [user, role] of [
    [admin, Role.ADMIN],
    [professor, Role.PROFESSOR],
    [student, Role.STUDENT],
  ] as const) {
    await prisma.institutionUser.upsert({
      where: {
        userId_institutionId_role: {
          userId: user.id,
          institutionId: institution.id,
          role,
        },
      },
      update: {},
      create: { userId: user.id, institutionId: institution.id, role },
    })
  }

  /* ----------------------------------------------------------------------
   * Structure académique de test
   * -------------------------------------------------------------------- */

  const campus = await prisma.campus.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'CENTRAL' },
    },
    update: {},
    create: {
      institutionId: institution.id,
      name: 'Campus Central',
      code: 'CENTRAL',
      city: 'Abidjan',
      isMain: true,
    },
  })

  const faculty = await prisma.faculty.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'FSEG' },
    },
    update: { campusId: campus.id },
    create: {
      institutionId: institution.id,
      campusId: campus.id,
      name: 'Faculté des Sciences Économiques et de Gestion',
      code: 'FSEG',
    },
  })

  const department = await prisma.department.upsert({
    where: { facultyId_code: { facultyId: faculty.id, code: 'GESTION' } },
    update: {},
    create: {
      facultyId: faculty.id,
      name: 'Département de Gestion',
      code: 'GESTION',
    },
  })

  const cycle = await prisma.cycle.upsert({
    where: { institutionId_code: { institutionId: institution.id, code: 'L' } },
    update: {},
    create: {
      institutionId: institution.id,
      level: CycleLevel.LICENCE,
      name: 'Licence',
      code: 'L',
      durationYears: 3,
      totalCredits: 180,
    },
  })

  const program = await prisma.program.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'LGE' },
    },
    update: {
      facultyId: faculty.id,
      departmentId: department.id,
      cycleId: cycle.id,
      status: AcademicStatus.ACTIVE,
    },
    create: {
      institutionId: institution.id,
      facultyId: faculty.id,
      departmentId: department.id,
      cycleId: cycle.id,
      name: 'Licence Gestion des Entreprises',
      code: 'LGE',
      durationYears: 3,
      status: AcademicStatus.ACTIVE,
    },
  })

  const academicYear = await prisma.academicYear.upsert({
    where: {
      institutionId_name: { institutionId: institution.id, name: '2025-2026' },
    },
    update: { isCurrent: true, status: AcademicStatus.ACTIVE },
    create: {
      institutionId: institution.id,
      name: '2025-2026',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: true,
      status: AcademicStatus.ACTIVE,
    },
  })

  const semesterSeeds = [
    {
      number: 1,
      name: 'Semestre 1',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-02-15'),
    },
    {
      number: 2,
      name: 'Semestre 2',
      startDate: new Date('2026-02-16'),
      endDate: new Date('2026-07-31'),
    },
  ]

  const semesters = []
  for (const s of semesterSeeds) {
    semesters.push(
      await prisma.semester.upsert({
        where: {
          programId_academicYearId_number: {
            programId: program.id,
            academicYearId: academicYear.id,
            number: s.number,
          },
        },
        update: { status: AcademicStatus.ACTIVE },
        create: {
          programId: program.id,
          academicYearId: academicYear.id,
          status: AcademicStatus.ACTIVE,
          ...s,
        },
      })
    )
  }

  /* ----------------------------------------------------------------------
   * Domaine pédagogique
   * -------------------------------------------------------------------- */

  const [semester1, semester2] = semesters

  const compta = await prisma.course.upsert({
    where: {
      semesterId_code: { semesterId: semester1.id, code: 'COMPTA-101' },
    },
    update: {
      status: CourseStatus.PUBLISHED,
      facultyId: faculty.id,
      departmentId: department.id,
    },
    create: {
      institutionId: institution.id,
      programId: program.id,
      semesterId: semester1.id,
      facultyId: faculty.id,
      departmentId: department.id,
      title: 'Comptabilité générale',
      code: 'COMPTA-101',
      description:
        'Principes fondamentaux de la comptabilité générale : comptes, journal, grand livre, bilan et compte de résultat.',
      credits: 6,
      coefficient: 2,
      order: 1,
      status: CourseStatus.PUBLISHED,
    },
  })

  const micro = await prisma.course.upsert({
    where: { semesterId_code: { semesterId: semester1.id, code: 'MICRO-101' } },
    update: {
      status: CourseStatus.PUBLISHED,
      facultyId: faculty.id,
      departmentId: department.id,
    },
    create: {
      institutionId: institution.id,
      programId: program.id,
      semesterId: semester1.id,
      facultyId: faculty.id,
      departmentId: department.id,
      title: 'Microéconomie',
      code: 'MICRO-101',
      description:
        'Comportement du consommateur et du producteur, formation des prix et équilibre de marché.',
      credits: 4,
      coefficient: 1.5,
      order: 2,
      status: CourseStatus.PUBLISHED,
    },
  })

  // Affectation de l'enseignant : responsable sur COMPTA-101, co-enseignant sur MICRO-101.
  await prisma.courseAssignment.upsert({
    where: { courseId_userId: { courseId: compta.id, userId: professor.id } },
    update: { role: TeacherAssignmentRole.LEAD },
    create: {
      courseId: compta.id,
      userId: professor.id,
      role: TeacherAssignmentRole.LEAD,
    },
  })

  await prisma.courseAssignment.upsert({
    where: { courseId_userId: { courseId: micro.id, userId: professor.id } },
    update: { role: TeacherAssignmentRole.CO_TEACHER },
    create: {
      courseId: micro.id,
      userId: professor.id,
      role: TeacherAssignmentRole.CO_TEACHER,
    },
  })

  // Inscription pédagogique de l'étudiant au semestre 1.
  const enrollment = await prisma.enrollment.upsert({
    where: {
      userId_semesterId: { userId: student.id, semesterId: semester1.id },
    },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      institutionId: institution.id,
      userId: student.id,
      programId: program.id,
      semesterId: semester1.id,
      status: EnrollmentStatus.ACTIVE,
    },
  })

  /* ---------------------- Modules et leçons de COMPTA-101 ---------------- */

  const moduleSeeds = [
    {
      order: 1,
      title: 'Les fondamentaux de la comptabilité',
      description: 'Vocabulaire, principes comptables et normes SYSCOHADA.',
      lessons: [
        {
          order: 1,
          title: "Le rôle de la comptabilité dans l'entreprise",
          content:
            "Définition, finalités et destinataires de l'information comptable.",
          estimatedMinutes: 90,
        },
        {
          order: 2,
          title: 'Les principes comptables fondamentaux',
          content:
            'Prudence, permanence des méthodes, indépendance des exercices, coût historique.',
          estimatedMinutes: 120,
        },
      ],
    },
    {
      order: 2,
      title: 'Les documents de synthèse',
      description: 'Construction et lecture du bilan et du compte de résultat.',
      lessons: [
        {
          order: 1,
          title: 'Construire un bilan',
          content: 'Actif, passif, équilibre du bilan et lecture patrimoniale.',
          estimatedMinutes: 120,
        },
        {
          order: 2,
          title: 'Construire un compte de résultat',
          content: 'Charges, produits, soldes intermédiaires de gestion.',
          estimatedMinutes: 120,
        },
      ],
    },
  ]

  const createdModules = []
  for (const m of moduleSeeds) {
    // Pas de contrainte unique naturelle sur Module : on identifie par (cours, titre).
    const existing = await prisma.module.findFirst({
      where: { courseId: compta.id, title: m.title },
    })

    const mod = existing
      ? await prisma.module.update({
          where: { id: existing.id },
          data: {
            description: m.description,
            order: m.order,
            status: ContentStatus.PUBLISHED,
          },
        })
      : await prisma.module.create({
          data: {
            courseId: compta.id,
            title: m.title,
            description: m.description,
            order: m.order,
            status: ContentStatus.PUBLISHED,
          },
        })

    const createdLessons = []
    for (const l of m.lessons) {
      const existingLesson = await prisma.lesson.findFirst({
        where: { moduleId: mod.id, title: l.title },
      })

      createdLessons.push(
        existingLesson
          ? await prisma.lesson.update({
              where: { id: existingLesson.id },
              data: { ...l, status: ContentStatus.PUBLISHED },
            })
          : await prisma.lesson.create({
              data: { moduleId: mod.id, ...l, status: ContentStatus.PUBLISHED },
            })
      )
    }

    createdModules.push({ module: mod, lessons: createdLessons })
  }

  /* --------------------------- Compétences ------------------------------- */

  const competencySeeds = [
    {
      scope: 'program' as const,
      title: "Analyser la situation financière d'une organisation",
      description:
        'Compétence transversale du parcours : lire, interpréter et commenter des états financiers.',
      level: CompetencyLevel.ADVANCED,
    },
    {
      scope: 'course' as const,
      title: 'Enregistrer une opération comptable',
      description:
        'Passer une écriture au journal et la reporter au grand livre.',
      level: CompetencyLevel.BEGINNER,
    },
    {
      scope: 'course' as const,
      title: 'Établir les documents de synthèse',
      description:
        "Produire un bilan et un compte de résultat à partir d'une balance.",
      level: CompetencyLevel.INTERMEDIATE,
    },
  ]

  const competencies = []
  for (const c of competencySeeds) {
    const scopeWhere =
      c.scope === 'program'
        ? { programId: program.id, courseId: null }
        : { courseId: compta.id, programId: null }

    const existing = await prisma.competency.findFirst({
      where: { institutionId: institution.id, title: c.title },
    })

    competencies.push(
      existing
        ? await prisma.competency.update({
            where: { id: existing.id },
            data: { description: c.description, level: c.level, ...scopeWhere },
          })
        : await prisma.competency.create({
            data: {
              institutionId: institution.id,
              title: c.title,
              description: c.description,
              level: c.level,
              ...scopeWhere,
            },
          })
    )
  }

  const [competenceProgramme, competenceEcriture, competenceSyntheses] =
    competencies

  // Un prérequis de compétence : savoir enregistrer avant de savoir synthétiser.
  await prisma.prerequisite.upsert({
    where: {
      competencyId_requiredCompetencyId: {
        competencyId: competenceSyntheses.id,
        requiredCompetencyId: competenceEcriture.id,
      },
    },
    update: {},
    create: {
      institutionId: institution.id,
      kind: PrerequisiteKind.COMPETENCY,
      competencyId: competenceSyntheses.id,
      requiredCompetencyId: competenceEcriture.id,
    },
  })

  /* ---------------------- Acquis d'apprentissage ------------------------- */

  const outcomeSeeds: Array<{
    title: string
    description?: string
    order: number
    courseId?: string
    moduleId?: string
    lessonId?: string
    competencyId?: string
  }> = [
    {
      title:
        "À l'issue du cours, l'étudiant sait tenir la comptabilité d'une petite entreprise",
      order: 1,
      courseId: compta.id,
      competencyId: competenceProgramme.id,
    },
    {
      title: 'Identifier les principes comptables applicables à une opération',
      order: 1,
      moduleId: createdModules[0].module.id,
      competencyId: competenceEcriture.id,
    },
    {
      title: "Produire un bilan équilibré à partir d'une balance",
      order: 1,
      moduleId: createdModules[1].module.id,
      competencyId: competenceSyntheses.id,
    },
    {
      title: "Expliquer la finalité de l'information comptable",
      order: 1,
      lessonId: createdModules[0].lessons[0].id,
    },
    {
      title: 'Distinguer charges et produits dans un compte de résultat',
      order: 1,
      lessonId: createdModules[1].lessons[1].id,
      competencyId: competenceSyntheses.id,
    },
  ]

  for (const o of outcomeSeeds) {
    const existing = await prisma.learningOutcome.findFirst({
      where: {
        title: o.title,
        courseId: o.courseId ?? null,
        moduleId: o.moduleId ?? null,
        lessonId: o.lessonId ?? null,
      },
    })

    if (existing) {
      await prisma.learningOutcome.update({
        where: { id: existing.id },
        data: o,
      })
    } else {
      await prisma.learningOutcome.create({ data: o })
    }
  }

  console.log('Seed terminé :')
  console.log(`  établissement : ${institution.name} (${institution.slug})`)
  console.log(`  super admin   : ${superAdmin.email}`)
  console.log(`  admin         : ${admin.email}`)
  console.log(`  professeur    : ${professor.email}`)
  console.log(`  étudiant      : ${student.email}`)
  console.log(
    '  mot de passe  : valeur de SEED_PASSWORD (ou repli local documenté)'
  )
  console.log(`  campus        : ${campus.name} (${campus.code})`)
  console.log(
    `  faculté       : ${faculty.code} · département ${department.code}`
  )
  console.log(
    `  cycle         : ${cycle.name} (${cycle.durationYears} ans, ${cycle.totalCredits} crédits)`
  )
  console.log(`  programme     : ${program.name} (${program.code})`)
  console.log(`  année         : ${academicYear.name}`)
  console.log(`  semestres     : ${semesters.map((s) => s.name).join(', ')}`)
  console.log(
    `  cours         : ${compta.code} (${compta.credits} cr.), ${micro.code} (${micro.credits} cr.)`
  )
  console.log(
    `  enseignant    : ${professor.email} → LEAD ${compta.code}, CO_TEACHER ${micro.code}`
  )
  console.log(
    `  inscription   : ${student.email} → ${program.code} / ${semester1.name} (${enrollment.status})`
  )
  console.log(
    `  modules       : ${createdModules.length} sur ${
      compta.code
    }, ${createdModules.reduce((n, m) => n + m.lessons.length, 0)} leçons`
  )
  console.log(`  compétences   : ${competencies.length}`)
  console.log(`  acquis        : ${outcomeSeeds.length}`)
  console.log(
    `  (semestre 2 « ${semester2.name} » volontairement laissé sans cours)`
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
