import type { NextApiRequest, NextApiResponse } from 'next';
import { Role } from '@prisma/client';
import { prisma } from '../../../lib/prisma';
import { requirePlatformRole } from '../../../lib/serverAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  const user = await requirePlatformRole(req, res, Role.SUPER_ADMIN);
  if (!user) return;

  res.setHeader('Cache-Control', 'no-store');

  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      members: {
        where: { role: Role.ADMIN, isActive: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });

  // Forme conservée telle que l'attend l'écran /superadmin :
  // { id, name, adminEmail, status: 'active' | 'inactive' }.
  return res.status(200).json(
    institutions.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      adminEmail: i.members[0]?.user.email ?? null,
      status: i.status === 'ACTIVE' ? 'active' : 'inactive',
    }))
  );
}
