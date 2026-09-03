import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../../lib/pageGuard'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AppShell } from '../../../components/app/AppShell'
import { Card } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button, buttonClasses } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { LoadError } from '../../../components/admin/LoadState'
import { useToast } from '../../../components/overlay/Toast'
import { SETUP_STEPS } from '../../../lib/institutionSetup'
import type { SetupProgress } from '../../../lib/institutionSetup'
import { CheckIcon, UsersIcon } from '../../../components/ui/icons'

/**
 * Fiche d'un établissement, côté super administrateur.
 *
 * Elle sert à comprendre et à dépanner, pas à administrer au quotidien : la
 * structure académique, les cours et les étudiants restent le métier de
 * l'administrateur de l'établissement. La seule action offerte ici est celle
 * que personne d'autre ne peut faire — rattacher un administrateur.
 */

interface Detail {
  id: string
  name: string
  slug: string
  country: string | null
  status: 'active' | 'inactive'
  createdAt: string
  setup: SetupProgress
  setupDone: number
  setupTotal: number
  counts: {
    admins: number
    professors: number
    students: number
    faculties: number
    programs: number
    academicYears: number
    semesters: number
    courses: number
    activeEnrollments: number
  }
  admins: {
    membershipId: string
    userId: string
    email: string
    name: string | null
    membershipActive: boolean
    accountActive: boolean
    since: string
  }[]
  activity: {
    id: string
    action: string
    entityType: string
    createdAt: string
    actor: string
  }[]
  lastActivityAt: string | null
}

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

