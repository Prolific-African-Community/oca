import { useMemo, useState } from 'react'
import { Button, buttonClasses } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'

/**
 * Création de comptes enseignants, à l'unité ou par collage de plusieurs lignes.
 *
 * Il n'y a pas de nouvelle route : chaque enseignant passe par le `POST
 * /api/admin/teachers` existant, qui vérifie l'établissement depuis la session
 * et journalise chaque création. Une création en lot est donc une suite de
 * créations unitaires — plus lente, mais sans nouvelle surface serveur et sans
 * risque de création partielle silencieuse : chaque ligne rapporte son sort.
 */

/** Mot de passe provisoire, à transmettre puis à changer par l'enseignant. */
function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface ParsedRow {
  line: number
  raw: string
  firstName: string
  lastName: string
  email: string
  error?: string
}

/**
 * Analyse le texte collé. Deux formats acceptés :
 *   Prénom Nom, email@exemple.africa
 *   prénom; nom; email@exemple.africa
 */
export function parseProfessorLines(
  text: string,
  existingEmails: Set<string>
): ParsedRow[] {
  const seen = new Set<string>()

  return text
    .split('\n')
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter((entry) => entry.raw.length > 0)
    .map(({ raw, line }) => {
      const parts = raw.includes(';')
        ? raw.split(';').map((p) => p.trim())
        : raw.split(',').map((p) => p.trim())

      let firstName = ''
      let lastName = ''
      let email = ''

      if (parts.length >= 3) {
        firstName = parts[0]
        lastName = parts[1]
        email = parts[2]
      } else if (parts.length === 2) {
        const names = parts[0].split(/\s+/).filter(Boolean)
        firstName = names[0] ?? ''
        lastName = names.slice(1).join(' ')
        email = parts[1]
      }

      const row: ParsedRow = {
        line,
        raw,
        firstName,
        lastName,
        email: email.toLowerCase(),
      }

      if (!firstName || !lastName) {
        row.error = 'Prénom et nom attendus'
      } else if (!EMAIL.test(row.email)) {
        row.error = 'Adresse email invalide'
      } else if (existingEmails.has(row.email)) {
        row.error = 'Cette adresse existe déjà'
      } else if (seen.has(row.email)) {
        row.error = 'Adresse en double dans la liste'
      }

      if (!row.error) seen.add(row.email)
      return row
    })
}

export interface CreatedCredential {
  name: string
  email: string
  password: string
}

async function createOne(row: {
  firstName: string
  lastName: string
  email: string
}): Promise<{ ok: true; credential: CreatedCredential } | { ok: false; message: string }> {
  const password = generatePassword()

  const response = await fetch('/api/admin/teachers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, password }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, message: data.message || 'Création impossible' }
  }

  return {
    ok: true,
    credential: {
      name: `${row.firstName} ${row.lastName}`,
      email: row.email,
      password,
    },
  }
}

