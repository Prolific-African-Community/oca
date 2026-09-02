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
  QuizStatus,
  QuestionType,
} from '@prisma/client'
import bcrypt from 'bcryptjs'

/**
 * Jeu de données de démonstration pour le Course Studio.
 *
 * Raison d'être : les runs précédents ont testé publication, dépublication et
 * génération assistée sur COMPTA-101 et MICRO-101, c'est-à-dire sur du contenu
 * réel, restauré ensuite à la main. Une interruption au mauvais moment y
 * laisserait du contenu publié ou modifié par erreur.
 *
 * Ce script crée un **établissement séparé**, avec ses propres comptes et son
 * propre cours. L'isolation ne repose donc pas sur la discipline de celui qui
 * teste, mais sur le cloisonnement multi-établissements déjà appliqué partout :
 * le professeur de démonstration n'a aucun accès aux cours réels, et
 * réciproquement.
 *
 * Portée destructive : **strictement** les modules, leçons et quiz du cours
 * TEST-COURSE-STUDIO. Rien d'autre n'est supprimé — ni utilisateurs, ni
 * structure, ni journal d'audit, ni enregistrements AIGeneration.
 *
 *   npm run seed:studio-test
 */

const prisma = new PrismaClient()

const DEMO_SLUG = 'demo-studio'
const COURSE_CODE = 'TEST-COURSE-STUDIO'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Oca2026!'

/** Préfixe visible partout : personne ne doit confondre ces contenus avec un vrai cours. */
const DEMO = 'DEMO'

const STRONG_CONTENT = {
  introduction:
    "Cette leçon de démonstration sert à tester le Course Studio sur un contenu jugé solide par les indicateurs de relecture. Elle porte sur la notion de coût de revient, choisie parce qu'elle se prête à un exemple chiffré vérifiable.\n\nÀ l'issue de la séance, vous saurez distinguer les charges directes des charges indirectes, calculer un coût de revient unitaire et expliquer pourquoi deux méthodes de répartition peuvent conduire à deux décisions commerciales différentes.",
  keyConcepts: [
    "Une charge directe est affectable à un produit sans calcul intermédiaire : la matière première consommée par ce produit en est le cas typique.",
    "Une charge indirecte concerne plusieurs produits à la fois et doit être répartie selon une clé, ce qui introduit une part de convention dans le résultat.",
    "Le coût de revient unitaire est la somme des charges directes et de la quote-part de charges indirectes, divisée par le nombre d'unités produites.",
    "Le choix de la clé de répartition n'est pas neutre : il déplace de la marge d'un produit vers un autre sans modifier le résultat global de l'entreprise.",
  ],
  explanation:
    "La comptabilité de gestion cherche à répondre à une question simple en apparence : combien coûte réellement une unité produite ? La difficulté ne vient pas des charges directes, qui se rattachent sans ambiguïté à un produit, mais des charges indirectes, qui bénéficient à plusieurs produits simultanément.\n\nPrenons le loyer d'un atelier où sont fabriqués deux produits. Ce loyer est engagé globalement ; aucune facture ne dit quelle part revient à chaque produit. Il faut donc choisir une clé de répartition : les heures de main-d'œuvre, les heures machine, les surfaces occupées, le nombre d'unités produites. Chacune est défendable, et chacune donne un coût de revient différent.\n\nC'est ici que réside le point délicat, souvent mal compris. La répartition ne crée ni ne détruit de charge : le total reste identique. Elle déplace seulement la charge d'un produit vers un autre. Un produit peut donc apparaître rentable avec une clé et déficitaire avec une autre, sans que rien n'ait changé dans l'atelier. Une décision d'abandon fondée sur un coût de revient mal construit peut ainsi supprimer un produit qui contribuait effectivement à couvrir les charges fixes.\n\nLa méthode dite des centres d'analyse consiste à regrouper les charges indirectes par centre — approvisionnement, production, distribution — puis à répartir chaque centre avec une clé qui lui est propre, plutôt qu'une clé unique pour l'ensemble. Elle réduit l'arbitraire sans le supprimer : le choix de la clé reste une décision de gestion, pas une donnée comptable.\n\nErreur fréquente à éviter : confondre coût de revient et prix de vente. Le coût de revient est une constatation interne, le prix de vente une décision commerciale qui dépend aussi du marché et de la concurrence.",
  practicalExample:
    "Un atelier fabrique 500 unités du produit A et 1 500 unités du produit B au cours du mois.\n\nCharges directes : 6 000 euros pour A, 12 000 euros pour B. Charges indirectes de l'atelier : 8 000 euros. La main-d'œuvre représente 400 heures pour A et 400 heures pour B.\n\nAvec une répartition au nombre d'unités, A reçoit 8 000 * 500 / 2 000 = 2 000 euros, soit un coût de revient unitaire de (6 000 + 2 000) / 500 = 16 euros. Avec une répartition aux heures de main-d'œuvre, A reçoit 8 000 * 400 / 800 = 4 000 euros, soit (6 000 + 4 000) / 500 = 20 euros par unité.\n\nSi le prix de vente de A est de 18 euros, la première méthode le déclare bénéficiaire et la seconde déficitaire. Le total des charges réparties reste pourtant 8 000 euros dans les deux cas.",
  recap:
    "Vous devez savoir séparer charges directes et indirectes sur un énoncé simple, calculer un coût de revient unitaire à partir d'une clé de répartition donnée, et expliquer en quoi le changement de clé modifie la lecture de la rentabilité d'un produit sans modifier le résultat de l'entreprise. Vous devez également pouvoir formuler la réserve à joindre à tout coût de revient : il dépend d'une convention de répartition, qu'il faut expliciter avant de fonder une décision dessus.",
  exercises: [
    "Un atelier produit 800 unités de X et 200 unités de Y. Charges directes : 4 000 euros pour X et 3 000 euros pour Y. Charges indirectes : 5 000 euros. Calculez le coût de revient unitaire de chaque produit avec une répartition au nombre d'unités, puis avec une répartition proportionnelle aux charges directes. Indiquez laquelle des deux méthodes rend Y bénéficiaire si son prix de vente est de 30 euros.",
    "Reprenez l'exemple pratique de la leçon. L'entreprise envisage d'abandonner le produit A au motif qu'il est déficitaire selon la répartition aux heures de main-d'œuvre. Rédigez en dix lignes l'argument que vous opposeriez à cette décision, en précisant quelle information manque pour trancher.",
  ],
}

