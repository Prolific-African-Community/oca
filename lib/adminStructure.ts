import {
  AcademicStatus,
  CourseStatus,
  CycleLevel,
  Prisma,
} from '@prisma/client';
import { prisma } from './prisma';
import { ValidationError } from './validation';

/**
 * Création des objets de la structure académique par un administrateur
 * d'établissement.
 *
 * Règle unique et non négociable de ce module : `institutionId` est toujours
 * passé par l'appelant depuis la session, jamais lu dans le corps de la requête.
 * Chaque objet lié (faculté, cycle, programme…) est revérifié comme appartenant
 * à ce même établissement avant toute écriture.
 */

// L'erreur de validation est partagée avec les routes enseignantes.
export { ValidationError } from './validation';

export const STRUCTURE_ENTITIES = [
  'faculty',
  'department',
  'cycle',
  'program',
  'academic-year',
  'semester',
  'course',
] as const;

export type StructureEntity = (typeof STRUCTURE_ENTITIES)[number];

type Body = Record<string, unknown>;

/* ------------------------------------------------------------------ helpers */

/** Minuscule initiale, pour composer des messages du type « Renseignez le nom ». */
function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function str(body: Body, field: string, label: string, max = 200): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`Renseignez ${lower(label)}`, field);
  }
  if (value.trim().length > max) {
    throw new ValidationError(`${label} : ${max} caractères maximum`, field);
  }
  return value.trim();
}

function optionalStr(body: Body, field: string): string | null {
  const value = body[field];
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError('Valeur invalide', field);
  return value.trim() || null;
}

/** Code court normalisé en majuscules : c'est la clé métier vue par l'utilisateur. */
function code(body: Body, field = 'code'): string {
  const raw = str(body, field, 'Le code', 30);
  const normalized = raw.toUpperCase().replace(/\s+/g, '-');
  if (!/^[A-Z0-9][A-Z0-9-]*$/.test(normalized)) {
    throw new ValidationError(
      'Le code ne peut contenir que des lettres, chiffres et tirets',
      field
    );
  }
  return normalized;
}

function int(body: Body, field: string, label: string, min: number, max: number): number {
  const value = typeof body[field] === 'string' ? Number(body[field]) : body[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${label} : nombre entier attendu`, field);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${label} : valeur attendue entre ${min} et ${max}`, field);
  }
  return value;
}

function optionalInt(
  body: Body,
  field: string,
  label: string,
  min: number,
  max: number
): number | null {
  if (body[field] === undefined || body[field] === null || body[field] === '') return null;
  return int(body, field, label, min, max);
}

function num(body: Body, field: string, label: string, min: number, max: number): number {
  const value = typeof body[field] === 'string' ? Number(body[field]) : body[field];
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`${label} : nombre attendu`, field);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${label} : valeur attendue entre ${min} et ${max}`, field);
  }
  return value;
}

function date(body: Body, field: string, label: string): Date {
  const value = body[field];
  if (typeof value !== 'string' || !value) {
    throw new ValidationError(`Renseignez ${lower(label)}`, field);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${label} : date invalide`, field);
  }
  return parsed;
}

function enumValue<T extends Record<string, string>>(
  body: Body,
  field: string,
  label: string,
  values: T,
  fallback?: T[keyof T]
): T[keyof T] {
  const value = body[field];
  if (value === undefined || value === null || value === '') {
    if (fallback !== undefined) return fallback;
    throw new ValidationError(`Renseignez ${lower(label)}`, field);
  }
  if (typeof value !== 'string' || !Object.values(values).includes(value)) {
    throw new ValidationError(`${label} : valeur invalide`, field);
  }
  return value as T[keyof T];
}

/* --------------------------------------------- vérifications d'appartenance */

async function assertFaculty(institutionId: string, facultyId: string) {
  const faculty = await prisma.faculty.findFirst({
    where: { id: facultyId, institutionId },
    select: { id: true },
  });
  if (!faculty) throw new ValidationError('Faculté inconnue pour cet établissement', 'facultyId');
  return faculty;
}

