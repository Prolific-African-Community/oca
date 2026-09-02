import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppShell } from '../../components/app/AppShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button, buttonClasses } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadError } from '../../components/admin/LoadState'
import { AuditFeed } from '../../components/admin/AuditFeed'
import { useToast } from '../../components/overlay/Toast'
import { useRegisterCommands } from '../../components/overlay/command'
import {
  PlusIcon,
  BuildingIcon,
  UsersIcon,
  CheckIcon,
} from '../../components/ui/icons'

/**
 * Cockpit du super administrateur.
 *
 * Il répond à six questions, et à rien d'autre : combien d'universités,
 * lesquelles sont actives, lesquelles ne sont pas configurées, qui les
 * administre, comment en créer une proprement, et où regarder quand l'une
 * d'elles a besoin d'aide.
 *
 * Le super administrateur ne gère pas le quotidien académique : ni facultés,
 * ni cours, ni étudiants. Cela reste le métier de l'administrateur de
 * l'établissement, dans son propre espace.
 */

interface Institution {
  id: string
  name: string
  slug: string
  country: string | null
  status: 'active' | 'inactive'
  adminEmail: string | null
  adminName: string | null
  createdAt: string
  lastActivityAt: string | null
  setup: {
    faculty: boolean
    program: boolean
    academicYear: boolean
    semester: boolean
    course: boolean
    professor: boolean
    student: boolean
  }
  setupDone: number
  setupTotal: number
  counts: {
    admins: number
    professors: number
    students: number
    programs: number
    courses: number
    faculties: number
    academicYears: number
    semesters: number
  }
}

interface Overview {
  totals: {
    institutions: number
    activeInstitutions: number
    inactiveInstitutions: number
    admins: number
    professors: number
    students: number
    programs: number
    courses: number
    publishedCourses: number
  }
  institutions: Institution[]
}

const EMPTY: Overview = {
  totals: {
    institutions: 0,
    activeInstitutions: 0,
    inactiveInstitutions: 0,
    admins: 0,
    professors: 0,
    students: 0,
    programs: 0,
    courses: 0,
    publishedCourses: 0,
  },
  institutions: [],
}

/** Libellés des étapes de mise en route, dans l'ordre des dépendances. */
const SETUP_LABELS: { key: keyof Institution['setup']; label: string }[] = [
  { key: 'faculty', label: 'Faculté' },
  { key: 'program', label: 'Programme' },
  { key: 'academicYear', label: 'Année universitaire' },
  { key: 'semester', label: 'Semestre' },
  { key: 'course', label: 'Cours' },
  { key: 'professor', label: 'Professeur' },
  { key: 'student', label: 'Étudiant' },
]