/** Identifiants provisoires, affichés une seule fois après création. */
function Credentials({ list }: { list: CreatedCredential[] }) {
  if (list.length === 0) return null

  return (
    <div className="mt-4 rounded-card border border-emerald-100 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-800">
        {list.length} compte(s) créé(s) · mots de passe provisoires
      </p>
      <p className="mt-1 text-sm text-emerald-700">
        Transmettez-les à chaque enseignant. Ils ne seront plus affichés après
        avoir quitté cette page.
      </p>
      <ul className="mt-3 space-y-1.5">
        {list.map((c) => (
          <li key={c.email} className="text-sm text-emerald-900">
            <span className="font-medium">{c.name}</span> · {c.email} ·{' '}
            <code className="rounded bg-white/70 px-1.5 py-0.5">
              {c.password}
            </code>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProfessorCreation({
  existingEmails,
  onCreated,
  onError,
}: {
  existingEmails: Set<string>
  onCreated: (count: number) => void
  onError: (message: string) => void
}) {
  const [mode, setMode] = useState<'one' | 'many'>('one')
  const [single, setSingle] = useState({ firstName: '', lastName: '', email: '' })
  const [pasted, setPasted] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<CreatedCredential[]>([])
  const [failures, setFailures] = useState<string[]>([])

  const rows = useMemo(
    () => (mode === 'many' ? parseProfessorLines(pasted, existingEmails) : []),
    [mode, pasted, existingEmails]
  )
  const valid = rows.filter((r) => !r.error)
  const invalid = rows.filter((r) => r.error)

  const submitSingle = async () => {
    setLoading(true)
    setError('')
    setFailures([])

    const email = single.email.trim().toLowerCase()
    if (!single.firstName.trim() || !single.lastName.trim()) {
      setError('Prénom et nom requis')
      setLoading(false)
      return
    }
    if (!EMAIL.test(email)) {
      setError('Adresse email invalide')
      setLoading(false)
      return
    }

    const result = await createOne({
      firstName: single.firstName.trim(),
      lastName: single.lastName.trim(),
      email,
    })

    if (!result.ok) {
      setError(result.message)
      onError(result.message)
    } else {
      setCredentials([result.credential])
      setSingle({ firstName: '', lastName: '', email: '' })
      onCreated(1)
    }
    setLoading(false)
  }

  const submitMany = async () => {
    if (valid.length === 0) return
    setLoading(true)
    setError('')
    setFailures([])

    const created: CreatedCredential[] = []
    const failed: string[] = []

    // Séquentiel : chaque ligne rapporte son propre résultat, et un refus
    // n'annule pas les créations déjà faites.
    for (const row of valid) {
      const result = await createOne(row)
      if (result.ok) created.push(result.credential)
      else failed.push(`${row.email} — ${result.message}`)
    }

    setCredentials(created)
    setFailures(failed)
    if (created.length > 0) {
      setPasted('')
      onCreated(created.length)
    }
    if (failed.length > 0) {
      onError(`${failed.length} ligne(s) refusée(s)`)
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['one', 'Un enseignant'],
            ['many', 'Plusieurs à la fois'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setMode(key)
              setError('')
            }}
            className={
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors ' +
              (mode === key
                ? 'border-oca bg-oca text-white'
                : 'border-hairline bg-white text-ink/65 hover:bg-cloud')
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'one' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Prénom"
            value={single.firstName}
            onChange={(e) =>
              setSingle((c) => ({ ...c, firstName: e.target.value }))
            }
            placeholder="Aminata"
          />
          <Input
            label="Nom"
            value={single.lastName}
            onChange={(e) =>
              setSingle((c) => ({ ...c, lastName: e.target.value }))
            }
            placeholder="Diop"
          />
          <Input
            label="Adresse email"
            type="email"
            value={single.email}
            onChange={(e) => setSingle((c) => ({ ...c, email: e.target.value }))}
            placeholder="aminata.diop@universite.africa"
          />
        </div>
      ) : (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Un enseignant par ligne
            </span>
            <span className="text-ink/45 mb-2 block text-xs">
              Format accepté : « Prénom Nom, email » ou « prénom ; nom ; email ».
            </span>
            <textarea
              value={pasted}
              rows={6}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={
                'Aminata Diop, aminata.diop@universite.africa\nKofi; Mensah; kofi.mensah@universite.africa'
              }
              className="w-full rounded-card border border-hairline bg-white px-4 py-3 font-mono text-sm leading-relaxed text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
            />
          </label>

          {rows.length > 0 && (
            <div className="mt-4 rounded-card border border-hairline bg-cloud/50 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={valid.length > 0 ? 'success' : 'neutral'}>
                  {valid.length} ligne(s) valide(s)
                </Badge>
                {invalid.length > 0 && (
                  <Badge tone="warning">
                    {invalid.length} ligne(s) ignorée(s)
                  </Badge>
                )}
              </div>
              <ul className="space-y-1 text-sm">
                {rows.map((row) => (
                  <li
                    key={row.line}
                    className={row.error ? 'text-amber-700' : 'text-ink/70'}
                  >
                    <span className="text-ink/35">{row.line}.</span>{' '}
                    {row.error ? (
                      <>
                        {row.raw} — <span className="font-medium">{row.error}</span>
                      </>
                    ) : (
                      <>
                        {row.firstName} {row.lastName} · {row.email}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {invalid.length > 0 && (
                <p className="text-ink/50 mt-3 text-xs">
                  Seules les lignes valides seront créées.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {failures.length > 0 && (
        <div className="mt-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Lignes refusées par le serveur :</p>
          <ul className="mt-1 space-y-0.5">
            {failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <Credentials list={credentials} />

      <div className="mt-4">
        {mode === 'one' ? (
          <Button loading={loading} onClick={submitSingle}>
            Créer le compte
          </Button>
        ) : (
          <Button
            loading={loading}
            disabled={valid.length === 0}
            onClick={submitMany}
          >
            Créer {valid.length} compte(s)
          </Button>
        )}
      </div>
    </div>
  )
}

export { generatePassword, buttonClasses }
