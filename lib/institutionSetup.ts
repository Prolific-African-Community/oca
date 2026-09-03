/**
 * Mise en route d'un établissement.
 *
 * Les sept étapes suivent l'ordre des dépendances réelles : sans faculté pas
 * de programme, sans programme pas de semestre, sans semestre pas de cours,
 * sans cours rien à enseigner. Chacune est vraie ou fausse d'après la base —
 * rien n'est estimé.
 *
 * Ce module existe pour une raison précise : le cockpit et la fiche d'un
 * établissement affichent le même avancement. S'ils le calculaient chacun de
 * leur côté, ils finiraient par se contredire, et un écran qui se contredit
 * ne mérite plus aucune confiance.
 */

export interface SetupCounts {
  faculties: number
  programs: number
  academicYears: number
  semesters: number
  courses: number
  professors: number
  students: number
}

export type SetupStepKey =
  | 'faculty'
  | 'program'
  | 'academicYear'
  | 'semester'
  | 'course'
  | 'professor'
  | 'student'

export type SetupProgress = Record<SetupStepKey, boolean>

/**
 * Libellés et explications des étapes.
 *
 * L'explication dit pourquoi l'étape compte — pas seulement ce qui manque.
 * `ownedByAdmin` marque les étapes que le super administrateur ne peut pas
 * réaliser lui-même : elles relèvent de l'administrateur de l'établissement,
 * et l'écran doit le dire plutôt que d'offrir un bouton sans effet.
 */
export const SETUP_STEPS: {
  key: SetupStepKey
  label: string
  why: string
  ownedByAdmin: boolean
}[] = [
  {
    key: 'faculty',
    label: 'Faculté',
    why: 'Tout part de là : un programme appartient toujours à une faculté.',
    ownedByAdmin: true,
  },
  {
    key: 'program',
    label: 'Programme',
    why: 'C’est le cursus auquel les étudiants s’inscrivent.',
    ownedByAdmin: true,
  },
  {
    key: 'academicYear',
    label: 'Année universitaire',
    why: 'Elle situe les semestres dans le temps.',
    ownedByAdmin: true,
  },
  {
    key: 'semester',
    label: 'Semestre',
    why: 'Un étudiant s’inscrit dans un semestre, jamais ailleurs.',
    ownedByAdmin: true,
  },
  {
    key: 'course',
    label: 'Cours',
    why: 'Sans cours, les étudiants inscrits ne verraient rien.',
    ownedByAdmin: true,
  },
  {
    key: 'professor',
    label: 'Professeur',
    why: 'Un cours sans enseignant reste vide.',
    ownedByAdmin: true,
  },
  {
    key: 'student',
    label: 'Étudiant',
    why: 'L’établissement n’est réellement en service qu’à partir de là.',
    ownedByAdmin: true,
  },
]

export const SETUP_TOTAL = SETUP_STEPS.length

export function computeSetup(counts: SetupCounts): SetupProgress {
  return {
    faculty: counts.faculties > 0,
    program: counts.programs > 0,
    academicYear: counts.academicYears > 0,
    semester: counts.semesters > 0,
    course: counts.courses > 0,
    professor: counts.professors > 0,
    student: counts.students > 0,
  }
}

export function setupDone(progress: SetupProgress): number {
  return SETUP_STEPS.filter((step) => progress[step.key]).length
}
