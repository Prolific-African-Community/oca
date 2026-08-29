import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Session serveur minimale : un cookie HttpOnly signé (HMAC-SHA256) contenant
 * uniquement l'identifiant utilisateur et une date d'expiration.
 * Pas de stockage de session en base à ce stade, pas de dépendance externe.
 */

export const SESSION_COOKIE = 'oca_session';

/** Durée de vie de la session, en secondes (7 jours). */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

/** Secret de repli, utilisé uniquement en développement. */
const DEV_FALLBACK_SECRET = 'oca-dev-insecure-secret';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET est requis en production.');
    }
    return DEV_FALLBACK_SECRET;
  }

  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

function sign(payload: string): string {
  return base64url(crypto.createHmac('sha256', getSecret()).update(payload).digest());
}

interface SessionPayload {
  /** Identifiant de l'utilisateur. */
  uid: string;
  /** Expiration, en secondes epoch. */
  exp: number;
}

/** Fabrique un jeton de session signé pour un utilisateur. */
export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };

  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/** Vérifie signature et expiration. Retourne l'identifiant utilisateur, ou null. */
export function readSessionToken(token: string | undefined): string | null {
  if (!token) return null;

  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const a = fromBase64url(signature);
  const b = fromBase64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromBase64url(encoded).toString('utf8')) as SessionPayload;
    if (!payload.uid || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload.uid;
  } catch {
    return null;
  }
}

function serializeCookie(value: string, maxAge: number): string {
  const parts = [
    `${SESSION_COOKIE}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];

  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

/** Pose le cookie de session sur la réponse. */
export function setSessionCookie(res: NextApiResponse, userId: string) {
  res.setHeader('Set-Cookie', serializeCookie(createSessionToken(userId), SESSION_MAX_AGE));
}

/** Efface le cookie de session. */
export function clearSessionCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', serializeCookie('', 0));
}

/** Lit l'identifiant utilisateur porté par la requête, sans toucher la base. */
export function getSessionUserId(req: NextApiRequest): string | null {
  return readSessionToken(req.cookies?.[SESSION_COOKIE]);
}
