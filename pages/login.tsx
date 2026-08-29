import { useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Link from 'next/link'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Wordmark } from '../components/brand/Wordmark'
import { invalidateCurrentUser } from '../lib/auth'
import { AuthScene } from '../components/illustrations/AuthScene'
import {
  Aurora,
  GridField,
  Orbits,
  NoiseOverlay,
} from '../components/illustrations/Backdrop'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.message || 'Erreur de connexion')
      }

      // La session vit dans un cookie HttpOnly posé par le serveur :
      // rien n'est stocké côté navigateur.
      invalidateCurrentUser()

      if (!data.redirectTo) {
        throw new Error("Aucun rôle n'est associé à ce compte")
      }

      router.push(data.redirectTo)
    } catch (err: any) {
      setError(err.message || 'Erreur serveur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Connexion · Open Campus Africa</title>
      </Head>

      <main className="grid min-h-screen bg-page lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — brand panel */}
        <aside
          className="relative hidden overflow-hidden px-14 py-12 lg:flex lg:flex-col lg:justify-between"
          style={{
            background:
              'radial-gradient(130% 100% at 15% 0%, #16386f 0%, #0b2a68 44%, #071c4a 100%)',
          }}
        >
          <Aurora />
          <GridField tone="dark" />
          <Orbits
            tone="dark"
            className="left-1/2 top-[46%] h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 opacity-60"
          />

          <div className="relative">
            <Wordmark tone="white" />
          </div>

          <div className="relative flex flex-1 items-center justify-center py-6">
            <AuthScene className="w-full max-w-[380px] animate-float-slow" />
          </div>

          <div className="relative max-w-md">
            <h2 className="text-3xl font-medium leading-tight tracking-tightest text-white">
              Repenser l’université.
              <br />
              Structurer l’avenir.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/60">
              L’environnement académique numérique des universités africaines —
              cours, crédits, sessions live et progression, réunis.
            </p>
          </div>

          <NoiseOverlay />
        </aside>

        {/* RIGHT — form */}
        <section className="flex items-center justify-center px-6 py-16 sm:px-12">
          <div className="w-full max-w-sm animate-fade-up">
            <div className="mb-10 lg:hidden">
              <Wordmark />
            </div>

            <h1 className="text-[28px] font-medium tracking-tightest text-ink">
              Bon retour
            </h1>
            <p className="text-ink/55 mt-2 text-[15px]">
              Connectez-vous pour accéder à votre espace.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <Input
                label="Email"
                type="email"
                required
                autoComplete="email"
                placeholder="nom@universite.africa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="Mot de passe"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

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
                size="lg"
                loading={loading}
                className="w-full"
              >
                {loading ? 'Connexion…' : 'Se connecter'}
              </Button>
            </form>

            <p className="text-ink/45 mt-8 text-center text-sm">
              Pas encore de compte ?{' '}
              <Link href="/" className="font-medium text-apple hover:underline">
                Contacter votre université
              </Link>
            </p>
          </div>
        </section>
      </main>
    </>
  )
}
