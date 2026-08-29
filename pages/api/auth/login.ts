import type { NextApiRequest, NextApiResponse } from 'next'
import bcrypt from 'bcryptjs'
import { prisma } from '../../../lib/prisma'
import { setSessionCookie } from '../../../lib/session'
import { getUserById, homeForRole } from '../../../lib/serverAuth'
import {
  checkLoginThrottle,
  clearLoginFailures,
  loginThrottleKey,
  recordLoginFailure,
} from '../../../lib/loginThrottle'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ message: 'Méthode non autorisée' })
  }

  const { email, password } = (req.body ?? {}) as {
    email?: string
    password?: string
  }

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email ||
    !password
  ) {
    return res.status(400).json({ message: 'Email et mot de passe requis' })
  }

  res.setHeader('Cache-Control', 'no-store')
  const normalizedEmail = email.trim().toLowerCase()
  const throttleKey = loginThrottleKey(req, normalizedEmail)
  const throttle = checkLoginThrottle(throttleKey)
  if (throttle.limited) {
    res.setHeader('Retry-After', String(throttle.retryAfterSeconds))
    return res.status(429).json({
      message: 'Trop de tentatives. Réessayez plus tard.',
    })
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true, isActive: true },
  })

  // Message volontairement identique dans tous les cas d'échec :
  // ne pas révéler si l'adresse existe, ni si le compte est désactivé.
  const invalid = () => {
    recordLoginFailure(throttleKey)
    return res.status(401).json({ message: 'Identifiants invalides' })
  }

  if (!user) {
    // Comparaison à vide pour garder un temps de réponse comparable.
    await bcrypt.compare(
      password,
      '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO'
    )
    return invalid()
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatches || !user.isActive) return invalid()

  const safeUser = await getUserById(user.id)
  if (!safeUser) return invalid()

  clearLoginFailures(throttleKey)
  setSessionCookie(res, safeUser.id)

  return res.status(200).json({
    user: safeUser,
    redirectTo: homeForRole(safeUser.effectiveRole),
  })
}
