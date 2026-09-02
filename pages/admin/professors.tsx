import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { LoadError } from '../../components/admin/LoadState'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Button, buttonClasses } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/overlay/Toast'
import { ProfessorCreation } from '../../components/admin/ProfessorCreation'
import { CapIcon, BookIcon } from '../../components/ui/icons'

/**
 * Espace de gestion des enseignants.
 *
 * L'administrateur y crée les comptes, les affecte aux cours, et voit d'un
 * coup d'œil ce qui reste à faire : un cours sans enseignant ne sera préparé
 * par personne, un enseignant sans cours n'a rien à préparer. Les deux
 * manques sont donc affichés, pas seulement les totaux.
 */

interface Teacher {
  id: string
  email: string
  firstName: string
  lastName: string
  assignmentCount: number
  isActive: boolean
}

/** Identifiants provisoires, montrés une fois puis oubliés. */
interface TemporaryPassword {
  teacherId: string
  email: string
  password: string
}

interface Assignment {
  id: string
  role: string
  user: { id: string; firstName: string | null; lastName: string | null; email: string }
  course: {
    id: string
    title: string
    code: string
    credits: number
    program: { name: string; code: string }
    semester: { name: string }
  }
}

interface Course {
  id: string
  title: string
  code: string
  credits: number
  semesterId: string
  programId: string
}

const ROLE_LABELS: Record<string, string> = {
  LEAD: 'Responsable',
  CO_TEACHER: 'Co-enseignant',
  ASSISTANT: 'Assistant',
}

/** Rôles proposés à l'affectation, dans l'ordre où on les choisit. */
const ROLES = ['LEAD', 'CO_TEACHER', 'ASSISTANT'] as const

const displayName = (t: { firstName: string | null; lastName: string | null; email: string }) =>
  [t.firstName, t.lastName].filter(Boolean).join(' ') || t.email

