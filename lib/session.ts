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
  /**
   * Version du mot de passe au moment de l'émission. Comparée à
   * `User.tokenVersion` lors du chargement de l'utilisateur : un changement de
   * mot de passe rend caducs tous les jetons émis avant.
   */
  tv?: number;
}

/** Identité portée par un jeton valide. */
export interface SessionIdentity {
  userId: string;
  tokenVersion: number;
}

/** Fabrique un jeton de session signé pour un utilisateur. */
export function createSessionToken(userId: string, tokenVersion = 0): string {
  const payload: SessionPayload = {
    uid: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
    tv: tokenVersion,
  };

  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Vérifie signature et expiration. Retourne l'identité portée, ou null.
 *
 * Un jeton émis avant l'introduction de `tv` est lu comme version 0, ce qui
 * correspond au défaut en base : les sessions déjà ouvertes survivent au
 * déploiement, et seront invalidées au premier changement de mot de passe.
 */
export function readSessionToken(token: string | undefined): SessionIdentity | null {
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
    return {
      userId: payload.uid,
      tokenVersion: typeof payload.tv === 'number' ? payload.tv : 0,
    };
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
export function setSessionCookie(res: NextApiResponse, userId: string, tokenVersion = 0) {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(createSessionToken(userId, tokenVersion), SESSION_MAX_AGE)
  );
}

/** Efface le cookie de session. */
export function clearSessionCookie(res: NextApiResponse) {
  res.setHeader('Set-Cookie', serializeCookie('', 0));
}

/** Lit l'identité portée par la requête, sans toucher la base. */
export function getSessionIdentity(req: NextApiRequest): SessionIdentity | null {
  return readSessionToken(req.cookies?.[SESSION_COOKIE]);
}
