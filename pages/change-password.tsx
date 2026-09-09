import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { requireAuthenticatedPage } from '../lib/pageGuard'
import { AppShell } from '../components/app/AppShell'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button, buttonClasses } from '../components/ui/Button'
import { useCurrentUser, invalidateCurrentUser } from '../lib/auth'
import {
  PLATFORM_MIN_LENGTH,
  STANDARD_MIN_LENGTH,
} from '../lib/passwordPolicy'

/**
 * Changement de mot de passe, pour son propre compte uniquement.
 *
 * La page exige une session, mais aucun rôle : toute personne connectée peut
 * changer son mot de passe, et l'API ne sait de toute façon agir que sur le
 * compte de la session. Restreindre l'écran à un rôle n'ajouterait aucune
 * sécurité et priverait les autres d'une action élémentaire.
 */
export default function ChangePassword() {
  const router = useRouter()
  const { user, ready } = useCurrentUser()
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [field, setField] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const platform = Boolean(user?.platformRole)
  const min = platform ? PLATFORM_MIN_LENGTH : STANDARD_MIN_LENGTH

  const set = (key: keyof typeof form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
    setError(null)
    setField(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setField(null)

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(data.message ?? 'Changement impossible.')
        setField(data.field ?? null)
        return
      }

      // La session vient d'être fermée côté serveur : on vide le cache
      // client pour ne pas laisser une identité fantôme à l'écran.
      invalidateCurrentUser()
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setDone(true)
    } catch {
      setError('Connexion temporairement indisponible. Réessayez dans quelques secondes.')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return null

  // Après le changement, la session n'existe plus : l'écran n'affiche donc
  // plus la coque applicative, qui n'aurait plus rien à charger.
  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-page px-5">
        <Card className="w-full max-w-md text-center">
          <h1 className="text-xl font-medium tracking-tight text-ink">
            Mot de passe modifié
          </h1>
          <p className="text-ink/60 mt-2 text-[15px]">
            Toutes vos sessions ont été fermées, sur cet appareil comme sur les
            autres. Reconnectez-vous avec votre nouveau mot de passe.
          </p>
          <Link
            href="/login"
            className={buttonClasses('primary', 'md', 'no-underline mt-5')}
          >
            Se reconnecter
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <AppShell
      role={user?.role ?? 'student'}
      title="Mot de passe"
      subtitle="Changez le mot de passe de votre compte"
      maxWidth="narrow"
    >
      <button
        onClick={() => router.back()}
        className="text-ink/50 mb-4 inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-ink"
      >
        ← Retour
      </button>

      <Card>
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Changer votre mot de passe
        </h2>
        <p className="text-ink/50 mt-0.5 text-sm">
          Vous ne pouvez changer que le mot de passe de votre propre compte
          {user?.email ? ` (${user.email})` : ''}.
        </p>

        {platform && (
          <p className="mt-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Votre compte est un compte plateforme : il peut créer des
            établissements et rattacher des administrateurs. Son mot de passe
            doit faire au moins {PLATFORM_MIN_LENGTH} caractères.
          </p>
        )}

        <form onSubmit={submit} className="mt-5 space-y-4">
          <Input
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            value={form.currentPassword}
            onChange={(e) => set('currentPassword')(e.target.value)}
            aria-invalid={field === 'currentPassword'}
            required
          />
          <Input
            label="Nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            hint={`Au moins ${min} caractères.`}
            value={form.newPassword}
            onChange={(e) => set('newPassword')(e.target.value)}
            aria-invalid={field === 'newPassword'}
            required
          />
          <Input
            label="Confirmer le nouveau mot de passe"
            type="password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={(e) => set('confirmPassword')(e.target.value)}
            aria-invalid={field === 'confirmPassword'}
            required
          />

          <p className="text-ink/50 text-sm">
            Après validation, toutes vos sessions seront fermées — y compris
            sur vos autres appareils — et vous devrez vous reconnecter.
          </p>

          {error && (
            <div
              role="alert"
              className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            loading={busy}
            disabled={
              !form.currentPassword ||
              !form.newPassword ||
              !form.confirmPassword
            }
          >
            Changer le mot de passe
          </Button>
        </form>
      </Card>
    </AppShell>
  )
}

// Une session valide suffit : la page ne concerne que le compte courant.
export const getServerSideProps = requireAuthenticatedPage()
