import { QuestionType } from '@prisma/client';
import { ValidationError } from './validation';

/**
 * Validation et correction des quiz.
 *
 * Principe de correction : seules les questions à réponse fermée
 * (choix multiple, vrai/faux) sont corrigées automatiquement. Les questions
 * à texte libre sont enregistrées mais **exclues du score** — mieux vaut un
 * score partiel honnête qu'une correction automatique approximative.
 */

type Body = Record<string, unknown>;

export interface NormalizedQuestion {
  prompt: string;
  type: QuestionType;
  options: string[] | null;
  correctAnswer: number[] | boolean | null;
  explanation: string | null;
  points: number;
}

/** Les questions à texte libre restent hors du score automatique. */
export function isAutoGraded(type: QuestionType): boolean {
  return type === QuestionType.MULTIPLE_CHOICE || type === QuestionType.TRUE_FALSE;
}

function text(body: Body, field: string, label: string, max = 2000): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`Renseignez ${label}`, field);
  }
  if (value.trim().length > max) {
    throw new ValidationError(`${max} caractères maximum`, field);
  }
  return value.trim();
}

/**
 * Valide une question et normalise ses options / sa réponse attendue.
 * La cohérence type ↔ réponse est vérifiée ici, une fois pour toutes.
 */
export function normalizeQuestion(body: Body): NormalizedQuestion {
  const prompt = text(body, 'prompt', "l'énoncé");

  const rawType = body.type ?? QuestionType.MULTIPLE_CHOICE;
  if (typeof rawType !== 'string' || !Object.values(QuestionType).includes(rawType as QuestionType)) {
    throw new ValidationError('Type de question invalide', 'type');
  }
  const type = rawType as QuestionType;

  const points = body.points === undefined || body.points === '' ? 1 : Number(body.points);
  if (!Number.isInteger(points) || points < 0 || points > 100) {
    throw new ValidationError('Les points : entier attendu entre 0 et 100', 'points');
  }

  const explanation =
    typeof body.explanation === 'string' && body.explanation.trim()
      ? body.explanation.trim()
      : null;

  if (type === QuestionType.SHORT_TEXT) {
    return { prompt, type, options: null, correctAnswer: null, explanation, points };
  }

  if (type === QuestionType.TRUE_FALSE) {
    const answer = body.correctAnswer;
    const value = answer === true || answer === 'true' ? true : answer === false || answer === 'false' ? false : null;
    if (value === null) {
      throw new ValidationError('Indiquez si l’affirmation est vraie ou fausse', 'correctAnswer');
    }
    return { prompt, type, options: null, correctAnswer: value, explanation, points };
  }

  // MULTIPLE_CHOICE
  const rawOptions = body.options;
  if (!Array.isArray(rawOptions)) {
    throw new ValidationError('Proposez au moins deux réponses', 'options');
  }

  const options = rawOptions
    .filter((o): o is string => typeof o === 'string')
    .map((o) => o.trim())
    .filter(Boolean);

  if (options.length < 2) {
    throw new ValidationError('Proposez au moins deux réponses', 'options');
  }
  if (options.length > 10) {
    throw new ValidationError('Dix réponses au maximum', 'options');
  }

  const raw = body.correctAnswer;
  const indices = (Array.isArray(raw) ? raw : [raw])
    .map((v) => (typeof v === 'string' ? Number(v) : v))
    .filter((v): v is number => typeof v === 'number' && Number.isInteger(v));

  if (indices.length === 0) {
    throw new ValidationError('Désignez la ou les bonnes réponses', 'correctAnswer');
  }
  if (indices.some((i) => i < 0 || i >= options.length)) {
    throw new ValidationError('Bonne réponse hors de la liste des propositions', 'correctAnswer');
  }

  return {
    prompt,
    type,
    options,
    correctAnswer: Array.from(new Set(indices)).sort((a, b) => a - b),
    explanation,
    points,
  };
}

/** Comparaison d'ensembles d'indices, indépendante de l'ordre. */
function sameIndices(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.every((v, i) => v === sortedB[i]);
}

export interface GradedAnswer {
  isCorrect: boolean | null;
  pointsAwarded: number;
}

/**
 * Corrige une réponse. Renvoie `isCorrect: null` pour les questions à
 * correction manuelle, qui ne rapportent aucun point automatique.
 */
export function gradeAnswer(
  question: { type: QuestionType; correctAnswer: unknown; points: number },
  response: unknown
): GradedAnswer {
  if (!isAutoGraded(question.type)) {
    return { isCorrect: null, pointsAwarded: 0 };
  }

  if (question.type === QuestionType.TRUE_FALSE) {
    const given = response === true || response === 'true';
    const expected = question.correctAnswer === true;
    const isCorrect = response === undefined || response === null ? false : given === expected;
    return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
  }

  const expected = Array.isArray(question.correctAnswer)
    ? (question.correctAnswer as unknown[]).filter((v): v is number => typeof v === 'number')
    : [];

  const given = (Array.isArray(response) ? response : [response])
    .map((v) => (typeof v === 'string' ? Number(v) : v))
    .filter((v): v is number => typeof v === 'number' && Number.isInteger(v));

  const isCorrect = expected.length > 0 && sameIndices(expected, given);
  return { isCorrect, pointsAwarded: isCorrect ? question.points : 0 };
}

/** Vue d'une question destinée à l'étudiant : sans réponse attendue. */
export function toStudentQuestion(q: {
  id: string;
  prompt: string;
  type: QuestionType;
  options: unknown;
  points: number;
  order: number;
}) {
  return {
    id: q.id,
    prompt: q.prompt,
    type: q.type,
    options: Array.isArray(q.options) ? (q.options as string[]) : null,
    points: q.points,
    order: q.order,
  };
}