async function assertDepartment(institutionId: string, departmentId: string, facultyId?: string) {
  const department = await prisma.department.findFirst({
    where: {
      id: departmentId,
      faculty: { institutionId },
      ...(facultyId ? { facultyId } : {}),
    },
    select: { id: true, facultyId: true },
  });
  if (!department) {
    throw new ValidationError(
      facultyId
        ? "Ce département n'appartient pas à la faculté choisie"
        : 'Département inconnu pour cet établissement',
      'departmentId'
    );
  }
  return department;
}

async function assertProgram(institutionId: string, programId: string) {
  const program = await prisma.program.findFirst({
    where: { id: programId, institutionId },
    select: { id: true, facultyId: true, departmentId: true },
  });
  if (!program) throw new ValidationError('Programme inconnu pour cet établissement', 'programId');
  return program;
}

async function assertAcademicYear(institutionId: string, academicYearId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { id: academicYearId, institutionId },
    select: { id: true, startDate: true, endDate: true },
  });
  if (!year) {
    throw new ValidationError('Année universitaire inconnue pour cet établissement', 'academicYearId');
  }
  return year;
}

/* --------------------------------------------------------------- créations */

async function createFaculty(institutionId: string, body: Body) {
  const campusId = optionalStr(body, 'campusId');

  if (campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: campusId, institutionId },
      select: { id: true },
    });
    if (!campus) throw new ValidationError('Campus inconnu pour cet établissement', 'campusId');
  }

  return prisma.faculty.create({
    data: {
      institutionId,
      campusId,
      name: str(body, 'name', 'Le nom'),
      code: code(body),
    },
  });
}

async function createDepartment(institutionId: string, body: Body) {
  const facultyId = str(body, 'facultyId', 'La faculté');
  await assertFaculty(institutionId, facultyId);

  return prisma.department.create({
    data: {
      facultyId,
      name: str(body, 'name', 'Le nom'),
      code: code(body),
    },
  });
}

async function createCycle(institutionId: string, body: Body) {
  return prisma.cycle.create({
    data: {
      institutionId,
      level: enumValue(body, 'level', 'Le niveau', CycleLevel),
      name: str(body, 'name', 'Le nom'),
      code: code(body),
      durationYears: int(body, 'durationYears', 'La durée', 1, 10),
      totalCredits: optionalInt(body, 'totalCredits', 'Le nombre de crédits', 0, 1000),
    },
  });
}

async function createProgram(institutionId: string, body: Body) {
  const facultyId = str(body, 'facultyId', 'La faculté');
  const cycleId = str(body, 'cycleId', 'Le cycle');
  const departmentId = optionalStr(body, 'departmentId');

  await assertFaculty(institutionId, facultyId);

  const cycle = await prisma.cycle.findFirst({
    where: { id: cycleId, institutionId },
    select: { id: true },
  });
  if (!cycle) throw new ValidationError('Cycle inconnu pour cet établissement', 'cycleId');

  // Le département, s'il est fourni, doit relever de la faculté choisie.
  if (departmentId) await assertDepartment(institutionId, departmentId, facultyId);

  return prisma.program.create({
    data: {
      institutionId,
      facultyId,
      departmentId,
      cycleId,
      name: str(body, 'name', 'Le nom'),
      code: code(body),
      durationYears: int(body, 'durationYears', 'La durée', 1, 10),
      status: enumValue(body, 'status', 'Le statut', AcademicStatus, AcademicStatus.ACTIVE),
    },
  });
}

async function createAcademicYear(institutionId: string, body: Body) {
  const startDate = date(body, 'startDate', 'La date de début');
  const endDate = date(body, 'endDate', 'La date de fin');

  if (startDate >= endDate) {
    throw new ValidationError('La date de fin doit suivre la date de début', 'endDate');
  }

  const isCurrent = body.isCurrent === true || body.isCurrent === 'true';

  // Une seule année courante par établissement : la contrainte n'est pas
  // exprimable dans le schéma, elle est garantie ici par transaction.
  return prisma.$transaction(async (tx) => {
    if (isCurrent) {
      await tx.academicYear.updateMany({
        where: { institutionId, isCurrent: true },
        data: { isCurrent: false },
      });
    }

    return tx.academicYear.create({
      data: {
        institutionId,
        name: str(body, 'name', 'Le nom'),
        startDate,
        endDate,
        isCurrent,
        status: enumValue(body, 'status', 'Le statut', AcademicStatus, AcademicStatus.ACTIVE),
      },
    });
  });
}

