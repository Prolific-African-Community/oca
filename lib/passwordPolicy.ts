/**
 * Exigences de mot de passe.
 *
 * Deux seuils, parce que les comptes n'ont pas la même portée : un compte
 * plateforme (SUPER_ADMIN) peut créer des établissements et rattacher des
 * administrateurs partout. Sa compromission ne coûte pas la même chose que
 * celle d'un compte étudiant, d'où un minimum plus élevé.
 *
 * Ces règles ne s'appliquent qu'aux mots de passe **choisis** par la
 * personne. Les mots de passe provisoires générés par l'administration
 * suivent leur propre logique (12 caractères aléatoires) et n'ont pas à
 * satisfaire une longueur pensée pour des secrets mémorisés.
 */

/** Minimum pour un compte plateforme (rôle plateforme renseigné). */
export const PLATFORM_MIN_LENGTH = 16

/** Minimum pour un compte d'établissement. */
export const STANDARD_MIN_LENGTH = 8

/** Longueur maximale acceptée, pour ne pas hacher des entrées démesurées. */
const MAX_LENGTH = 200

export function minLengthFor(isPlatformAccount: boolean): number {
  return isPlatformAccount ? PLATFORM_MIN_LENGTH : STANDARD_MIN_LENGTH
}

export interface PasswordCheck {
  ok: boolean
  message?: string
  field?: 'newPassword' | 'confirmPassword' | 'currentPassword'
}

/**
 * Valide un mot de passe choisi. Renvoie un motif de refus lisible, jamais le
 * mot de passe lui-même — ces messages remontent jusqu'à l'écran.
 */
export function checkNewPassword(
  newPassword: unknown,
  confirmPassword: unknown,
  options: { isPlatformAccount: boolean; currentPassword?: unknown }
): PasswordCheck {
  if (typeof newPassword !== 'string' || !newPassword) {
    return {
      ok: false,
      message: 'Le nouveau mot de passe est requis.',
      field: 'newPassword',
    }
  }

  const min = minLengthFor(options.isPlatformAccount)

  if (newPassword.length < min) {
    return {
      ok: false,
      message: options.isPlatformAccount
        ? `Un compte plateforme exige au moins ${min} caractères.`
        : `Le mot de passe doit faire au moins ${min} caractères.`,
      field: 'newPassword',
    }
  }

  if (newPassword.length > MAX_LENGTH) {
    return {
      ok: false,
      message: `Le mot de passe ne peut pas dépasser ${MAX_LENGTH} caractères.`,
      field: 'newPassword',
    }
  }

  // Un mot de passe entièrement composé d'espaces passerait la longueur sans
  // rien protéger.
  if (!newPassword.trim()) {
    return {
      ok: false,
      message: 'Le mot de passe ne peut pas être composé uniquement d’espaces.',
      field: 'newPassword',
    }
  }

  if (
    typeof options.currentPassword === 'string' &&
    options.currentPassword === newPassword
  ) {
    return {
      ok: false,
      message: 'Le nouveau mot de passe doit être différent de l’actuel.',
      field: 'newPassword',
    }
  }

  if (newPassword !== confirmPassword) {
    return {
      ok: false,
      message: 'Les deux mots de passe ne correspondent pas.',
      field: 'confirmPassword',
    }
  }

  return { ok: true }
}
