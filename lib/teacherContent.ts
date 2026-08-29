import { ContentStatus } from '@prisma/client';
import { ValidationError } from './validation';

/**
 * Validation des contenus pédagogiques saisis par un enseignant
 * (modules et leçons). Volontairement minimale : le contenu reste du texte
 * simple à ce stade.
 */

type Body = Record<string, unknown>;

export function requiredText(body: Body, field: string, label: string, max = 200): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`Renseignez ${label}`, field);
  }
  if (value.trim().length > max) {
    throw new ValidationError(`${max} caractères maximum`, field);
  }
  return value.trim();
}

export function optionalText(body: Body, field: string, max = 20000): string | null | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (value === null || value === '') return null;
  if (typeof value !== 'string') throw new ValidationError('Valeur invalide', field);
  if (value.length > max) throw new ValidationError(`${max} caractères maximum`, field);
  return value;
}

export function optionalInt(
  body: Body,
  field: string,
  label: string,
  min: number,
  max: number
): number | null | undefined {
  if (!(field in body)) return undefined;
  if (body[field] === null || body[field] === '') return null;

  const value = typeof body[field] === 'string' ? Number(body[field]) : body[field];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new ValidationError(`${label} : nombre entier attendu`, field);
  }
  if (value < min || value > max) {
    throw new ValidationError(`${label} : valeur attendue entre ${min} et ${max}`, field);
  }
  return value;
}

export function contentStatus(body: Body, field = 'status'): ContentStatus | undefined {
  if (!(field in body)) return undefined;
  const value = body[field];
  if (typeof value !== 'string' || !Object.values(ContentStatus).includes(value as ContentStatus)) {
    throw new ValidationError('Statut invalide', field);
  }
  return value as ContentStatus;
}

/** Retire les clés `undefined` : seuls les champs réellement transmis sont mis à jour. */
export function definedOnly<T extends Record<string, unknown>>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<T>;
}
