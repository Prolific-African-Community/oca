import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from './prisma';
import { getSessionUserId } from './session';

/**
 * Lecture de l'utilisateur courant côté serveur.
 * Ce module ne renvoie jamais `passwordHash`.
 */

export interface SafeMembership {
  institutionId: string;
  role: Role;
  institution: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface SafeUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  platformRole: Role | null;
  memberships: SafeMembership[];
  /** Rôle retenu pour l'orientation de l'interface (voir resolveEffectiveRole). */
  effectiveRole: Role | null;
}

/** Sélection Prisma partagée : liste blanche de champs, jamais le hash. */
const safeUserSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  platformRole: true,
  isActive: true,
  memberships: {
    where: { isActive: true },
    select: {
      institutionId: true,
      role: true,
      institution: { select: { id: true, name: true, slug: true } },
    },
  },
} as const;

/** Ordre de priorité quand un utilisateur cumule plusieurs rôles. */
const ROLE_PRIORITY: Role[] = [Role.SUPER_ADMIN, Role.ADMIN, Role.PROFESSOR, Role.STUDENT];

/**
 * Rôle le plus élevé dont dispose l'utilisateur : le rôle plateforme s'il existe,
 * sinon le plus prioritaire de ses appartenances.
 * Sert uniquement à orienter l'interface — ce n'est pas un contrôle d'accès.
 */
export function resolveEffectiveRole(user: {
  platformRole: Role | null;
  memberships: { role: Role }[];
}): Role | null {
  if (user.platformRole) return user.platformRole;

  for (const role of ROLE_PRIORITY) {
    if (user.memberships.some((m) => m.role === role)) return role;
  }

  return null;
}

/** Route par défaut d'un rôle. `/teacher` n'existe pas encore : repli sur `/student`. */
export function homeForRole(role: Role | null): string {
  switch (role) {
    case Role.SUPER_ADMIN:
      return '/superadmin';
    case Role.ADMIN:
      return '/admin';
    case Role.PROFESSOR:
      return '/teacher';
    case Role.STUDENT:
      return '/student';
    default:
      return '/login';
  }
}

/** Charge un utilisateur actif par son identifiant, sous forme sûre. */
export async function getUserById(userId: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: safeUserSelect,
  });

  if (!user || !user.isActive) return null;

  const { isActive, ...rest } = user;

  return {
    ...rest,
    effectiveRole: resolveEffectiveRole(rest),
  };
}

/** Utilisateur courant d'une requête API, ou null si la session est absente/invalide. */
export async function getCurrentUser(req: NextApiRequest): Promise<SafeUser | null> {
  const userId = getSessionUserId(req);
  if (!userId) return null;
  return getUserById(userId);
}

/* =========================================================================
 * Garde-fous d'autorisation (RUN 5)
 *
 * Chaque helper renvoie l'utilisateur autorisé, ou `null` après avoir déjà
 * répondu à la requête. Appel type :
 *
 *   const user = await requirePlatformRole(req, res, Role.SUPER_ADMIN);
 *   if (!user) return;
 * ========================================================================= */

/** Exige une session valide. Répond 401 sinon. */
export async function requireUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<SafeUser | null> {
  const user = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({ message: 'Authentification requise' });
    return null;
  }

  return user;
}

/** Exige un rôle plateforme (aujourd'hui : SUPER_ADMIN). Répond 401/403 sinon. */
export async function requirePlatformRole(
  req: NextApiRequest,
  res: NextApiResponse,
  role: Role
): Promise<SafeUser | null> {
  const user = await requireUser(req, res);
  if (!user) return null;

  if (user.platformRole !== role) {
    res.status(403).json({ message: 'Accès refusé' });
    return null;
  }

  return user;
}

export interface InstitutionScope {
  user: SafeUser;
  institutionId: string;
}

/**
 * Périmètre d'un utilisateur pour un rôle donné.
 * Un ADMIN est rattaché à un seul établissement pour l'instant : s'il en a
 * plusieurs, on retient le premier (voir limites documentées du RUN 5).
 */
export function getCurrentInstitutionScope(user: SafeUser, role: Role): string | null {
  return user.memberships.find((m) => m.role === role)?.institutionId ?? null;
}

/**
 * Exige un rôle dans un établissement, et renvoie le périmètre correspondant.
 * L'établissement provient toujours de la session, jamais du corps de la requête.
 * Si `institutionId` est fourni, l'appartenance doit porter sur celui-ci.
 */
export async function requireInstitutionRole(
  req: NextApiRequest,
  res: NextApiResponse,
  role: Role,
  institutionId?: string
): Promise<InstitutionScope | null> {
  const user = await requireUser(req, res);
  if (!user) return null;

  const membership = user.memberships.find(
    (m) => m.role === role && (!institutionId || m.institutionId === institutionId)
  );

  if (!membership) {
    res.status(403).json({ message: 'Accès refusé' });
    return null;
  }

  return { user, institutionId: membership.institutionId };
}
