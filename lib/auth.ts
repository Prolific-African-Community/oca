import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { NextRouter } from 'next/router';

/**
 * Lecture de l'utilisateur courant côté client.
 * La session vit dans un cookie HttpOnly : le navigateur ne peut pas la lire,
 * l'identité est donc toujours demandée au serveur via /api/auth/me.
 */

/** Rôles tels qu'exposés par l'API (miroir de l'enum Prisma). */
export type PlatformRole = 'SUPER_ADMIN' | 'ADMIN' | 'PROFESSOR' | 'STUDENT';

/** Rôles historiques utilisés par les écrans et la navigation. */
export type Role = 'superadmin' | 'admin' | 'student' | 'teacher';

export interface Membership {
  institutionId: string;
  role: PlatformRole;
  institution: { id: string; name: string; slug: string };
}

export interface CurrentUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  platformRole: PlatformRole | null;
  memberships: Membership[];
  effectiveRole: PlatformRole | null;
  /** Équivalent minuscule de effectiveRole, attendu par les écrans existants. */
  role: Role | null;
  /** Établissement de rattachement, quand il n'y en a qu'un. */
  universityId?: string;
}

const ROLE_TO_LEGACY: Record<PlatformRole, Role> = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  PROFESSOR: 'teacher',
  STUDENT: 'student',
};

interface MeResponse {
  user:
    | (Omit<CurrentUser, 'role' | 'universityId'> & { role?: never })
    | null;
}

function normalize(user: MeResponse['user']): CurrentUser | null {
  if (!user) return null;

  return {
    ...user,
    role: user.effectiveRole ? ROLE_TO_LEGACY[user.effectiveRole] : null,
    universityId: user.memberships[0]?.institutionId,
  };
}

/**
 * Cache module : évite que chaque composant montant (AppShell + page) ne déclenche
 * son propre appel réseau. Invalidé à la déconnexion.
 */
let cachedUser: CurrentUser | null | undefined;
let inFlight: Promise<CurrentUser | null> | null = null;

async function fetchCurrentUser(): Promise<CurrentUser | null> {
  if (cachedUser !== undefined) return cachedUser;
  if (inFlight) return inFlight;

  inFlight = fetch('/api/auth/me', { credentials: 'same-origin' })
    .then((res) => (res.ok ? (res.json() as Promise<MeResponse>) : { user: null }))
    .then((data) => normalize(data.user))
    .catch(() => null)
    .then((user) => {
      cachedUser = user;
      inFlight = null;
      return user;
    });

  return inFlight;
}

/** Vide le cache d'identité (après connexion ou déconnexion). */
export function invalidateCurrentUser() {
  cachedUser = undefined;
  inFlight = null;
}

/** Lit la session depuis le serveur. Ne redirige jamais. */
export function useCurrentUser(): { user: CurrentUser | null; ready: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser ?? null);
  const [ready, setReady] = useState(cachedUser !== undefined);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser().then((result) => {
      if (cancelled) return;
      setUser(result);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { user, ready };
}

/**
 * Garde une page derrière un rôle. Passer `null` pour ne pas rediriger
 * (simple personnalisation en lecture).
 * Garde d'affichage uniquement : la vraie autorisation devra être serveur.
 */
export function useRequireRole(role: Role | null): { user: CurrentUser | null; ready: boolean } {
  const router = useRouter();
  const { user, ready } = useCurrentUser();

  useEffect(() => {
    if (!ready || role === null) return;
    if (!user || user.role !== role) {
      router.replace('/login');
    }
  }, [ready, user, role, router]);

  return { user, ready };
}

export async function logout(router: NextRouter) {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {
    /* on redirige quand même */
  }
  invalidateCurrentUser();
  router.push('/login');
}

/** Nom affichable d'un utilisateur, avec replis raisonnables. */
export function displayName(user: CurrentUser | null): string {
  if (!user) return 'Invité';
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.email?.split('@')[0] ?? 'Invité';
}

export function initials(nameOrUser: string | CurrentUser | null): string {
  const name =
    typeof nameOrUser === 'string' ? nameOrUser : displayName(nameOrUser);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