export default function InstitutionDetail() {
  const router = useRouter()
  const { toast } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [attaching, setAttaching] = useState(false)
  /** Confirmation en cours pour une ligne : rien n'est fait sans elle. */
  const [confirming, setConfirming] = useState<{
    membershipId: string
    action: 'revoke' | 'restore' | 'reset'
  } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /**
   * Mot de passe provisoire, gardé en mémoire de page uniquement : il
   * disparaît au rechargement, et rien ne permet de le réafficher.
   */
  const [reset, setReset] = useState<{
    membershipId: string
    email: string
    password: string
  } | null>(null)

  const id = typeof router.query.institutionId === 'string'
    ? router.query.institutionId
    : ''

  const load = useCallback(async () => {
    if (!id) return
    const response = await fetch(`/api/superadmin/institutions/${id}`)
    if (response.status === 404) {
      setNotFound(true)
      return
    }
    if (!response.ok) throw new Error('unavailable')
    setDetail(await response.json())
    setLoadFailed(false)
  }, [id])

  const retry = useCallback(() => {
    setRetrying(true)
    load()
      .catch(() => setLoadFailed(true))
      .then(() => setRetrying(false))
  }, [load])

  useEffect(() => {
    load().catch(() => setLoadFailed(true))
  }, [load])

  /** Retirer ou rétablir l'accès administrateur d'une personne. */
  const setAccess = useCallback(
    async (membershipId: string, action: 'revoke' | 'restore') => {
      setBusy(membershipId)
      try {
        const response = await fetch(
          `/api/superadmin/institutions/${id}/admins/${membershipId}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          }
        )
        const data = await response.json().catch(() => ({}))

        if (!response.ok) {
          toast({
            title:
              data.code === 'LAST_ADMIN'
                ? 'Retrait impossible'
                : 'Action impossible',
            description: data.message ?? 'Réessayez dans quelques secondes.',
            tone: 'error',
          })
          return
        }

        setConfirming(null)
        await load().catch(() => setLoadFailed(true))
        toast({
          title: data.message,
          tone: data.outcome === 'UNCHANGED' ? 'info' : 'success',
        })
      } catch {
        toast({
          title: 'Connexion temporairement indisponible',
          description: 'Réessayez dans quelques secondes.',
          tone: 'error',
        })
      } finally {
        setBusy(null)
      }
    },
    [id, load, toast]
  )

  /** Mot de passe provisoire, affiché une seule fois puis oublié. */
  const resetPassword = useCallback(
    async (membershipId: string, email: string) => {
      setBusy(membershipId)
      try {
        const response = await fetch(
          `/api/superadmin/institutions/${id}/admins/${membershipId}/reset-password`,
          { method: 'POST' }
        )
        const data = await response.json().catch(() => ({}))

        if (!response.ok || !data.temporaryPassword) {
          toast({
            title: 'Réinitialisation impossible',
            description: data.message ?? 'Réessayez dans quelques secondes.',
            tone: 'error',
          })
          return
        }

        setConfirming(null)
        setReset({ membershipId, email, password: data.temporaryPassword })
      } catch {
        toast({
          title: 'Connexion temporairement indisponible',
          description: 'Réessayez dans quelques secondes.',
          tone: 'error',
        })
      } finally {
        setBusy(null)
      }
    },
    [id, toast]
  )

  const retour = (
    <Link
      href="/superadmin#universites"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
    >
      ← Retour au pilotage
    </Link>
  )

  if (notFound) {
    return (
      <AppShell
        role="superadmin"
        requiredRole="superadmin"
        title="Université introuvable"
        subtitle="Cette université n’existe pas ou plus"
      >
        {retour}
        <Card>
          <p className="text-[15px] text-ink">
            Aucune université ne correspond à cet identifiant.
          </p>
          <Link
            href="/superadmin"
            className={buttonClasses('primary', 'md', 'no-underline mt-4')}
          >
            Revenir à la liste
          </Link>
        </Card>
      </AppShell>
    )
  }

  // Rien n'a pu être chargé : n'afficher que la panne plutôt que des
  // compteurs à zéro, qui décriraient un établissement vide.
  if (!detail) {
    return (
      <AppShell
        role="superadmin"
        requiredRole="superadmin"
        title="Université"
        subtitle="Fiche de l’établissement"
      >
        {retour}
        {loadFailed ? (
          <LoadError onRetry={retry} retrying={retrying} />
        ) : (
          <p className="text-ink/45 text-sm">Chargement…</p>
        )}
      </AppShell>
    )
  }

  const complet = detail.setupDone === detail.setupTotal
  const adminsActifs = detail.admins.filter(
    (a) => a.membershipActive && a.accountActive
  )
  const manquantes = SETUP_STEPS.filter((s) => !detail.setup[s.key])

  return (
    <AppShell
      role="superadmin"
      requiredRole="superadmin"
      title={detail.name}
      subtitle={`${detail.slug}${detail.country ? ` · ${detail.country}` : ''}`}
    >
      {retour}

      {loadFailed && (
        <LoadError className="mb-5" onRetry={retry} retrying={retrying} />
      )}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {complet ? (
          <Badge tone="success" dot>
            Prête
          </Badge>
        ) : (
          <Badge tone="neutral">
            Configuration {detail.setupDone}/{detail.setupTotal}
          </Badge>
        )}
        {adminsActifs.length === 0 && (
          <Badge tone="warning">Sans administrateur</Badge>
        )}
        <span className="text-ink/40 text-sm">
          Créée le {dateCourte(detail.createdAt)}
        </span>
      </div>

      {/* -------------------------------------------------- chiffres clés */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Étudiants" value={detail.counts.students} />
        <Metric label="Professeurs" value={detail.counts.professors} />
        <Metric label="Cours" value={detail.counts.courses} />
        <Metric
          label="Inscriptions actives"
          value={detail.counts.activeEnrollments}
        />
        <Metric
          label="Administrateurs"
          value={adminsActifs.length}
          alert={adminsActifs.length === 0}
          hint={adminsActifs.length === 0 ? 'Non exploitable' : undefined}
        />
        <MetricTexte
          label="Dernière activité"
          value={dateCourte(detail.lastActivityAt) ?? 'Aucune'}
        />
      </div>

      {/* ------------------------------------------- état de configuration */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          État de configuration
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          {complet
            ? 'Toutes les étapes de mise en route sont faites.'
            : `${detail.setupDone} étape(s) sur ${detail.setupTotal}. Ces étapes se réalisent depuis l’espace de l’établissement, par son administrateur — le super administrateur ne peut pas les faire à sa place.`}
        </p>

        <ul className="mt-4 space-y-2">
          {SETUP_STEPS.map((step) => {
            const fait = detail.setup[step.key]
            return (
              <li key={step.key} className="flex items-start gap-3">
                <span
                  className={
                    'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ' +
                    (fait
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-50 text-amber-600')
                  }
                >
                  {fait ? <CheckIcon size={12} /> : '·'}
                </span>
                <span className="min-w-0">
                  <span
                    className={
                      'block text-[15px] font-medium ' +
                      (fait ? 'text-ink' : 'text-ink/60')
                    }
                  >
                    {step.label}
                    {!fait && (
                      <span className="text-amber-600"> · manquant</span>
                    )}
                  </span>
                  <span className="text-ink/45 block text-sm">{step.why}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </Card>

      {/* --------------------------------------------------- volumétrie */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Volumétrie
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          Ce que contient l’établissement aujourd’hui.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Compact label="Facultés" value={detail.counts.faculties} />
          <Compact label="Programmes" value={detail.counts.programs} />
          <Compact
            label="Années universitaires"
            value={detail.counts.academicYears}
          />
          <Compact label="Semestres" value={detail.counts.semesters} />
          <Compact label="Cours" value={detail.counts.courses} />
        </div>
      </Card>

      {/* ------------------------------------------------ administrateurs */}
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Administrateurs
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              Les personnes qui peuvent ouvrir et piloter cet établissement.
            </p>
          </div>
          <button
            onClick={() => setAttaching((v) => !v)}
            className={buttonClasses(
              attaching ? 'secondary' : adminsActifs.length === 0 ? 'primary' : 'secondary',
              'md'
            )}
          >
            {attaching ? 'Masquer' : 'Rattacher un administrateur'}
          </button>
        </div>

        {adminsActifs.length === 0 && (
          <div className="mb-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm font-medium text-amber-900">
              Cette université n’a aucun administrateur actif.
            </p>
            <p className="mt-0.5 text-sm text-amber-800">
              Personne ne peut y créer de faculté, de cours ni d’étudiant. Elle
              restera inexploitable jusqu’à ce qu’un administrateur lui soit
              rattaché.
            </p>
          </div>
        )}

        {detail.admins.length === 0 ? (
          <p className="text-ink/45 text-sm">
            Aucun compte administrateur n’a jamais été rattaché.
          </p>
        ) : (
          <ul className="space-y-2">
            {detail.admins.map((a) => {
              const actif = a.membershipActive && a.accountActive
              // Le dernier administrateur opérationnel ne peut pas être
              // retiré : l'écran le dit avant que le serveur ne le refuse.
              const dernier = actif && adminsActifs.length === 1
              const enCours = busy === a.membershipId
              const confirmation =
                confirming?.membershipId === a.membershipId
                  ? confirming.action
                  : null

              return (
                <li
                  key={a.membershipId}
                  className="rounded-card border border-hairline p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {a.name ?? a.email}
                      </p>
                      <p className="text-ink/45 truncate text-sm">{a.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {actif ? (
                        <Badge tone="success">Actif</Badge>
                      ) : !a.accountActive ? (
                        <Badge tone="warning">Compte désactivé</Badge>
                      ) : (
                        <Badge tone="warning">Accès retiré</Badge>
                      )}
                      <span className="text-ink/35 text-sm">
                        depuis le {dateCourte(a.since)}
                      </span>
                    </div>
                  </div>

                  {/* ------------------------------------------- actions */}
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
                    <button
                      onClick={() =>
                        setConfirming({
                          membershipId: a.membershipId,
                          action: 'reset',
                        })
                      }
                      disabled={enCours}
                      className={buttonClasses('ghost', 'md')}
                    >
                      Réinitialiser le mot de passe
                    </button>
                    {a.membershipActive ? (
                      <button
                        onClick={() =>
                          setConfirming({
                            membershipId: a.membershipId,
                            action: 'revoke',
                          })
                        }
                        disabled={enCours || dernier}
                        title={
                          dernier
                            ? 'Cette université doit conserver au moins un administrateur actif.'
                            : undefined
                        }
                        className={buttonClasses('ghost', 'md', 'text-red-600 hover:bg-red-50')}
                      >
                        Retirer l’accès
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setConfirming({
                            membershipId: a.membershipId,
                            action: 'restore',
                          })
                        }
                        disabled={enCours}
                        className={buttonClasses('ghost', 'md')}
                      >
                        Rétablir l’accès
                      </button>
                    )}
                  </div>

                  {/* Pourquoi le retrait est indisponible, plutôt qu'un
                      bouton grisé sans explication. */}
                  {dernier && (
                    <p className="text-ink/45 mt-2 text-sm">
                      Cette université doit conserver au moins un
                      administrateur actif. Rattachez-en un autre avant de
                      retirer celui-ci.
                    </p>
                  )}

                  {/* --------------------------------------- confirmation */}
                  {confirmation && (
                    <div className="mt-3 rounded-card border border-hairline bg-cloud/60 p-3">
                      {confirmation === 'revoke' && (
                        <p className="text-sm text-ink">
                          Retirer l’accès administrateur de{' '}
                          <span className="font-medium">{a.email}</span> pour
                          cette université ? Son compte est conservé, ainsi que
                          ses éventuels autres rôles et ses autres
                          établissements. Seul l’accès administrateur à{' '}
                          {detail.name} est retiré, et il peut être rétabli.
                        </p>
                      )}
                      {confirmation === 'restore' && (
                        <p className="text-sm text-ink">
                          Rétablir l’accès administrateur de{' '}
                          <span className="font-medium">{a.email}</span> pour
                          cette université ? Cette personne pourra de nouveau
                          ouvrir et piloter {detail.name}.
                        </p>
                      )}
                      {confirmation === 'reset' && (
                        <p className="text-sm text-ink">
                          Réinitialiser le mot de passe de{' '}
                          <span className="font-medium">{a.email}</span> ? Un
                          mot de passe provisoire sera affiché{' '}
                          <span className="font-medium">une seule fois</span> —
                          notez-le, il ne sera pas envoyé par email et ne
                          pourra pas être réaffiché. Les sessions déjà ouvertes
                          peuvent rester actives.
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="md"
                          className={
                            confirmation === 'revoke'
                              ? 'bg-red-600 hover:bg-red-700'
                              : undefined
                          }
                          disabled={enCours}
                          onClick={() =>
                            confirmation === 'reset'
                              ? resetPassword(a.membershipId, a.email)
                              : setAccess(a.membershipId, confirmation)
                          }
                        >
                          {enCours
                            ? 'En cours…'
                            : confirmation === 'revoke'
                            ? 'Retirer l’accès'
                            : confirmation === 'restore'
                            ? 'Rétablir'
                            : 'Réinitialiser'}
                        </Button>
                        <Button
                          size="md"
                          variant="secondary"
                          disabled={enCours}
                          onClick={() => setConfirming(null)}
                        >
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ------------------- mot de passe, affiché une seule fois */}
                  {reset?.membershipId === a.membershipId && (
                    <div className="mt-3 rounded-card border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-900">
                        Mot de passe provisoire de {reset.email}
                      </p>
                      <p className="mt-1.5 break-all rounded-xl border border-amber-200 bg-white px-3 py-2 font-mono text-[15px] text-ink">
                        {reset.password}
                      </p>
                      <p className="mt-1.5 text-sm text-amber-800">
                        Transmettez-le par un canal sûr. Il ne sera plus
                        affiché après fermeture, ni au rechargement de la page.
                      </p>
                      <Button
                        size="md"
                        variant="secondary"
                        className="mt-3"
                        onClick={() => setReset(null)}
                      >
                        J’ai noté ce mot de passe
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {attaching && (
          <div className="mt-4 border-t border-hairline pt-4">
            <AttachAdminForm
              institutionId={detail.id}
              institutionName={detail.name}
              onDone={(message) => {
                load()
                toast({ title: message, tone: 'success' })
              }}
            />
          </div>
        )}
      </Card>

      {/* ------------------------------------------------ actions support */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Actions support
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          Ce que le super administrateur peut faire pour cet établissement.
        </p>

        <ul className="mt-4 space-y-3">
          <li className="rounded-card border border-hairline p-3">
            <p className="text-[15px] font-medium text-ink">
              Rattacher un administrateur
            </p>
            <p className="text-ink/50 mt-0.5 text-sm">
              La seule réparation que personne d’autre ne peut faire : rendre
              un établissement à nouveau pilotable.
            </p>
            <button
              onClick={() => setAttaching(true)}
              className={buttonClasses('secondary', 'md', 'mt-3')}
            >
              <UsersIcon size={17} /> Rattacher
            </button>
          </li>

          {!complet && (
            <li className="rounded-card border border-hairline p-3">
              <p className="text-[15px] font-medium text-ink">
                Terminer la mise en route
              </p>
              <p className="text-ink/50 mt-0.5 text-sm">
                Il manque : {manquantes.map((s) => s.label).join(', ')}. Ces
                étapes relèvent de l’administrateur de l’établissement, depuis
                son propre espace. Aucun bouton ici ne les remplacerait.
              </p>
            </li>
          )}
        </ul>
      </Card>

      {/* -------------------------------------------------------- activité */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Activité récente
        </h2>
        <p className="text-ink/45 mb-4 mt-0.5 text-sm">
          Les dernières actions enregistrées pour cette université.
        </p>

        {detail.activity.length === 0 ? (
          <p className="text-ink/45 text-sm">
            Aucune activité récente pour cette université.
          </p>
        ) : (
          <ul className="space-y-1">
            {detail.activity.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl px-2 py-2 hover:bg-cloud"
              >
                <span className="min-w-0 flex-1 basis-56">
                  <span className="block truncate text-[15px] text-ink">
                    {entry.actor}
                  </span>
                  <span className="text-ink/45 block truncate font-mono text-[13px]">
                    {entry.action}
                  </span>
                </span>
                <span className="text-ink/40 shrink-0 text-sm">
                  {dateCourte(entry.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
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

function MetricTexte({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-hero border border-hairline bg-white p-4 shadow-soft">
      <p className="truncate text-[15px] font-medium tracking-tight text-ink">
        {value}
      </p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
    </div>
  )
}

function Compact({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-lg font-medium tracking-tight text-ink">{value}</p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
    </div>
  )
}

/**
 * Rattachement d'un administrateur.
 *
 * Une adresse déjà connue n'est jamais rattachée en silence : cela donnerait
 * à quelqu'un les pleins droits sur un établissement sans que le super
 * administrateur l'ait voulu explicitement.
 */
function AttachAdminForm({
  institutionId,
  institutionName,
  onDone,
}: {
  institutionId: string
  institutionName: string
  onDone: (message: string) => void
}) {
  const vide = { firstName: '', lastName: '', email: '' }
  const [form, setForm] = useState(vide)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState<{
    message: string
    adminEmail: string
    temporaryPassword: string | null
    accountInactive?: boolean
  } | null>(null)

  const set = (k: keyof typeof vide, v: string) =>
    setForm((p) => ({ ...p, [k]: v }))

  const submit = async (attachExisting: boolean) => {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(
        `/api/superadmin/institutions/${institutionId}/admins`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, attachExisting }),
        }
      )
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        if (data.code === 'USER_EXISTS') {
          setConfirm(true)
          setError(data.message)
          return
        }
        setConfirm(false)
        setError(data.message || 'Rattachement impossible')
        return
      }

      setResult(data)
      setForm(vide)
      setConfirm(false)
      onDone(data.message)
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
          {result.message}
        </p>

        {result.accountInactive && (
          <p className="mt-1 text-sm text-amber-800">
            Attention : ce compte est désactivé au niveau de la plateforme. Il
            ne pourra pas se connecter tant qu’il ne sera pas réactivé.
          </p>
        )}

        {result.temporaryPassword ? (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3">
            <p className="text-ink/50 text-sm">
              Mot de passe provisoire — il ne s’affichera qu’une fois :
            </p>
            <p className="mt-1 select-all break-all font-mono text-lg text-ink">
              {result.temporaryPassword}
            </p>
            <p className="text-ink/45 mt-1 text-sm">
              Transmettez-le par un canal sûr.
            </p>
          </div>
        ) : (
          <p className="mt-1 text-sm text-emerald-800">
            Le mot de passe de ce compte n’a pas été modifié.
          </p>
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

  return (
    <div className="space-y-4">
      <p className="text-ink/50 text-sm">
        Si l’adresse est inconnue, un compte est créé avec un mot de passe
        provisoire affiché une seule fois. Si elle correspond à un compte
        existant, une confirmation vous sera demandée et son mot de passe
        restera inchangé.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Prénom"
          hint="Requis pour créer un nouveau compte"
          value={form.firstName}
          onChange={(e) => set('firstName', e.target.value)}
        />
        <Input
          label="Nom"
          value={form.lastName}
          onChange={(e) => set('lastName', e.target.value)}
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => {
            set('email', e.target.value)
            setConfirm(false)
          }}
          placeholder="admin@universite.africa"
        />
      </div>

      {error && (
        <div
          role="alert"
          className={
            'rounded-card px-4 py-3 text-sm ' +
            (confirm
              ? 'border border-amber-100 bg-amber-50 text-amber-800'
              : 'border border-red-100 bg-red-50 text-red-600')
          }
        >
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {confirm ? (
          <>
            <Button size="md" loading={busy} onClick={() => submit(true)}>
              Rattacher à {institutionName}
            </Button>
            <button
              onClick={() => {
                setConfirm(false)
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
              disabled={!form.email.trim()}
              onClick={() => submit(false)}
            >
              Rattacher
            </Button>
            {!form.email.trim() && (
              <span className="text-ink/45 text-sm">
                L’adresse email est requise
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
