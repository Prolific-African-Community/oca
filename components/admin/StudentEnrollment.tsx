import { useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Badge } from '../ui/Badge'

/**
 * Inscription d'étudiants, à l'unité ou par collage de plusieurs lignes.
 *
 * Il n'y a pas de nouvelle route : chaque étudiant passe par le
 * `POST /api/students/create` existant, qui crée le compte, l'appartenance à
 * l'établissement et l'inscription pédagogique dans une seule transaction —
 * un étudiant est donc toujours rattaché à un programme et un semestre, ou
 * n'est pas créé du tout.
 *
 * Une inscription en lot est une suite d'inscriptions unitaires : plus lente,
 * mais sans nouvelle surface serveur, et chaque ligne rapporte son propre
 * sort. Un refus n'annule pas les créations déjà faites.
 */

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 12 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('')
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface StudentRow {
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
export function parseStudentLines(
  text: string,
  existingEmails: Set<string>
): StudentRow[] {
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

      const row: StudentRow = {
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

export interface Credential {
  name: string
  email: string
  password: string
}

export interface EnrollmentTarget {
  programId: string
  semesterId: string
}

async function createOne(
  row: { firstName: string; lastName: string; email: string },
  target: EnrollmentTarget
): Promise<{ ok: true; credential: Credential } | { ok: false; message: string }> {
  const password = generatePassword()

  const response = await fetch('/api/students/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...row, password, ...target }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { ok: false, message: data.message || 'Inscription impossible' }
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

function Credentials({
  list,
  onDismiss,
}: {
  list: Credential[]
  onDismiss: () => void
}) {
  if (list.length === 0) return null

  return (
    <div className="mt-4 rounded-card border border-emerald-100 bg-emerald-50 p-4">
      <p className="text-sm font-medium text-emerald-800">
        {list.length} inscription(s) · mots de passe provisoires
      </p>
      <p className="mt-1 text-sm text-emerald-700">
        Ces mots de passe sont affichés une seule fois. Transmettez-les à
        chaque étudiant.
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
      <button
        onClick={onDismiss}
        className="mt-3 text-sm font-medium text-emerald-800 hover:underline"
      >
        J’ai noté ces mots de passe
      </button>
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
      >
        <option value="">{placeholder ?? '—'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-ink/45 mt-1 block text-xs">{hint}</span>}
    </label>
  )
}

export interface EnrollmentOptions {
  programs: { id: string; name: string }[]
  academicYears: { id: string; name: string; isCurrent: boolean }[]
  semesters: {
    id: string
    name: string
    programId: string
    academicYearId: string
  }[]
}

export function StudentEnrollment({
  options,
  existingEmails,
  onCreated,
  onError,
}: {
  options: EnrollmentOptions
  existingEmails: Set<string>
  onCreated: (count: number) => void
  onError: (message: string) => void
}) {
  const [mode, setMode] = useState<'one' | 'many'>('one')

  /** Rattachement commun aux deux modes : c'est la même décision. */
  const currentYear = options.academicYears.find((y) => y.isCurrent)
  const [programId, setProgramId] = useState('')
  const [academicYearId, setAcademicYearId] = useState(currentYear?.id ?? '')
  const [semesterId, setSemesterId] = useState('')

  const [single, setSingle] = useState({ firstName: '', lastName: '', email: '' })
  const [pasted, setPasted] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [failures, setFailures] = useState<string[]>([])

  // Le semestre dépend du programme et de l'année : on ne propose que
  // les combinaisons qui existent réellement.
  const semesterOptions = useMemo(
    () =>
      options.semesters
        .filter(
          (s) =>
            s.programId === programId &&
            (!academicYearId || s.academicYearId === academicYearId)
        )
        .map((s) => ({ value: s.id, label: s.name })),
    [options.semesters, programId, academicYearId]
  )

  const rows = useMemo(
    () => (mode === 'many' ? parseStudentLines(pasted, existingEmails) : []),
    [mode, pasted, existingEmails]
  )
  const valid = rows.filter((r) => !r.error)
  const invalid = rows.filter((r) => r.error)

  const targetMissing = !programId || !semesterId

  const submitSingle = async () => {
    setError('')
    setFailures([])

    if (!single.firstName.trim() || !single.lastName.trim()) {
      setError('Prénom et nom requis')
      return
    }
    const email = single.email.trim().toLowerCase()
    if (!EMAIL.test(email)) {
      setError('Adresse email invalide')
      return
    }
    if (existingEmails.has(email)) {
      setError('Cette adresse est déjà utilisée dans votre établissement')
      return
    }

    setLoading(true)
    const result = await createOne(
      {
        firstName: single.firstName.trim(),
        lastName: single.lastName.trim(),
        email,
      },
      { programId, semesterId }
    )

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

    const created: Credential[] = []
    const failed: string[] = []

    for (const row of valid) {
      const result = await createOne(row, { programId, semesterId })
      if (result.ok) created.push(result.credential)
      else failed.push(`${row.email} — ${result.message}`)
    }

    setCredentials(created)
    setFailures(failed)
    if (created.length > 0) {
      setPasted('')
      onCreated(created.length)
    }
    if (failed.length > 0) onError(`${failed.length} ligne(s) refusée(s)`)
    setLoading(false)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ['one', 'Un étudiant'],
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

      {/* --------------------------------------------------- rattachement */}
      <div className="rounded-card border border-hairline bg-cloud/50 p-4">
        <p className="mb-3 text-sm font-medium text-ink">
          Où inscrire {mode === 'one' ? 'cet étudiant' : 'ces étudiants'} ?
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Programme"
            value={programId}
            options={options.programs.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onChange={(v) => {
              setProgramId(v)
              setSemesterId('')
            }}
            placeholder="Choisir un programme"
          />
          <Select
            label="Année universitaire"
            value={academicYearId}
            options={options.academicYears.map((y) => ({
              value: y.id,
              label: y.isCurrent ? `${y.name} · en cours` : y.name,
            }))}
            onChange={(v) => {
              setAcademicYearId(v)
              setSemesterId('')
            }}
            placeholder="Toutes les années"
          />
          <Select
            label="Semestre"
            value={semesterId}
            options={semesterOptions}
            onChange={setSemesterId}
            placeholder="Choisir un semestre"
            hint={
              !programId
                ? 'Choisissez d’abord un programme'
                : semesterOptions.length === 0
                ? 'Aucun semestre pour ce programme et cette année'
                : undefined
            }
          />
        </div>
      </div>

      {/* ----------------------------------------------------- identités */}
      {mode === 'one' ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Input
            label="Prénom"
            value={single.firstName}
            onChange={(e) =>
              setSingle((c) => ({ ...c, firstName: e.target.value }))
            }
            placeholder="Fatou"
          />
          <Input
            label="Nom"
            value={single.lastName}
            onChange={(e) =>
              setSingle((c) => ({ ...c, lastName: e.target.value }))
            }
            placeholder="Traoré"
          />
          <Input
            label="Adresse email"
            type="email"
            value={single.email}
            onChange={(e) => setSingle((c) => ({ ...c, email: e.target.value }))}
            placeholder="fatou.traore@universite.africa"
          />
        </div>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Une ligne par étudiant
            </span>
            <span className="text-ink/45 mb-2 block text-xs">
              Format accepté : « Prénom Nom, email » ou « prénom ; nom ; email ».
            </span>
            <textarea
              value={pasted}
              rows={6}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={
                'Fatou Traoré, fatou.traore@universite.africa\nIbrahim; Cissé; ibrahim.cisse@universite.africa'
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
                        {row.raw} —{' '}
                        <span className="font-medium">{row.error}</span>
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
                  Seules les lignes valides seront inscrites.
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

      <Credentials list={credentials} onDismiss={() => setCredentials([])} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {mode === 'one' ? (
          <Button
            loading={loading}
            disabled={targetMissing}
            onClick={submitSingle}
          >
            Inscrire l’étudiant
          </Button>
        ) : (
          <Button
            loading={loading}
            disabled={targetMissing || valid.length === 0}
            onClick={submitMany}
          >
            Inscrire {valid.length} étudiant(s)
          </Button>
        )}
        {targetMissing && (
          <span className="text-ink/50 text-sm">
            Choisissez un programme et un semestre.
          </span>
        )}
      </div>
    </div>
  )
}
