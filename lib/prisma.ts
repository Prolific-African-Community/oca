import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var _prisma: PrismaClient | undefined;
}

/**
 * Client Prisma unique, réutilisé entre les rechargements du serveur de dev
 * (Next.js recharge les modules à chaque édition : sans ce cache global on
 * ouvrirait une nouvelle pool de connexions à chaque fois).
 */
export const prisma =
  global._prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global._prisma = prisma;
}

export default prisma;
