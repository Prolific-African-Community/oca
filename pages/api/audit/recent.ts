import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { getCurrentUser, getCurrentInstitutionScope } from '../../../lib/serverAuth';

/**
 * Journal d'audit récent.
 *
 * SUPER_ADMIN : tout le réseau. ADMIN : uniquement son établissement.
 * PROFESSOR et STUDENT n'y ont pas accès à ce stade.
 * Le périmètre vient de la session ; aucun `institutionId` n'est lu dans la requête.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const user = await getCurrentUser(req);
  if (!user) return res.status(401).json({ message: 'Authentification requise' });

  const isPlatformAdmin = user.platformRole === Role.SUPER_ADMIN;
  const institutionId = getCurrentInstitutionScope(user, Role.ADMIN);

  if (!isPlatformAdmin && !institutionId) {
    return res.status(403).json({ message: 'Accès refusé' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

  const logs = await prisma.auditLog.findMany({
    where: isPlatformAdmin ? {} : { institutionId: institutionId! },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, firstName: true, lastName: true, email: true } },
      institution: { select: { id: true, name: true, slug: true } },
    },
  });

  return res.status(200).json({
    scope: isPlatformAdmin ? 'platform' : 'institution',
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      metadata: l.metadata,
      createdAt: l.createdAt,
      actor: {
        name: [l.actor.firstName, l.actor.lastName].filter(Boolean).join(' ') || l.actor.email,
        email: l.actor.email,
      },
      institution: l.institution,
    })),
  });
}