async function createSemester(institutionId: string, body: Body) {
  const programId = str(body, 'programId', 'Le programme');
  const academicYearId = str(body, 'academicYearId', "L'année universitaire");

  await assertProgram(institutionId, programId);
  const year = await assertAcademicYear(institutionId, academicYearId);

  const startDate = date(body, 'startDate', 'La date de début');
  const endDate = date(body, 'endDate', 'La date de fin');

  if (startDate >= endDate) {
    throw new ValidationError('La date de fin doit suivre la date de début', 'endDate');
  }
  if (startDate < year.startDate || endDate > year.endDate) {
    throw new ValidationError(
      "Le semestre doit être compris dans l'année universitaire",
      'startDate'
    );
  }

  return prisma.semester.create({
    data: {
      programId,
      academicYearId,
      name: str(body, 'name', 'Le nom'),
      number: int(body, 'number', 'Le numéro de semestre', 1, 12),
      startDate,
      endDate,
      status: enumValue(body, 'status', 'Le statut', AcademicStatus, AcademicStatus.ACTIVE),
    },
  });
}

async function createCourse(institutionId: string, body: Body) {
  const programId = str(body, 'programId', 'Le programme');
  const semesterId = str(body, 'semesterId', 'Le semestre');

  const program = await assertProgram(institutionId, programId);

  // Le semestre doit relever du programme choisi, lui-même dans l'établissement.
  const semester = await prisma.semester.findFirst({
    where: { id: semesterId, programId },
    select: { id: true },
  });
  if (!semester) {
    throw new ValidationError("Ce semestre n'appartient pas au programme choisi", 'semesterId');
  }

  return prisma.course.create({
    data: {
      institutionId,
      programId,
      semesterId,
      // Hérités du programme : évite toute incohérence de rattachement.
      facultyId: program.facultyId,
      departmentId: program.departmentId,
      title: str(body, 'title', 'Le titre'),
      code: code(body),
      description: optionalStr(body, 'description'),
      credits: int(body, 'credits', 'Les crédits', 0, 60),
      coefficient: num(body, 'coefficient', 'Le coefficient', 0, 20),
      order: optionalInt(body, 'order', "L'ordre", 0, 999) ?? 0,
      status: enumValue(body, 'status', 'Le statut', CourseStatus, CourseStatus.PUBLISHED),
    },
  });
}

const CREATORS: Record<StructureEntity, (institutionId: string, body: Body) => Promise<unknown>> = {
  faculty: createFaculty,
  department: createDepartment,
  cycle: createCycle,
  program: createProgram,
  'academic-year': createAcademicYear,
  semester: createSemester,
  course: createCourse,
};

/** Message et champ fautif pour les collisions d'unicité, par entité. */
const DUPLICATES: Record<StructureEntity, { message: string; field: string }> = {
  faculty: { message: 'Une faculté porte déjà ce code dans cet établissement', field: 'code' },
  department: { message: 'Un département porte déjà ce code dans cette faculté', field: 'code' },
  cycle: { message: 'Un cycle porte déjà ce code dans cet établissement', field: 'code' },
  program: { message: 'Un programme porte déjà ce code dans cet établissement', field: 'code' },
  'academic-year': { message: 'Une année universitaire porte déjà ce nom', field: 'name' },
  semester: {
    message: 'Ce numéro de semestre existe déjà pour ce programme et cette année',
    field: 'number',
  },
  course: { message: 'Un cours porte déjà ce code dans ce semestre', field: 'code' },
};

export function isStructureEntity(value: unknown): value is StructureEntity {
  return typeof value === 'string' && (STRUCTURE_ENTITIES as readonly string[]).includes(value);
}

/**
 * Crée un objet de structure. Traduit les collisions d'unicité Prisma (P2002)
 * en erreurs de validation lisibles plutôt qu'en 500.
 */
export async function createStructureEntity(
  entity: StructureEntity,
  institutionId: string,
  body: Body
) {
  try {
    return await CREATORS[entity](institutionId, body);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = DUPLICATES[entity];
      throw new ValidationError(duplicate.message, duplicate.field);
    }
    throw error;
  }
}
