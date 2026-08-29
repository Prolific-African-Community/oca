/**
 * Forme de la réponse de `/api/student/summary`, partagée par les écrans
 * étudiants. Uniquement des faits mesurés : inscriptions, cours, avancement
 * de lecture. Ni note, ni crédit validé, ni moyenne.
 */
export interface StudentSummaryCourse {
  id: string;
  title: string;
  code: string;
  credits: number;
  lessonCount: number;
  completedLessons: number;
  progress: number;
  teachers: { role: string; name: string }[];
}

export interface StudentSummary {
  enrolled: boolean;
  program: { name: string; code: string } | null;
  semester: { name: string; academicYear: string } | null;
  courseCount: number;
  /** Crédits des cours suivis ce semestre — pas des crédits acquis. */
  creditsEnrolled: number;
  lessonCount: number;
  completedLessons: number;
  progress: number;
  courses: StudentSummaryCourse[];
}