function dateCourte(value: string | null) {
  if (!value) return null
  const d = new Date(value)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function SuperAdminCockpit() {
  const { toast } = useToast()
  const [overview, setOverview] = useState<Overview>(EMPTY)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [creating, setCreating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    const response = await fetch('/api/superadmin/overview')
    if (!response.ok) throw new Error('unavailable')
    const data = await response.json()
    setOverview({ ...EMPTY, ...data })
    setLoadFailed(false)
    setLoaded(true)
  }, [])

  const retry = useCallback(() => {
    setRetrying(true)
    load()
      .catch(() => setLoadFailed(true))
      .then(() => setRetrying(false))
  }, [load])

  useEffect(() => {
    load().catch(() => setLoadFailed(true))
  }, [load])

  useRegisterCommands(
    'super:actions',
    [
      {
        id: 'super:new-university',
        label: 'Créer une université',
        hint: 'Nouveau',
        group: 'Actions',
        icon: <PlusIcon size={17} />,
        perform: () => setCreating(true),
      },
    ],
    []
  )

  const totals = overview.totals
  const universities = overview.institutions

  const sansAdmin = useMemo(
    () => universities.filter((u) => u.counts.admins === 0),
    [universities]
  )
  const incompletes = useMemo(
    () => universities.filter((u) => u.setupDone < u.setupTotal),
    [universities]
  )

  // Rien n'a pu être chargé : n'afficher que la panne. Des compteurs à zéro
  // décriraient un réseau vide, ce qui est faux et trompeur.
  if (loadFailed && !loaded) {
    return (
      <AppShell
        role="superadmin"
        requiredRole="superadmin"
        title="Pilotage"
        subtitle="Les universités du réseau"
      >
        <LoadError onRetry={retry} retrying={retrying} />
      </AppShell>
    )
  }

  return (
    <AppShell
      role="superadmin"
      requiredRole="superadmin"
      title="Pilotage"
      subtitle="Les universités du réseau"
      action={
        !creating ? (
          <button
            onClick={() => setCreating(true)}
            className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}
          >
            <PlusIcon size={18} /> Créer une université
          </button>
        ) : null
      }
    >
      {loadFailed && (
        <LoadError className="mb-5" onRetry={retry} retrying={retrying} />
      )}

      {/* -------------------------------------------------- chiffres clés */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Universités" value={totals.institutions} />
        <Metric
          label="Actives"
          value={totals.activeInstitutions}
          hint={
            totals.inactiveInstitutions > 0
              ? `${totals.inactiveInstitutions} inactive(s)`
              : 'Toutes actives'
          }
        />
        <Metric
          label="Sans administrateur"
          value={sansAdmin.length}
          hint="Non exploitables"
          alert={sansAdmin.length > 0}
        />
        <Metric
          label="Configuration à finir"
          value={incompletes.length}
          hint="Mise en route incomplète"
          alert={incompletes.length > 0}
        />
        <Metric label="Étudiants" value={totals.students} />
        <Metric label="Professeurs" value={totals.professors} />
      </div>

      {/* ------------------------------------------- créer une université */}
      <Card className="mt-5" id="creer">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Créer une université
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              L’établissement et son administrateur principal sont créés
              ensemble : sans administrateur, personne ne pourrait l’ouvrir.
            </p>
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className={buttonClasses(creating ? 'secondary' : 'primary', 'md')}
          >
            {creating ? 'Masquer' : 'Créer une université'}
          </button>
        </div>

        {creating && (
          <CreationForm
            onCreated={(created) => {
              load()
              toast({
                title: 'Université créée',
                description: created.name,
                tone: 'success',
              })
            }}
          />
        )}
      </Card>

      {/* ------------------------------------------------- à compléter */}
      {(sansAdmin.length > 0 || incompletes.length > 0) && (
        <Card className="mt-5">
          <h2 className="text-[17px] font-medium tracking-tight text-ink">
            À compléter
          </h2>
          <p className="text-ink/45 mt-0.5 text-sm">
            Ces universités ne sont pas encore pleinement opérationnelles.
          </p>

          <ul className="mt-4 space-y-2">
            {sansAdmin.map((u) => (
              <li
                key={`admin-${u.id}`}
                className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3"
              >
                <p className="text-sm font-medium text-amber-900">
                  {u.name} n’a aucun administrateur
                </p>
                <p className="mt-0.5 text-sm text-amber-800">
                  Personne ne peut ouvrir cet établissement ni y créer quoi que
                  ce soit. Rattachez-lui un administrateur pour le rendre
                  exploitable.
                </p>
              </li>
            ))}
            {incompletes
              .filter((u) => u.counts.admins > 0)
              .map((u) => {
                const manquantes = SETUP_LABELS.filter(
                  (s) => !u.setup[s.key]
                ).map((s) => s.label)
                return (
                  <li
                    key={`setup-${u.id}`}
                    className="rounded-card border border-hairline px-4 py-3"
                  >
                    <p className="text-[15px] font-medium text-ink">
                      {u.name}
                      <span className="text-ink/45 font-normal">
                        {' '}
                        · {u.setupDone}/{u.setupTotal} étapes
                      </span>
                    </p>
                    <p className="text-ink/50 mt-0.5 text-sm">
                      Il manque : {manquantes.join(', ')}.
                    </p>
                  </li>
                )
              })}
          </ul>
        </Card>
      )}

      {/* ---------------------------------------------------- universités */}
      <section id="universites" className="mt-5 scroll-mt-24">
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium tracking-tight text-ink">
                Universités
              </h2>
              <p className="text-ink/45 mt-0.5 text-sm">
                Les établissements du réseau, leur administrateur et leur état
                de mise en route.
              </p>
            </div>
          </div>

          {universities.length === 0 ? (
            <EmptyState
              icon={<BuildingIcon size={22} />}
              title="Aucune université"
              description="Le réseau est vide. Créez la première université : son administrateur pourra ensuite bâtir sa structure académique, ses cours et ses cohortes."
              action={
                <button
                  onClick={() => setCreating(true)}
                  className={buttonClasses('primary', 'md')}
                >
                  <PlusIcon size={17} /> Créer une université
                </button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {universities.map((u) => {
                const ouvert = expanded === u.id
                return (
                  <li
                    key={u.id}
                    className="rounded-card border border-hairline p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 basis-64">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {u.name}
                        </p>
                        <p className="text-ink/45 truncate font-mono text-[13px]">
                          {u.slug}
                          {u.country ? ` · ${u.country}` : ''}
                        </p>
                        <p className="text-ink/50 mt-1 truncate text-sm">
                          {u.adminEmail
                            ? `Admin · ${u.adminName ?? u.adminEmail}`
                            : 'Aucun administrateur'}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadges institution={u} />
                      </div>
                    </div>

                    <p className="text-ink/45 mt-2 text-sm">
                      {u.counts.students} étudiant(s) · {u.counts.professors}{' '}
                      professeur(s) · {u.counts.courses} cours
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <button
                        onClick={() => setExpanded(ouvert ? null : u.id)}
                        className="text-ink/50 text-sm font-medium hover:underline"
                        aria-expanded={ouvert}
                      >
                        {ouvert ? 'Masquer le détail' : 'Voir le détail'}
                      </button>
                      <span className="text-ink/35 text-sm">
                        {u.lastActivityAt
                          ? `Dernière activité · ${dateCourte(u.lastActivityAt)}`
                          : 'Aucune activité enregistrée'}
                      </span>
                    </div>

                    {ouvert && (
                      <div className="mt-3 rounded-xl border border-hairline bg-cloud/50 p-3">
                        <p className="text-ink/50 mb-2 text-sm">
                          Mise en route · {u.setupDone}/{u.setupTotal}
                        </p>
                        <ul className="grid gap-1.5 sm:grid-cols-2">
                          {SETUP_LABELS.map((s) => (
                            <li
                              key={s.key}
                              className="flex items-center gap-2 text-sm"
                            >
                              <span
                                className={
                                  'grid h-5 w-5 shrink-0 place-items-center rounded-full ' +
                                  (u.setup[s.key]
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-cloud text-ink/30')
                                }
                              >
                                {u.setup[s.key] ? <CheckIcon size={12} /> : '·'}
                              </span>
                              <span
                                className={
                                  u.setup[s.key] ? 'text-ink/70' : 'text-ink/40'
                                }
                              >
                                {s.label}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="text-ink/40 mt-3 text-sm">
                          Créée le {dateCourte(u.createdAt)} ·{' '}
                          {u.counts.faculties} faculté(s) ·{' '}
                          {u.counts.programs} programme(s) ·{' '}
                          {u.counts.semesters} semestre(s)
                        </p>
                        <p className="text-ink/40 mt-1 text-sm">
                          La structure académique se gère depuis l’espace de
                          l’établissement, par son administrateur.
                        </p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </section>

      {/* ------------------------------------------------------- activité */}
      <section id="activite" className="mt-5 scroll-mt-24">
        <Card>
          <h2 className="text-[17px] font-medium tracking-tight text-ink">
            Activité récente
          </h2>
          <p className="text-ink/45 mb-4 mt-0.5 text-sm">
            Les actions enregistrées dans le journal, tous établissements
            confondus.
          </p>
          <AuditFeed limit={8} />
        </Card>
      </section>
    </AppShell>
  )
}

/** Indicateurs d'état, tous calculés sur des données réelles. */
function StatusBadges({ institution }: { institution: Institution }) {
  const u = institution
  const complet = u.setupDone === u.setupTotal

  if (u.counts.admins === 0) {
    return <Badge tone="warning">Sans admin</Badge>
  }

  return (
    <>
      {u.status === 'inactive' && <Badge tone="warning">Inactive</Badge>}
      {complet ? (
        <Badge tone="success" dot>
          Prête
        </Badge>
      ) : (
        <Badge tone="neutral">
          Configuration {u.setupDone}/{u.setupTotal}
        </Badge>
      )}
      {u.counts.courses === 0 && <Badge tone="warning">Aucun cours</Badge>}
      {u.counts.professors === 0 && (
        <Badge tone="warning">Aucun professeur</Badge>
      )}
      {u.counts.students === 0 && <Badge tone="warning">Aucun étudiant</Badge>}
    </>
  )
}

function Metric({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: number
  hint?: string
  alert?: boolean
}) {
  return (
    <div className="min-w-0 rounded-hero border border-hairline bg-white p-4 shadow-soft">
      <p
        className={
          'text-2xl font-medium tracking-tight ' +
          (alert ? 'text-amber-600' : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
      {hint && <p className="text-ink/40 mt-0.5 text-xs">{hint}</p>}
    </div>
  )
}

/**
 * Formulaire de création.
 *
 * Le mot de passe provisoire n'est pas saisi ici : il est généré par le
 * serveur et affiché une seule fois, après création. Une adresse déjà connue
 * n'est rattachée qu'après confirmation explicite.
 */
function CreationForm({
  onCreated,
}: {
  onCreated: (created: { name: string }) => void
}) {
  const vide = {
    name: '',
    slug: '',
    country: '',
    adminFirstName: '',
    adminLastName: '',
    adminEmail: '',
  }
  const [form, setForm] = useState(vide)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmEmail, setConfirmEmail] = useState(false)
  const [result, setResult] = useState<{
    name: string
    slug: string
    adminEmail: string
    adminExisted: boolean
    temporaryPassword: string | null
  } | null>(null)

  const set = (k: keyof typeof vide, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  const submit = async (attachExisting: boolean) => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/universities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, attachExisting }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        // Une adresse déjà connue n'est pas une erreur : c'est une décision
        // à prendre. L'écran la présente comme telle.
        if (data.code === 'EMAIL_EXISTS') {
          setConfirmEmail(true)
          setError(data.message)
          return
        }
        setConfirmEmail(false)
        setError(data.message || 'Création impossible')
        return
      }

      setResult(data)
      setForm(vide)
      setConfirmEmail(false)
      onCreated(data)
    } catch {
      setError('Connexion temporairement indisponible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <div className="rounded-card border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-[15px] font-medium text-emerald-900">
          {result.name} est créée.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Administrateur : {result.adminEmail}
          {result.adminExisted
            ? ' — compte existant rattaché, son mot de passe est inchangé.'
            : ''}
        </p>

        {result.temporaryPassword && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
            <p className="text-ink/50 text-sm">
              Mot de passe provisoire — il ne s’affichera qu’une fois :
            </p>
            <p className="mt-1 select-all font-mono text-lg text-ink">
              {result.temporaryPassword}
            </p>
            <p className="text-ink/45 mt-1 text-sm">
              Transmettez-le à l’administrateur par un canal sûr.
            </p>
          </div>
        )}

        <button
          onClick={() => setResult(null)}
          className="mt-3 text-sm font-medium text-emerald-800 hover:underline"
        >
          J’ai noté ces informations
        </button>
      </div>
    )
  }

  const pret = form.name.trim() !== '' && form.adminEmail.trim() !== ''

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nom de l’université"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Université de Cocody"
        />
        <Input
          label="Identifiant (optionnel)"
          hint="Sert dans les URL. Déduit du nom si laissé vide."
          value={form.slug}
          onChange={(e) => set('slug', e.target.value)}
          placeholder="universite-cocody"
        />
        <Input
          label="Pays (optionnel)"
          value={form.country}
          onChange={(e) => set('country', e.target.value)}
          placeholder="Côte d’Ivoire"
        />
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-ink/70">
          Administrateur principal
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Prénom (optionnel)"
            value={form.adminFirstName}
            onChange={(e) => set('adminFirstName', e.target.value)}
          />
          <Input
            label="Nom (optionnel)"
            value={form.adminLastName}
            onChange={(e) => set('adminLastName', e.target.value)}
          />
          <Input
            label="Email"
            type="email"
            value={form.adminEmail}
            onChange={(e) => {
              set('adminEmail', e.target.value)
              setConfirmEmail(false)
            }}
            placeholder="admin@universite.africa"
          />
        </div>
        <p className="text-ink/45 mt-2 text-sm">
          Un mot de passe provisoire sera généré et affiché une seule fois.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className={
            'rounded-card px-4 py-3 text-sm ' +
            (confirmEmail
              ? 'border border-amber-100 bg-amber-50 text-amber-800'
              : 'border border-red-100 bg-red-50 text-red-600')
          }
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {confirmEmail ? (
          <>
            <Button size="md" loading={busy} onClick={() => submit(true)}>
              Rattacher ce compte existant
            </Button>
            <button
              onClick={() => {
                setConfirmEmail(false)
                setError('')
              }}
              className="text-ink/60 text-sm font-medium hover:underline"
            >
              Annuler
            </button>
          </>
        ) : (
          <>
            <Button
              size="md"
              loading={busy}
              disabled={!pret}
              onClick={() => submit(false)}
            >
              Créer l’université
            </Button>
            {!pret && (
              <span className="text-ink/45 text-sm">
                Le nom et l’email de l’administrateur sont requis
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Protection côté serveur : la page n'est rendue que pour un super administrateur.
export const getServerSideProps = requireRoleSSR([Role.SUPER_ADMIN])