function Metric({
  label,
  value,
  alert,
}: {
  label: string
  value: number
  alert?: boolean
}) {
  return (
    <div className="rounded-hero border border-hairline bg-white p-4 shadow-soft">
      <p
        className={
          'text-2xl font-medium tracking-tight ' +
          (alert ? 'text-amber-600' : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
    </div>
  )
}

export default function AdminProfessorsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [semesters, setSemesters] = useState<
    { id: string; name: string; programId: string }[]
  >([])
  const [programs, setPrograms] = useState<{ id: string; name: string }[]>([])

  const [creating, setCreating] = useState(false)
  /** Cours dont on est en train de choisir l'enseignant. */
  const [assigningCourse, setAssigningCourse] = useState<string | null>(null)
  const [pickedTeacher, setPickedTeacher] = useState('')
  const [pickedRole, setPickedRole] = useState<string>('LEAD')
  /** Affectation dont on demande le retrait, et celle dont on change le rôle. */
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** Recherche et filtre de la liste. */
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'without-course' | 'inactive'>(
    'all'
  )

  /** Enseignant en cours de correction, de réinitialisation, de désactivation. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })
  const [editError, setEditError] = useState('')
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [temporary, setTemporary] = useState<TemporaryPassword | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  /**
   * L'échec de chargement remonte à l'écran : une base injoignable ne doit pas
   * se présenter comme un établissement sans professeurs.
   */
  const load = useCallback(async () => {
    const [tRes, aRes, sRes] = await Promise.all([
      fetch('/api/admin/teachers'),
      fetch('/api/admin/assignments'),
      fetch('/api/admin/structure'),
    ])
    if (!tRes.ok || !aRes.ok || !sRes.ok) throw new Error('unavailable')

    const t = await tRes.json()
    const a = await aRes.json()
    const s = await sRes.json()
    setTeachers(Array.isArray(t) ? t : [])
    setAssignments(Array.isArray(a) ? a : [])
    setCourses(s?.courses ?? [])
    setSemesters(s?.semesters ?? [])
    setPrograms(s?.programs ?? [])
    setLoadFailed(false)
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

  // `?mode=assign` amène directement sur ce qu'il reste à affecter.
  useEffect(() => {
    if (router.query.mode === 'assign') {
      document.getElementById('a-affecter')?.scrollIntoView({ block: 'start' })
    }
  }, [router.query.mode, courses.length])

  const byTeacher = useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const assignment of assignments) {
      const list = map.get(assignment.user.id) ?? []
      list.push(assignment)
      map.set(assignment.user.id, list)
    }
    return map
  }, [assignments])

  const unassigned = useMemo(() => {
    const taught = new Set(assignments.map((a) => a.course.id))
    return courses.filter((c) => !taught.has(c.id))
  }, [courses, assignments])

  const withoutCourse = teachers.filter(
    (t) => (byTeacher.get(t.id) ?? []).length === 0
  )

  /**
   * Recherche sur le nom, l'adresse, et les cours confiés : un administrateur
   * cherche parfois « qui enseigne COMPTA-101 » plutôt qu'un nom.
   */
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr')

    return teachers.filter((teacher) => {
      if (filter === 'without-course' && teacher.assignmentCount > 0) return false
      if (filter === 'inactive' && teacher.isActive) return false
      if (!needle) return true

      const courses = (byTeacher.get(teacher.id) ?? [])
        .map((a) => `${a.course.title} ${a.course.code}`)
        .join(' ')

      return `${teacher.firstName} ${teacher.lastName} ${teacher.email} ${courses}`
        .toLocaleLowerCase('fr')
        .includes(needle)
    })
  }, [teachers, byTeacher, query, filter])

  const inactiveCount = teachers.filter((t) => !t.isActive).length

  const existingEmails = useMemo(
    () => new Set(teachers.map((t) => t.email.toLowerCase())),
    [teachers]
  )

  const courseContext = (course: Course) => {
    const semester = semesters.find((s) => s.id === course.semesterId)
    const program = programs.find((p) => p.id === course.programId)
    return [course.code, program?.name, semester?.name].filter(Boolean).join(' · ')
  }

  const assign = async (courseId: string, userId: string) => {
    setBusy(true)
    try {
      const response = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId, role: pickedRole }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Affectation impossible')

      setAssigningCourse(null)
      setPickedTeacher('')
      setPickedRole('LEAD')
      await load()
      toast({ title: 'Enseignant affecté', tone: 'success' })
    } catch (err: any) {
      toast({
        title: 'Affectation impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  /** Retire le lien enseignant ↔ cours. Ni l'un ni l'autre n'est supprimé. */
  const removeAssignment = async (id: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/assignments/${id}`, {
        method: 'DELETE',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Retrait impossible')

      setRemovingId(null)
      await load()
      toast({
        title: 'Affectation retirée',
        description: 'Le cours retourne dans « à affecter ».',
        tone: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Retrait impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const changeRole = async (id: string, role: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/assignments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Changement impossible')

      setEditingRoleId(null)
      await load()
      toast({ title: 'Rôle mis à jour', tone: 'success' })
    } catch (err: any) {
      toast({
        title: 'Changement impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const saveTeacher = async (id: string) => {
    setBusy(true)
    setEditError('')
    try {
      const response = await fetch(`/api/admin/teachers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Modification impossible')

      setEditingId(null)
      await load()
      toast({ title: 'Enseignant mis à jour', tone: 'success' })
    } catch (err: any) {
      setEditError(err.message)
      toast({
        title: 'Modification impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async (teacher: Teacher) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/admin/teachers/${teacher.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !teacher.isActive }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Action impossible')

      setTogglingId(null)
      await load()
      toast({
        title: teacher.isActive ? 'Accès retiré' : 'Accès rétabli',
        tone: 'success',
      })
    } catch (err: any) {
      toast({ title: 'Action impossible', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (teacher: Teacher) => {
    setBusy(true)
    try {
      const response = await fetch(
        `/api/admin/teachers/${teacher.id}/reset-password`,
        { method: 'POST' }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Réinitialisation impossible')

      setResettingId(null)
      setTemporary({
        teacherId: teacher.id,
        email: data.email,
        password: data.password,
      })
    } catch (err: any) {
      toast({
        title: 'Réinitialisation impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const blocked = loadFailed && teachers.length === 0 && courses.length === 0

  /**
   * Rien n'a pu être chargé : mieux vaut n'afficher que la panne. Laisser les
   * compteurs à zéro et les états vides sous la bannière reviendrait à décrire
   * un établissement vide, ce qui est faux et pousse à recréer l'existant.
   */
  if (blocked) {
    return (
      <AppShell
        role="admin"
        requiredRole="admin"
        title="Professeurs"
        subtitle="Créez les comptes enseignants et confiez-leur des cours"
      >
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
        >
          ← Retour au pilotage
        </Link>
        <LoadError onRetry={retry} retrying={retrying} />
      </AppShell>
    )
  }

  return (
    <AppShell
      role="admin"
      requiredRole="admin"
      title="Professeurs"
      subtitle="Créez les comptes enseignants et confiez-leur des cours"
      action={
        !creating ? (
          <button
            onClick={() => setCreating(true)}
            className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}
          >
            Ajouter un professeur
          </button>
        ) : null
      }
    >
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← Retour au pilotage
      </Link>

      {loadFailed && (
        <LoadError className="mb-5" onRetry={retry} retrying={retrying} />
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Professeurs" value={teachers.length} />
        <Metric label="Affectations" value={assignments.length} />
        <Metric
          label="Cours sans professeur"
          value={unassigned.length}
          alert={unassigned.length > 0}
        />
        <Metric
          label="Professeurs sans cours"
          value={withoutCourse.length}
          alert={withoutCourse.length > 0}
        />
      </div>

      {/* ------------------------------------------------------- création */}
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Ajouter des professeurs
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              Un compte est créé avec un mot de passe provisoire, à transmettre
              à l’enseignant.
            </p>
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className={buttonClasses(creating ? 'secondary' : 'primary', 'md')}
          >
            {creating ? 'Masquer' : 'Ajouter un professeur'}
          </button>
        </div>

        {creating && (
          <ProfessorCreation
            existingEmails={existingEmails}
            onCreated={(count) => {
              load()
              toast({
                title: `${count} compte(s) créé(s)`,
                description: 'Transmettez les mots de passe provisoires.',
                tone: 'success',
              })
            }}
            onError={(message) =>
              toast({
                title: 'Création impossible',
                description: message,
                tone: 'error',
              })
            }
          />
        )}
      </Card>

      {/* -------------------------------------------------- à affecter */}
      <section id="a-affecter" className="mt-5 scroll-mt-24">
        <Card>
          <div className="mb-4">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Cours à affecter
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              Ces cours n’ont encore aucun enseignant : personne ne peut les
              préparer.
            </p>
          </div>

          {courses.length === 0 ? (
            <EmptyState
              icon={<BookIcon size={22} />}
              title="Aucun cours à confier"
              description="Une affectation relie un enseignant à un cours existant. Tant qu’aucun cours n’est créé, il n’y a rien à attribuer."
              action={
                <Link
                  href="/admin/structure?tab=course"
                  className={buttonClasses('primary', 'md', 'no-underline')}
                >
                  Aller à la structure
                </Link>
              }
            />
          ) : unassigned.length === 0 ? (
            <p className="rounded-card border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Tous les cours ont au moins un enseignant.
            </p>
          ) : (
            <ul className="space-y-1">
              {unassigned.map((course) => (
                <li key={course.id}>
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cloud text-ink/50">
                      <BookIcon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {course.title}
                      </p>
                      <p className="truncate text-sm text-ink/45">
                        {courseContext(course)}
                      </p>
                    </div>
                    {assigningCourse !== course.id && (
                      <button
                        onClick={() => {
                          setAssigningCourse(course.id)
                          setPickedTeacher('')
                        }}
                        disabled={teachers.length === 0}
                        className="shrink-0 text-sm font-medium text-apple hover:underline disabled:opacity-40 disabled:no-underline"
                      >
                        Affecter
                      </button>
                    )}
                  </div>

                  {assigningCourse === course.id && (
                    <div className="mt-2 rounded-card border border-apple/30 bg-oca-tint/30 p-4">
                      <p className="mb-3 text-sm font-medium text-ink">
                        Qui enseignera « {course.title} » ?
                      </p>
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="block min-w-[240px] flex-1">
                          <span className="mb-2 block text-sm font-medium text-ink/70">
                            Enseignant
                          </span>
                          <select
                            value={pickedTeacher}
                            onChange={(e) => setPickedTeacher(e.target.value)}
                            className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                          >
                            <option value="">Choisir un enseignant</option>
                            {/* Un enseignant sans accès ne peut rien préparer. */}
                            {teachers
                              .filter((t) => t.isActive)
                              .map((t) => (
                                <option key={t.id} value={t.id}>
                                  {displayName(t)} · {t.assignmentCount} cours
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className="block min-w-[180px]">
                          <span className="mb-2 block text-sm font-medium text-ink/70">
                            Rôle
                          </span>
                          <select
                            value={pickedRole}
                            onChange={(e) => setPickedRole(e.target.value)}
                            className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Button
                          loading={busy}
                          disabled={!pickedTeacher}
                          onClick={() => assign(course.id, pickedTeacher)}
                        >
                          Affecter
                        </Button>
                        <button
                          onClick={() => setAssigningCourse(null)}
                          className="text-ink/60 pb-3.5 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {teachers.length === 0 && courses.length > 0 && (
            <p className="text-ink/45 mt-3 text-sm">
              Ajoutez d’abord un professeur pour pouvoir affecter ces cours.
            </p>
          )}
        </Card>
      </section>

      {/* -------------------------------------------------- les professeurs */}
      <Card className="mt-5">
        <div className="mb-4">
          <h2 className="text-[17px] font-medium tracking-tight text-ink">
            Tous les professeurs
          </h2>
          <p className="text-ink/45 mt-0.5 text-sm">
            Les enseignants de votre établissement et les cours dont ils ont la
            charge.
          </p>
        </div>

        {teachers.length > 0 && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="block min-w-[240px] flex-1">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Rechercher
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, adresse email ou cours"
                className="h-12 w-full rounded-card border border-hairline bg-white px-4 text-[15px] text-ink placeholder:text-ink/35 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
              />
            </label>
            <div className="flex flex-wrap gap-2 pb-1">
              {(
                [
                  ['all', `Tous (${teachers.length})`],
                  ['without-course', `Sans cours (${withoutCourse.length})`],
                  ['inactive', `Sans accès (${inactiveCount})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={
                    'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ' +
                    (filter === key
                      ? 'border-oca bg-oca text-white'
                      : 'border-hairline bg-white text-ink/65 hover:bg-cloud')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {temporary && (
          <div className="mb-4 rounded-card border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">
              Ce mot de passe est affiché une seule fois.
            </p>
            <p className="mt-1 text-sm text-emerald-900">
              {temporary.email} ·{' '}
              <code className="rounded bg-white/70 px-1.5 py-0.5">
                {temporary.password}
              </code>
            </p>
            <button
              onClick={() => setTemporary(null)}
              className="mt-2 text-sm font-medium text-emerald-800 hover:underline"
            >
              J’ai noté ce mot de passe
            </button>
          </div>
        )}

        {teachers.length === 0 ? (
          <EmptyState
            icon={<CapIcon size={22} />}
            title="Aucun professeur"
            description="Sans enseignant affecté, un cours n’a personne pour le préparer : les étudiants y accèdent, mais il reste vide."
            action={
              <button
                onClick={() => setCreating(true)}
                className={buttonClasses('primary', 'md')}
              >
                Ajouter un professeur
              </button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {visible.length === 0 && (
              <li className="text-ink/50 py-4 text-sm">
                Aucun enseignant ne correspond à cette recherche.
              </li>
            )}
            {visible.map((teacher) => {
              const taught = byTeacher.get(teacher.id) ?? []
              return (
                <li
                  key={teacher.id}
                  className="rounded-2xl border border-hairline bg-white p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={displayName(teacher)} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {displayName(teacher)}
                      </p>
                      <p className="truncate text-sm text-ink/45">
                        {teacher.email}
                      </p>
                    </div>
                    {!teacher.isActive && <Badge tone="warning">Sans accès</Badge>}
                    <Badge tone={taught.length === 0 ? 'warning' : 'neutral'}>
                      {taught.length === 0
                        ? 'Aucun cours'
                        : `${taught.length} cours`}
                    </Badge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                    <button
                      onClick={() => {
                        setEditingId(teacher.id)
                        setEditError('')
                        setEditForm({
                          firstName: teacher.firstName,
                          lastName: teacher.lastName,
                          email: teacher.email,
                        })
                      }}
                      className="text-sm font-medium text-apple hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => setResettingId(teacher.id)}
                      className="text-ink/50 text-sm font-medium hover:underline"
                    >
                      Réinitialiser le mot de passe
                    </button>
                    <button
                      onClick={() => setTogglingId(teacher.id)}
                      className={
                        'text-sm font-medium hover:underline ' +
                        (teacher.isActive ? 'text-red-500' : 'text-emerald-600')
                      }
                    >
                      {teacher.isActive ? 'Retirer l’accès' : 'Rétablir l’accès'}
                    </button>
                  </div>

                  {editingId === teacher.id && (
                    <div className="mt-3 rounded-card border border-apple/30 bg-oca-tint/30 p-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Input
                          label="Prénom"
                          value={editForm.firstName}
                          onChange={(e) =>
                            setEditForm((c) => ({
                              ...c,
                              firstName: e.target.value,
                            }))
                          }
                        />
                        <Input
                          label="Nom"
                          value={editForm.lastName}
                          onChange={(e) =>
                            setEditForm((c) => ({
                              ...c,
                              lastName: e.target.value,
                            }))
                          }
                        />
                        <Input
                          label="Adresse email"
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm((c) => ({ ...c, email: e.target.value }))
                          }
                        />
                      </div>
                      <p className="text-ink/45 mt-2 text-xs">
                        L’adresse sert à se connecter : la modifier change
                        l’identifiant de l’enseignant.
                      </p>
                      {editError && (
                        <div
                          role="alert"
                          className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                        >
                          {editError}
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          onClick={() => saveTeacher(teacher.id)}
                        >
                          Enregistrer
                        </Button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {resettingId === teacher.id && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        Générer un nouveau mot de passe provisoire pour{' '}
                        {displayName(teacher)} ? L’ancien cessera aussitôt de
                        fonctionner, et le nouveau ne s’affichera qu’une fois.
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          onClick={() => resetPassword(teacher)}
                        >
                          Générer
                        </Button>
                        <button
                          onClick={() => setResettingId(null)}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {togglingId === teacher.id && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        {teacher.isActive
                          ? `Retirer l’accès de ${displayName(teacher)} ? Cet enseignant ne pourra plus ouvrir son espace ni ses cours. Ses affectations et son contenu sont conservés, et l’accès peut être rétabli.`
                          : `Rétablir l’accès de ${displayName(teacher)} ? Il retrouvera son espace et ses cours.`}
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          onClick={() => toggleActive(teacher)}
                        >
                          {teacher.isActive ? 'Retirer l’accès' : 'Rétablir'}
                        </Button>
                        <button
                          onClick={() => setTogglingId(null)}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {taught.length === 0 ? (
                    <p className="text-ink/45 mt-2 border-t border-hairline pt-2 text-sm">
                      Aucun cours confié pour le moment.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
                      {taught.map((assignment) => (
                        <li key={assignment.id}>
                          <div className="flex flex-wrap items-center gap-2 px-1 text-sm">
                            <span className="min-w-0 flex-1 truncate text-ink/70">
                              {assignment.course.title}
                            </span>
                            <span className="text-ink/40 truncate text-xs">
                              {assignment.course.code} ·{' '}
                              {assignment.course.program.name} ·{' '}
                              {assignment.course.semester.name}
                            </span>
                            {!teacher.isActive && (
                              <Badge tone="warning">Sans accès</Badge>
                            )}

                            {editingRoleId === assignment.id ? (
                              <select
                                autoFocus
                                defaultValue={assignment.role}
                                onChange={(e) =>
                                  changeRole(assignment.id, e.target.value)
                                }
                                className="h-9 rounded-card border border-hairline bg-white px-2 text-sm text-ink focus:border-apple focus:outline-none"
                              >
                                {ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {ROLE_LABELS[role]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <button
                                onClick={() => setEditingRoleId(assignment.id)}
                                title="Changer le rôle"
                                className="shrink-0"
                              >
                                <Badge tone="neutral">
                                  {ROLE_LABELS[assignment.role] ??
                                    assignment.role}
                                </Badge>
                              </button>
                            )}

                            {removingId !== assignment.id && (
                              <button
                                onClick={() => setRemovingId(assignment.id)}
                                className="shrink-0 text-sm font-medium text-red-500 hover:underline"
                              >
                                Retirer
                              </button>
                            )}
                          </div>

                          {removingId === assignment.id && (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                              <p className="text-sm text-amber-800">
                                Retirer {displayName(teacher)} du cours «{' '}
                                {assignment.course.title} » ? Le cours
                                retournera dans « à affecter » s’il n’a plus
                                d’enseignant. Le contenu déjà rédigé n’est pas
                                supprimé, mais cet enseignant n’y aura plus
                                accès.
                              </p>
                              <div className="mt-2.5 flex items-center gap-3">
                                <Button
                                  size="md"
                                  loading={busy}
                                  onClick={() =>
                                    removeAssignment(assignment.id)
                                  }
                                >
                                  Oui, retirer
                                </Button>
                                <button
                                  onClick={() => setRemovingId(null)}
                                  className="text-ink/60 text-sm font-medium hover:underline"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  )
}

// Protection côté serveur : administrateur d'établissement uniquement.
export const getServerSideProps = requireRoleSSR([Role.ADMIN])
