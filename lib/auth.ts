import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { NextRouter } from 'next/router';

export type Role = 'superadmin' | 'admin' | 'student' | 'teacher';

export interface CurrentUser {
  id: string;
  email: string;
  role: Role | string;
  universityId?: string;
  firstName?: string;
  lastName?: string;
}

/** Reads the persisted session (client-only). Never redirects. */
export function useCurrentUser(): { user: CurrentUser | null; ready: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      setUser(stored ? (JSON.parse(stored) as CurrentUser) : null);
    } catch {
      setUser(null);
    }
    setReady(true);
  }, []);

  return { user, ready };
}

/**
 * Guards a page to a role, mirroring the previous admin guard behaviour.
 * Pass `null` to skip redirection (read-only personalisation).
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

export function logout(router: NextRouter) {
  try {
    localStorage.removeItem('user');
  } catch {
    /* noop */
  }
  router.push('/login');
}

/** Human display name from a user, with sensible fallbacks. */
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