/** Leçon volontairement maigre : elle doit ressortir en « Trop légère ». */
const WEAK_CONTENT = {
  introduction: "Leçon de démonstration volontairement incomplète.",
  keyConcepts: ["L'amortissement répartit le coût d'un bien sur sa durée d'usage."],
  explanation:
    "L'amortissement constate la perte de valeur d'une immobilisation. Le mode linéaire répartit cette perte en parts égales sur la durée d'utilisation prévue.",
  practicalExample: '',
  recap: '',
  exercises: [] as string[],
}

async function upsertUser(input: {
  email: string
  firstName: string
  lastName: string
  passwordHash: string
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: { firstName: input.firstName, lastName: input.lastName },
    create: input,
  })
}

/** Repli texte, construit comme le fait l'application. */
function plainFrom(content: typeof STRONG_CONTENT | typeof WEAK_CONTENT) {
  return [
    content.introduction,
    content.keyConcepts.join('\n'),
    content.explanation,
    content.practicalExample,
    content.recap,
    content.exercises.join('\n'),
  ]
    .filter((part) => part.trim())
    .join('\n\n')
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)

  const institution = await prisma.institution.upsert({
    where: { slug: DEMO_SLUG },
    update: { status: InstitutionStatus.ACTIVE },
    create: {
      name: `${DEMO} — Université de démonstration`,
      slug: DEMO_SLUG,
      country: 'CI',
      status: InstitutionStatus.ACTIVE,
    },
  })

  const admin = await upsertUser({
    email: 'admin.demo@demo-studio.oca.africa',
    firstName: 'Demo',
    lastName: 'Admin',
    passwordHash,
  })
  const professor = await upsertUser({
    email: 'prof.demo@demo-studio.oca.africa',
    firstName: 'Demo',
    lastName: 'Professeur',
    passwordHash,
  })
  const student = await upsertUser({
    email: 'etudiant.demo@demo-studio.oca.africa',
    firstName: 'Demo',
    lastName: 'Étudiant',
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

  /* --------------------------------------------------------------------
   * Structure académique minimale, propre à l'établissement de démonstration
   * ------------------------------------------------------------------ */

  const campus = await prisma.campus.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'DEMO' },
    },
    update: {},
    create: {
      institutionId: institution.id,
      name: `${DEMO} — Campus de démonstration`,
      code: 'DEMO',
      city: 'Abidjan',
      isMain: true,
    },
  })

  const faculty = await prisma.faculty.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'DEMO-FAC' },
    },
    update: { campusId: campus.id },
    create: {
      institutionId: institution.id,
      campusId: campus.id,
      name: `${DEMO} — Faculté de démonstration`,
      code: 'DEMO-FAC',
    },
  })

  const department = await prisma.department.upsert({
    where: { facultyId_code: { facultyId: faculty.id, code: 'DEMO-DEP' } },
    update: {},
    create: {
      facultyId: faculty.id,
      name: `${DEMO} — Département de démonstration`,
      code: 'DEMO-DEP',
    },
  })

  const cycle = await prisma.cycle.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'DEMO-L' },
    },
    update: {},
    create: {
      institutionId: institution.id,
      level: CycleLevel.LICENCE,
      name: `${DEMO} — Licence`,
      code: 'DEMO-L',
      durationYears: 3,
      totalCredits: 180,
    },
  })

  const program = await prisma.program.upsert({
    where: {
      institutionId_code: { institutionId: institution.id, code: 'DEMO-PROG' },
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
      name: `${DEMO} — Programme de démonstration`,
      code: 'DEMO-PROG',
      durationYears: 3,
      status: AcademicStatus.ACTIVE,
    },
  })

  const academicYear = await prisma.academicYear.upsert({
    where: {
      institutionId_name: {
        institutionId: institution.id,
        name: 'DEMO 2025-2026',
      },
    },
    update: { isCurrent: true, status: AcademicStatus.ACTIVE },
    create: {
      institutionId: institution.id,
      name: 'DEMO 2025-2026',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-07-31'),
      isCurrent: true,
      status: AcademicStatus.ACTIVE,
    },
  })

  const semester = await prisma.semester.upsert({
    where: {
      programId_academicYearId_number: {
        programId: program.id,
        academicYearId: academicYear.id,
        number: 1,
      },
    },
    update: { status: AcademicStatus.ACTIVE },
    create: {
      programId: program.id,
      academicYearId: academicYear.id,
      number: 1,
      name: 'DEMO Semestre 1',
      startDate: new Date('2025-10-01'),
      endDate: new Date('2026-02-15'),
      status: AcademicStatus.ACTIVE,
    },
  })

  const course = await prisma.course.upsert({
    where: {
      semesterId_code: { semesterId: semester.id, code: COURSE_CODE },
    },
    update: {
      status: CourseStatus.PUBLISHED,
      facultyId: faculty.id,
      departmentId: department.id,
    },
    create: {
      institutionId: institution.id,
      programId: program.id,
      semesterId: semester.id,
      facultyId: faculty.id,
      departmentId: department.id,
      title: `${DEMO} — Cours de test Course Studio`,
      code: COURSE_CODE,
      description:
        "Cours de démonstration réservé aux tests du Course Studio. Aucun contenu n'y a de valeur pédagogique : il peut être publié, dépublié, modifié ou réinitialisé à tout moment.",
      credits: 3,
      coefficient: 1,
      order: 1,
      status: CourseStatus.PUBLISHED,
    },
  })

  await prisma.courseAssignment.upsert({
    where: { courseId_userId: { courseId: course.id, userId: professor.id } },
    update: { role: TeacherAssignmentRole.LEAD },
    create: {
      courseId: course.id,
      userId: professor.id,
      role: TeacherAssignmentRole.LEAD,
    },
  })

  await prisma.enrollment.upsert({
    where: { userId_semesterId: { userId: student.id, semesterId: semester.id } },
    update: { status: EnrollmentStatus.ACTIVE },
    create: {
      userId: student.id,
      institutionId: institution.id,
      programId: program.id,
      semesterId: semester.id,
      status: EnrollmentStatus.ACTIVE,
    },
  })

  /* --------------------------------------------------------------------
   * Réinitialisation du contenu pédagogique
   *
   * Modules et leçons n'ont pas de clé naturelle : ils sont recréés à
   * chaque exécution. La suppression est bornée à ce cours précis — le
   * `courseId` vient d'être résolu ci-dessus, jamais d'un paramètre.
   * ------------------------------------------------------------------ */

  const removedQuizzes = await prisma.quiz.deleteMany({
    where: { courseId: course.id },
  })
  const removedModules = await prisma.module.deleteMany({
    where: { courseId: course.id },
  })

  const publishedModule = await prisma.module.create({
    data: {
      courseId: course.id,
      title: `${DEMO} M1 — Module publié`,
      description:
        'Module publié, contenant une leçon publiée solide et une leçon en brouillon trop légère.',
      order: 0,
      status: ContentStatus.PUBLISHED,
    },
  })

  const draftModule = await prisma.module.create({
    data: {
      courseId: course.id,
      title: `${DEMO} M2 — Module brouillon`,
      description:
        'Module en brouillon : ses leçons restent invisibles aux étudiants, même publiées.',
      order: 1,
      status: ContentStatus.DRAFT,
    },
  })

  // 1. Structurée, solide, publiée : cas nominal côté étudiant.
  const strongLesson = await prisma.lesson.create({
    data: {
      moduleId: publishedModule.id,
      title: `${DEMO} L1 — Leçon structurée solide (publiée)`,
      content: plainFrom(STRONG_CONTENT),
      contentJson: STRONG_CONTENT,
      order: 0,
      estimatedMinutes: 20,
      status: ContentStatus.PUBLISHED,
    },
  })

  // 2. Structurée, trop légère, brouillon : déclenche la confirmation de publication.
  await prisma.lesson.create({
    data: {
      moduleId: publishedModule.id,
      title: `${DEMO} L2 — Leçon trop légère (brouillon)`,
      content: plainFrom(WEAK_CONTENT),
      contentJson: WEAK_CONTENT,
      order: 1,
      estimatedMinutes: 45,
      status: ContentStatus.DRAFT,
    },
  })

  // 3. Texte simple, sans contenu structuré : vérifie le repli de l'éditeur.
  await prisma.lesson.create({
    data: {
      moduleId: draftModule.id,
      title: `${DEMO} L3 — Leçon en texte simple (brouillon)`,
      content:
        "Leçon de démonstration sans contenu structuré. Elle sert à vérifier que le Course Studio bascule bien sur son repli texte, et que le premier enregistrement d'une section la convertit sans perdre ce texte.\n\nLe rapprochement bancaire consiste à expliquer l'écart entre le solde du compte banque tenu par l'entreprise et le solde figurant sur le relevé bancaire, à une date donnée.",
      contentJson: undefined,
      order: 0,
      estimatedMinutes: 15,
      status: ContentStatus.DRAFT,
    },
  })

  // 4. Publiée dans un module brouillon : cas de visibilité le plus trompeur.
  await prisma.lesson.create({
    data: {
      moduleId: draftModule.id,
      title: `${DEMO} L4 — Leçon publiée dans un module brouillon`,
      content: plainFrom(STRONG_CONTENT),
      contentJson: STRONG_CONTENT,
      order: 1,
      estimatedMinutes: 20,
      status: ContentStatus.PUBLISHED,
    },
  })

  const publishedQuiz = await prisma.quiz.create({
    data: {
      institutionId: institution.id,
      courseId: course.id,
      moduleId: publishedModule.id,
      lessonId: strongLesson.id,
      title: `${DEMO} Quiz publié`,
      description:
        "Quiz de démonstration. Les résultats sont un retour d'apprentissage, jamais une note officielle.",
      status: QuizStatus.PUBLISHED,
      passingScore: 60,
      order: 0,
    },
  })

  await prisma.quizQuestion.createMany({
    data: [
      {
        quizId: publishedQuiz.id,
        prompt:
          'Une charge indirecte peut-elle être affectée à un produit sans clé de répartition ?',
        type: QuestionType.TRUE_FALSE,
        correctAnswer: false,
        explanation:
          "Par définition, une charge indirecte concerne plusieurs produits : elle exige une clé.",
        points: 1,
        order: 0,
      },
      {
        quizId: publishedQuiz.id,
        prompt: 'Que modifie le changement de clé de répartition ?',
        type: QuestionType.MULTIPLE_CHOICE,
        options: [
          "Le total des charges de l'entreprise",
          'La répartition de la marge entre les produits',
          'Le prix de vente des produits',
        ],
        correctAnswer: [1],
        explanation:
          'Le total reste identique ; seule la répartition entre produits change.',
        points: 1,
        order: 1,
      },
    ],
  })

  await prisma.quiz.create({
    data: {
      institutionId: institution.id,
      courseId: course.id,
      moduleId: draftModule.id,
      title: `${DEMO} Quiz brouillon sans question`,
      status: QuizStatus.DRAFT,
      order: 1,
    },
  })

  console.log('Jeu de démonstration réinitialisé.')
  console.log(`  établissement : ${institution.name} (${DEMO_SLUG})`)
  console.log(`  cours         : ${COURSE_CODE} — ${course.id}`)
  console.log(
    `  supprimés     : ${removedModules.count} module(s), ${removedQuizzes.count} quiz`
  )
  console.log('  recréés       : 2 modules, 4 leçons, 2 quiz')
  console.log('  comptes       : prof.demo@ / etudiant.demo@ / admin.demo@demo-studio.oca.africa')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
