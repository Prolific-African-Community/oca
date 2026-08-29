import type { NextApiRequest, NextApiResponse } from 'next';
import { getCurrentUser, homeForRole } from '../../../lib/serverAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ message: 'Méthode non autorisée' });
  }

  // Jamais de cache : la réponse dépend du cookie de session.
  res.setHeader('Cache-Control', 'no-store');

  const user = await getCurrentUser(req);

  if (!user) {
    return res.status(200).json({ user: null });
  }

  return res.status(200).json({ user, home: homeForRole(user.effectiveRole) });
}
