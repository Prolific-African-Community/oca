import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { LoadError } from '../../components/admin/LoadState'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Button, buttonClasses } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/overlay/Toast'
import { StudentEnrollment } from '../../components/admin/StudentEnrollment'
import { UsersIcon, LayersIcon } from '../../components/ui/icons'

/**
 * Espace de gestion des étudiants.
 *
 * L'administrateur y inscrit les étudiants et vérifie leurs rattachements.
 * Deux manques y sont montrés plutôt que noyés dans un total : un étudiant
 * sans inscription pédagogique ne voit aucun cours, et un étudiant sans accès
 * ne peut pas se connecter.
 *
 * La cohorte n'est pas un objet du schéma : c'est un regroupement calculé à
 * partir du programme, de l'année et du semestre. L'écran le dit, pour ne pas
 * laisser croire à une entité qui n'existe pas.
 */

interface Student {
  id: string
  firstName: string
  lastName: string
  email: string
  faculty: string
  program: string
  semester: string | null
  enrollmentStatus: string | null
  enrollmentId: string | null
  enrollments: {
    id: string
    status: string
    program: string
    programId: string
    semester: string
    semesterId: string
    academicYear: string
  }[]
  programId: string | null
  semesterId: string | null
  academicYear: string | null
  academicYearId: string | null
  isActive: boolean
  createdAt: string
}

interface Structure {
  programs: { id: string; name: string }[]
  academicYears: { id: string; name: string; isCurrent: boolean }[]
  semesters: {
    id: string
    name: string
    programId: string
    academicYearId: string
  }[]
}

const EMPTY_STRUCTURE: Structure = {
  programs: [],
  academicYears: [],
  semesters: [],
}

const displayName = (s: Student) =>
  [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email

function Metric({
  label,
  value,
  hint,
  alert,
}: {
  label: string
  value: string | number
  hint?: string
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
      {hint && <p className="text-ink/40 mt-0.5 text-xs">{hint}</p>}
    </div>
  )
}

export default function AdminStudentsPage() {
  const { toast } = useToast()

  const [students, setStudents] = useState<Student[]>([])
  const [structure, setStructure] = useState<Structure>(EMPTY_STRUCTURE)
  const [enrolling, setEnrolling] = useState(false)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'inactive'>('all')
  const [programFilter, setProgramFilter] = useState('')

  /** Panneau ouvert sur un étudiant : correction, mot de passe, accès, rattachement. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })
  const [editError, setEditError] = useState('')
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveForm, setMoveForm] = useState({
    programId: '',
    academicYearId: '',
    semesterId: '',
  })
  const [moveError, setMoveError] = useState('')
  const [temporary, setTemporary] = useState<{
    email: string
    password: string
  } | null>(null)

  /** Progression individuelle et progression de cohorte. */
  const [progressingId, setProgressingId] = useState<string | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [cohortKey, setCohortKey] = useState<string | null>(null)
  const [progressForm, setProgressForm] = useState({
    programId: '',
    academicYearId: '',
    semesterId: '',
  })
  const [progressError, setProgressError] = useState('')
  /** Sélection par étudiant dans la cohorte, et confirmation de réouverture. */
  const [cohortSelection, setCohortSelection] = useState<Set<string>>(new Set())
  const [cohortQuery, setCohortQuery] = useState('')
  const [reopening, setReopening] = useState<{
    studentId: string
    enrollmentId: string
  } | null>(null)
  const [cohortReport, setCohortReport] = useState<{
    counts: { progressed: number; enrolled: number; unchanged: number; failed: number }
    results: { studentId: string; outcome: string; message?: string; name?: string }[]
    selected?: number
    unselected?: number
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  /**
   * Un échec de chargement est désormais visible. Auparavant il était avalé :
   * la page se rendait vide et annonçait « Aucun étudiant », ce qui ne se
   * distingue pas d'un établissement réellement vide.
   */
  const load = useCallback(async () => {
    const [listRes, structRes] = await Promise.all([
      fetch('/api/students/list'),
      fetch('/api/admin/structure'),
    ])
    if (!listRes.ok || !structRes.ok) throw new Error('unavailable')

    const list = await listRes.json()
    const s = await structRes.json()
    setStudents(Array.isArray(list) ? list : [])
    setStructure({
      programs: s?.programs ?? [],
      academicYears: s?.academicYears ?? [],
      semesters: s?.semesters ?? [],
    })
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

  const currentYear = structure.academicYears.find((y) => y.isCurrent) ?? null

  const incomplete = students.filter((s) => !s.enrollmentStatus)
  const inactive = students.filter((s) => !s.isActive)
  const enrolled = students.filter((s) => s.enrollmentStatus)

  const existingEmails = useMemo(
    () => new Set(students.map((s) => s.email.toLowerCase())),
    [students]
  )

  /**
   * Recherche sur le nom, l'adresse, le programme et le semestre : un
   * administrateur cherche aussi bien « Traoré » que « Semestre 1 ».
   */
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('fr')

    return students.filter((student) => {
      if (filter === 'incomplete' && student.enrollmentStatus) return false
      if (filter === 'inactive' && student.isActive) return false
      if (programFilter && student.programId !== programFilter) return false
      if (!needle) return true

      return `${student.firstName} ${student.lastName} ${student.email} ${student.program} ${student.semester ?? ''} ${student.academicYear ?? ''}`
        .toLocaleLowerCase('fr')
        .includes(needle)
    })
  }, [students, query, filter, programFilter])

  /**
   * Cohortes : regroupement calculé, jamais stocké. La clé est le triplet
   * programme + année + semestre, c'est-à-dire ce qui détermine réellement
   * les cours qu'un étudiant voit.
   */
  const cohorts = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string
        program: string
        academicYear: string
        semester: string
        students: Student[]
      }
    >()

    for (const student of enrolled) {
      const key = `${student.programId}:${student.semesterId}`
      const existing = map.get(key)
      if (existing) {
        existing.students.push(student)
      } else {
        map.set(key, {
          key,
          program: student.program,
          academicYear: student.academicYear ?? '—',
          semester: student.semester ?? '—',
          students: [student],
        })
      }
    }

    // Array.from plutôt que l'itération : la cible TypeScript est es5.
    return Array.from(map.values()).sort(
      (a, b) =>
        a.program.localeCompare(b.program, 'fr') ||
        a.semester.localeCompare(b.semester, 'fr')
    )
  }, [enrolled])

  const canEnroll =
    structure.programs.length > 0 && structure.semesters.length > 0

  /** Ferme tous les panneaux : une seule action ouverte à la fois. */
  const closePanels = () => {
    setEditingId(null)
    setResettingId(null)
    setTogglingId(null)
    setMovingId(null)
    setProgressingId(null)
    setCohortKey(null)
    setReopening(null)
    setEditError('')
    setMoveError('')
    setProgressError('')
  }

  const patch = async (id: string, payload: Record<string, unknown>) => {
    const response = await fetch(`/api/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Action impossible')
    return data
  }

  const saveStudent = async (id: string) => {
    setBusy(true)
    setEditError('')
    try {
      await patch(id, editForm)
      closePanels()
      await load()
      toast({ title: 'Étudiant mis à jour', tone: 'success' })
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

  const toggleAccess = async (student: Student) => {
    setBusy(true)
    try {
      await patch(student.id, { isActive: !student.isActive })
      closePanels()
      await load()
      toast({
        title: student.isActive ? 'Accès retiré' : 'Accès rétabli',
        tone: 'success',
      })
    } catch (err: any) {
      toast({ title: 'Action impossible', description: err.message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const resetPassword = async (student: Student) => {
    setBusy(true)
    try {
      const response = await fetch(
        `/api/admin/students/${student.id}/reset-password`,
        { method: 'POST' }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(data.message || 'Réinitialisation impossible')

      closePanels()
      setTemporary({ email: data.email, password: data.password })
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

  const moveStudent = async (id: string) => {
    setBusy(true)
    setMoveError('')
    try {
      await patch(id, {
        enrollment: {
          programId: moveForm.programId,
          semesterId: moveForm.semesterId,
        },
      })
      closePanels()
      await load()
      toast({
        title: 'Rattachement mis à jour',
        description: 'Les cours visibles ont changé pour cet étudiant.',
        tone: 'success',
      })
    } catch (err: any) {
      setMoveError(err.message)
      toast({
        title: 'Rattachement impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  /**
   * Faire progresser : l'inscription active est close et une nouvelle est
   * créée. C'est ce qui distingue ce geste de la correction, qui déplace
   * l'inscription sur place.
   */
  const progressStudent = async (id: string) => {
    setBusy(true)
    setProgressError('')
    try {
      const response = await fetch(`/api/admin/students/${id}/progression`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progressForm),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Progression impossible')

      closePanels()
      await load()
      toast({
        title:
          data.outcome === 'UNCHANGED'
            ? 'Aucun changement'
            : 'Étudiant passé au semestre suivant',
        description:
          data.outcome === 'UNCHANGED'
            ? 'Cet étudiant est déjà inscrit dans ce semestre.'
            : 'L’ancienne inscription est marquée comme terminée.',
        tone: 'success',
      })
    } catch (err: any) {
      setProgressError(err.message)
      toast({
        title: 'Progression impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  /**
   * Annuler une progression : l'inscription close redevient active, celle
   * qu'on quitte passe en « retirée ». Aucune suppression.
   */
  const reopen = async (
    studentId: string,
    enrollmentId: string,
    currentEnrollmentId: string | null
  ) => {
    setBusy(true)
    try {
      const response = await fetch(
        `/api/admin/students/${studentId}/reopen-enrollment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enrollmentIdToReopen: enrollmentId,
            currentEnrollmentId: currentEnrollmentId ?? undefined,
          }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Réouverture impossible')

      setReopening(null)
      await load()
      toast({
        title:
          data.outcome === 'UNCHANGED'
            ? 'Aucun changement'
            : 'Inscription rouverte',
        description:
          data.outcome === 'UNCHANGED'
            ? data.message
            : 'Le semestre précédent est de nouveau actif.',
        tone: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Réouverture impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const progressCohort = async (
    source: { programId: string; semesterId: string },
    selected: number,
    unselected: number
  ) => {
    setBusy(true)
    setProgressError('')
    setCohortReport(null)
    try {
      const response = await fetch('/api/admin/students/cohort-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProgramId: source.programId,
          sourceSemesterId: source.semesterId,
          targetProgramId: progressForm.programId,
          targetAcademicYearId: progressForm.academicYearId || undefined,
          targetSemesterId: progressForm.semesterId,
          // Seuls les étudiants cochés partent ; les autres restent en place.
          studentIds: Array.from(cohortSelection),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Progression impossible')

      setCohortReport({ ...data, selected, unselected })
      await load()
      toast({
        title: 'Cohorte traitée',
        description: `${data.counts.progressed + data.counts.enrolled} passage(s), ${data.counts.failed} échec(s).`,
        tone: data.counts.failed > 0 ? 'error' : 'success',
      })
    } catch (err: any) {
      setProgressError(err.message)
      toast({
        title: 'Progression impossible',
        description: err.message,
        tone: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  /** Semestres cohérents avec le programme et l'année choisis. */
  const moveSemesters = structure.semesters.filter(
    (sem) =>
      sem.programId === moveForm.programId &&
      (!moveForm.academicYearId || sem.academicYearId === moveForm.academicYearId)
  )

  const progressSemesters = structure.semesters.filter(
    (sem) =>
      sem.programId === progressForm.programId &&
      (!progressForm.academicYearId ||
        sem.academicYearId === progressForm.academicYearId)
  )

  /** Sélecteurs de destination, partagés par les deux progressions. */
  const targetPickers = (
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink/70">
          Programme
        </span>
        <select
          value={progressForm.programId}
          onChange={(e) =>
            setProgressForm((c) => ({
              ...c,
              programId: e.target.value,
              semesterId: '',
            }))
          }
          className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
        >
          <option value="">Choisir un programme</option>
          {structure.programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink/70">
          Année universitaire
        </span>
        <select
          value={progressForm.academicYearId}
          onChange={(e) =>
            setProgressForm((c) => ({
              ...c,
              academicYearId: e.target.value,
              semesterId: '',
            }))
          }
          className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
        >
          <option value="">Toutes les années</option>
          {structure.academicYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.isCurrent ? `${y.name} · en cours` : y.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-ink/70">
          Semestre de destination
        </span>
        <select
          value={progressForm.semesterId}
          onChange={(e) =>
            setProgressForm((c) => ({ ...c, semesterId: e.target.value }))
          }
          className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
        >
          <option value="">Choisir un semestre</option>
          {progressSemesters.map((sem) => (
            <option key={sem.id} value={sem.id}>
              {sem.name}
            </option>
          ))}
        </select>
        {!progressForm.programId && (
          <span className="text-ink/45 mt-1 block text-xs">
            Choisissez d’abord un programme
          </span>
        )}
      </label>
    </div>
  )

  const blocked =
    loadFailed && students.length === 0 && structure.programs.length === 0

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
        title="Étudiants"
        subtitle="Inscrivez les étudiants, suivez leurs cohortes et vérifiez leurs accès"
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
      title="Étudiants"
      subtitle="Inscrivez les étudiants, suivez leurs cohortes et vérifiez leurs accès"
      action={
        canEnroll && !enrolling ? (
          <button
            onClick={() => setEnrolling(true)}
            className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}
          >
            Inscrire un étudiant
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
        <Metric
          label="Étudiants"
          value={students.length}
          hint={currentYear ? `Année ${currentYear.name}` : 'Aucune année en cours'}
        />
        <Metric label="Inscriptions complètes" value={enrolled.length} />
        <Metric
          label="Sans inscription"
          value={incomplete.length}
          hint="Ces étudiants ne voient aucun cours"
          alert={incomplete.length > 0}
        />
        <Metric
          label="Sans accès"
          value={inactive.length}
          hint="Ne peuvent pas se connecter"
          alert={inactive.length > 0}
        />
      </div>

      {/* ---------------------------------------------------- inscription */}
      <Card className="mt-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Inscrire des étudiants
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              Chaque étudiant reçoit un compte et une inscription à un
              programme : sans elle, il ne verrait aucun cours.
            </p>
          </div>
          {canEnroll && (
            <button
              onClick={() => setEnrolling((v) => !v)}
              className={buttonClasses(enrolling ? 'secondary' : 'primary', 'md')}
            >
              {enrolling ? 'Masquer' : 'Inscrire un étudiant'}
            </button>
          )}
        </div>

        {!canEnroll ? (
          <EmptyState
            icon={<LayersIcon size={22} />}
            title="La structure n’est pas prête"
            description="Un étudiant s’inscrit toujours dans un semestre : sans programme ni semestre, il n’y aurait rien à quoi le rattacher, et il ne verrait aucun cours."
            action={
              <Link
                href="/admin/structure"
                className={buttonClasses('primary', 'md', 'no-underline')}
              >
                Aller à la structure
              </Link>
            }
          />
        ) : (
          enrolling && (
            <StudentEnrollment
              options={structure}
              existingEmails={existingEmails}
              onCreated={(count) => {
                load()
                toast({
                  title: `${count} étudiant(s) inscrit(s)`,
                  description: 'Transmettez les mots de passe provisoires.',
                  tone: 'success',
                })
              }}
              onError={(message) =>
                toast({
                  title: 'Inscription impossible',
                  description: message,
                  tone: 'error',
                })
              }
            />
          )
        )}
      </Card>

      {/* ------------------------------------------------- à compléter */}
      {incomplete.length > 0 && (
        <Card className="mt-5">
          <div className="mb-4">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              Étudiants à compléter
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">
              Ces comptes existent mais ne sont rattachés à aucun programme :
              leurs titulaires ne voient aucun cours.
            </p>
          </div>
          <ul className="space-y-1">
            {incomplete.map((student) => (
              <li
                key={student.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
              >
                <Avatar name={displayName(student)} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">
                    {displayName(student)}
                  </p>
                  <p className="truncate text-sm text-ink/45">{student.email}</p>
                </div>
                <Badge tone="warning">Sans inscription</Badge>
                <button
                  onClick={() => {
                    closePanels()
                    setQuery(student.email)
                    setFilter('all')
                    setProgramFilter('')
                    setMovingId(student.id)
                    setMoveForm({
                      programId: '',
                      academicYearId: '',
                      semesterId: '',
                    })
                  }}
                  className="text-sm font-medium text-apple hover:underline"
                >
                  Rattacher
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------- cohortes */}
      <Card className="mt-5">
        <div className="mb-4">
          <h2 className="text-[17px] font-medium tracking-tight text-ink">
            Vue par cohorte
          </h2>
          <p className="text-ink/45 mt-0.5 text-sm">
            Cohorte calculée à partir du programme, de l’année et du semestre —
            ce n’est pas un groupe enregistré.
          </p>
        </div>

        {cohortReport && (
          <div className="mb-4 rounded-card border border-hairline bg-cloud/50 p-4">
            <p className="text-[15px] font-medium text-ink">
              Résultat de la progression
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="success">
                {cohortReport.counts.progressed + cohortReport.counts.enrolled}{' '}
                passage(s)
              </Badge>
              {typeof cohortReport.selected === 'number' && (
                <Badge tone="neutral">
                  {cohortReport.selected} sélectionné(s)
                </Badge>
              )}
              {typeof cohortReport.unselected === 'number' &&
                cohortReport.unselected > 0 && (
                  <Badge tone="neutral">
                    {cohortReport.unselected} laissé(s) en place
                  </Badge>
                )}
              {cohortReport.counts.unchanged > 0 && (
                <Badge tone="neutral">
                  {cohortReport.counts.unchanged} sans changement
                </Badge>
              )}
              {cohortReport.counts.failed > 0 && (
                <Badge tone="warning">
                  {cohortReport.counts.failed} échec(s)
                </Badge>
              )}
            </div>
            {/* Chaque cas non traité est nommé : rien ne disparaît en silence. */}
            {cohortReport.results.some((r) => r.outcome !== 'PROGRESSED') && (
              <ul className="mt-3 space-y-1 text-sm">
                {cohortReport.results
                  .filter((r) => r.outcome !== 'PROGRESSED')
                  .map((r) => (
                    <li key={r.studentId} className="text-amber-700">
                      {r.name ?? r.studentId} — {r.message ?? r.outcome}
                    </li>
                  ))}
              </ul>
            )}
            <button
              onClick={() => setCohortReport(null)}
              className="text-ink/50 mt-3 text-sm font-medium hover:underline"
            >
              Fermer
            </button>
          </div>
        )}

        {cohorts.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={22} />}
            title="Aucune cohorte pour le moment"
            description="Une cohorte se forme d’elle-même dès que des étudiants partagent un programme et un semestre. C’est elle qui permet de faire progresser toute une promotion d’un seul geste."
            action={
              canEnroll ? (
                <button
                  onClick={() => {
                    closePanels()
                    setEnrolling(true)
                  }}
                  className={buttonClasses('primary', 'md')}
                >
                  Inscrire un étudiant
                </button>
              ) : (
                <Link
                  href="/admin/structure"
                  className={buttonClasses('primary', 'md', 'no-underline')}
                >
                  Configurer la structure
                </Link>
              )
            }
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cohorts.map((cohort) => (
              <li
                key={cohort.key}
                className="rounded-card border border-hairline bg-white p-4"
              >
                <p className="text-[15px] font-medium text-ink">
                  {cohort.program}
                </p>
                <p className="text-ink/45 mt-0.5 text-sm">
                  {cohort.semester} · {cohort.academicYear}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="brand">
                    {cohort.students.length} étudiant
                    {cohort.students.length > 1 ? 's' : ''}
                  </Badge>
                  <button
                    onClick={() => {
                      setProgramFilter(cohort.students[0]?.programId ?? '')
                      setQuery(cohort.semester)
                      setFilter('all')
                    }}
                    className="text-sm font-medium text-apple hover:underline"
                  >
                    Voir
                  </button>
                  <button
                    onClick={() => {
                      closePanels()
                      setCohortReport(null)
                      setCohortKey(cohort.key)
                      setCohortQuery('')
                      // Tout le monde est coché par défaut : exclure est
                      // l'exception, pas la règle.
                      setCohortSelection(
                        new Set(cohort.students.map((x) => x.id))
                      )
                      setProgressForm({
                        programId: cohort.students[0]?.programId ?? '',
                        academicYearId: '',
                        semesterId: '',
                      })
                    }}
                    className="text-sm font-medium text-apple hover:underline"
                  >
                    Faire progresser
                  </button>
                </div>

                {cohortKey === cohort.key && (
                  <div className="mt-3 rounded-card border border-apple/30 bg-oca-tint/30 p-4">
                    <p className="text-[15px] font-medium text-ink">
                      Faire progresser cette cohorte
                    </p>
                    <p className="text-ink/50 mt-0.5 text-sm">
                      Départ : {cohort.program} · {cohort.semester} ·{' '}
                      {cohort.academicYear} — {cohort.students.length} étudiant
                      {cohort.students.length > 1 ? 's actifs' : ' actif'}
                    </p>

                    <div className="mt-4">{targetPickers}</div>

                    <p className="mt-3 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      Cette action va clôturer l’inscription active des
                      étudiants sélectionnés et créer une nouvelle inscription
                      active. Les étudiants non sélectionnés resteront dans la
                      cohorte actuelle. Les cours visibles seront ceux du
                      nouveau semestre ; la progression déjà enregistrée n’est
                      pas supprimée.
                    </p>

                    <div className="mt-3 rounded-card border border-hairline bg-white p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-ink">
                          {cohortSelection.size} sélectionné
                          {cohortSelection.size > 1 ? 's' : ''} ·{' '}
                          {cohort.students.length - cohortSelection.size} exclu
                          {cohort.students.length - cohortSelection.size > 1
                            ? 's'
                            : ''}
                        </p>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() =>
                              setCohortSelection(
                                new Set(cohort.students.map((x) => x.id))
                              )
                            }
                            className="text-sm font-medium text-apple hover:underline"
                          >
                            Tout sélectionner
                          </button>
                          <button
                            onClick={() => setCohortSelection(new Set())}
                            className="text-ink/50 text-sm font-medium hover:underline"
                          >
                            Tout désélectionner
                          </button>
                        </div>
                      </div>

                      <input
                        value={cohortQuery}
                        onChange={(e) => setCohortQuery(e.target.value)}
                        placeholder="Filtrer dans la cohorte"
                        className="mb-3 h-11 w-full rounded-card border border-hairline bg-white px-4 text-sm text-ink placeholder:text-ink/35 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                      />

                      <ul className="max-h-56 space-y-1 overflow-y-auto">
                        {cohort.students
                          .filter((student) =>
                            cohortQuery.trim()
                              ? `${displayName(student)} ${student.email}`
                                  .toLocaleLowerCase('fr')
                                  .includes(
                                    cohortQuery.trim().toLocaleLowerCase('fr')
                                  )
                              : true
                          )
                          .map((student) => (
                            <li key={student.id}>
                              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-cloud">
                                <input
                                  type="checkbox"
                                  checked={cohortSelection.has(student.id)}
                                  onChange={(e) =>
                                    setCohortSelection((current) => {
                                      const next = new Set(current)
                                      if (e.target.checked) next.add(student.id)
                                      else next.delete(student.id)
                                      return next
                                    })
                                  }
                                  className="h-4 w-4"
                                />
                                <span className="min-w-0 flex-1 truncate text-ink/75">
                                  {displayName(student)}
                                </span>
                                <span className="text-ink/40 truncate text-xs">
                                  {student.email}
                                </span>
                              </label>
                            </li>
                          ))}
                      </ul>

                      <p className="text-ink/45 mt-3 text-xs">
                        Décochez les étudiants qui ne passent pas — redoublants,
                        absents, cas particuliers.
                      </p>
                    </div>

                    {progressError && (
                      <div
                        role="alert"
                        className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                      >
                        {progressError}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Button
                        size="md"
                        loading={busy}
                        disabled={
                          !progressForm.programId ||
                          !progressForm.semesterId ||
                          cohortSelection.size === 0
                        }
                        onClick={() =>
                          progressCohort(
                            {
                              programId: cohort.students[0]?.programId ?? '',
                              semesterId: cohort.students[0]?.semesterId ?? '',
                            },
                            cohortSelection.size,
                            cohort.students.length - cohortSelection.size
                          )
                        }
                      >
                        Faire progresser {cohortSelection.size} étudiant
                        {cohortSelection.size > 1 ? 's' : ''}
                      </Button>
                      {cohortSelection.size === 0 && (
                        <span className="text-ink/50 text-sm">
                          Sélectionnez au moins un étudiant.
                        </span>
                      )}
                      <button
                        onClick={closePanels}
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
      </Card>

      {/* ---------------------------------------------------------- liste */}
      <Card className="mt-5">
        <div className="mb-4">
          <h2 className="text-[17px] font-medium tracking-tight text-ink">
            Liste des étudiants
          </h2>
          <p className="text-ink/45 mt-0.5 text-sm">
            Les personnes inscrites dans votre établissement et leur
            rattachement.
          </p>
        </div>

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

        {students.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={22} />}
            title="Aucun étudiant"
            description="Sans étudiant inscrit, aucun cours n’est suivi et aucune cohorte n’existe. L’inscription crée à la fois le compte et le rattachement à un semestre."
            action={
              canEnroll ? (
                <button
                  onClick={() => setEnrolling(true)}
                  className={buttonClasses('primary', 'md')}
                >
                  Inscrire un étudiant
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <label className="block min-w-[240px] flex-1">
                <span className="mb-2 block text-sm font-medium text-ink/70">
                  Rechercher
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Nom, adresse email, programme ou semestre"
                  className="h-12 w-full rounded-card border border-hairline bg-white px-4 text-[15px] text-ink placeholder:text-ink/35 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                />
              </label>

              <label className="block min-w-[200px]">
                <span className="mb-2 block text-sm font-medium text-ink/70">
                  Programme
                </span>
                <select
                  value={programFilter}
                  onChange={(e) => setProgramFilter(e.target.value)}
                  className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                >
                  <option value="">Tous les programmes</option>
                  {structure.programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-wrap gap-2 pb-1">
                {(
                  [
                    ['all', `Tous (${students.length})`],
                    ['incomplete', `Sans inscription (${incomplete.length})`],
                    ['inactive', `Sans accès (${inactive.length})`],
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

            <ul className="space-y-1">
              {visible.length === 0 && (
                <li className="text-ink/50 py-4 text-sm">
                  Aucun étudiant ne correspond à cette recherche.
                </li>
              )}
              {visible.map((student) => (
                <li
                  key={student.id}
                  className="rounded-2xl border border-hairline bg-white p-3"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={displayName(student)} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {displayName(student)}
                      </p>
                      <p className="truncate text-sm text-ink/45">
                        {student.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!student.isActive && (
                        <Badge tone="warning">Sans accès</Badge>
                      )}
                      {student.enrollmentStatus ? (
                        <>
                          <Badge tone="brand">{student.program}</Badge>
                          {student.semester && (
                            <Badge tone="neutral">{student.semester}</Badge>
                          )}
                          {student.academicYear && (
                            <Badge tone="neutral">{student.academicYear}</Badge>
                          )}
                        </>
                      ) : (
                        <Badge tone="warning">Sans inscription</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-3 px-1">
                    <button
                      onClick={() => {
                        closePanels()
                        setEditingId(student.id)
                        setEditForm({
                          firstName: student.firstName,
                          lastName: student.lastName,
                          email: student.email,
                        })
                      }}
                      className="text-sm font-medium text-apple hover:underline"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => {
                        closePanels()
                        setMovingId(student.id)
                        setMoveForm({
                          programId: student.programId ?? '',
                          academicYearId: student.academicYearId ?? '',
                          semesterId: student.semesterId ?? '',
                        })
                      }}
                      className="text-sm font-medium text-apple hover:underline"
                    >
                      Corriger le rattachement
                    </button>
                    <button
                      onClick={() => {
                        closePanels()
                        setProgressingId(student.id)
                        setProgressForm({
                          programId: student.programId ?? '',
                          academicYearId: '',
                          semesterId: '',
                        })
                      }}
                      className="text-sm font-medium text-apple hover:underline"
                    >
                      Faire progresser
                    </button>
                    <button
                      onClick={() =>
                        setHistoryId(historyId === student.id ? null : student.id)
                      }
                      className="text-ink/50 text-sm font-medium hover:underline"
                    >
                      {historyId === student.id ? 'Masquer' : 'Parcours'} (
                      {student.enrollments?.length ?? 0})
                    </button>
                    <button
                      onClick={() => {
                        closePanels()
                        setResettingId(student.id)
                      }}
                      className="text-ink/50 text-sm font-medium hover:underline"
                    >
                      Réinitialiser le mot de passe
                    </button>
                    <button
                      onClick={() => {
                        closePanels()
                        setTogglingId(student.id)
                      }}
                      className={
                        'text-sm font-medium hover:underline ' +
                        (student.isActive ? 'text-red-500' : 'text-emerald-600')
                      }
                    >
                      {student.isActive ? 'Retirer l’accès' : 'Rétablir l’accès'}
                    </button>
                  </div>

                  {historyId === student.id && (
                    <ul className="mt-3 space-y-1 border-t border-hairline pt-3">
                      {(student.enrollments ?? []).length === 0 && (
                        <li className="text-ink/45 text-sm">
                          Aucune inscription enregistrée.
                        </li>
                      )}
                      {(student.enrollments ?? []).map((enrollment) => {
                        const active = enrollment.status === 'ACTIVE'
                        const currentActive = (student.enrollments ?? []).find(
                          (e) => e.status === 'ACTIVE'
                        )
                        // On ne propose la réouverture que s'il y a bien une
                        // autre inscription active à refermer.
                        const reopenable = !active && Boolean(currentActive)

                        return (
                          <li key={enrollment.id}>
                            <div
                              className={
                                'flex flex-wrap items-center gap-2 px-1 text-sm ' +
                                (active ? 'text-ink' : 'text-ink/45')
                              }
                            >
                              <Badge tone={active ? 'success' : 'neutral'}>
                                {active
                                  ? 'En cours'
                                  : enrollment.status === 'WITHDRAWN'
                                  ? 'Retirée'
                                  : 'Terminée'}
                              </Badge>
                              <span className="min-w-0 flex-1 truncate">
                                {enrollment.program} · {enrollment.semester} ·{' '}
                                {enrollment.academicYear}
                              </span>
                              {reopenable &&
                                reopening?.enrollmentId !== enrollment.id && (
                                  <button
                                    onClick={() =>
                                      setReopening({
                                        studentId: student.id,
                                        enrollmentId: enrollment.id,
                                      })
                                    }
                                    className="shrink-0 text-sm font-medium text-apple hover:underline"
                                  >
                                    Rouvrir
                                  </button>
                                )}
                              {!active && !currentActive && (
                                <span className="text-ink/35 shrink-0 text-xs">
                                  Impossible à rouvrir : aucune inscription
                                  active à refermer
                                </span>
                              )}
                            </div>

                            {reopening?.enrollmentId === enrollment.id && (
                              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-sm text-amber-800">
                                  Rouvrir « {enrollment.semester} » ? Ce
                                  semestre redeviendra actif, et{' '}
                                  {currentActive?.semester} cessera de l’être.
                                  Les cours visibles changeront en conséquence.
                                  Aucune inscription n’est supprimée, et la
                                  progression déjà enregistrée est conservée.
                                </p>
                                <div className="mt-2.5 flex items-center gap-3">
                                  <Button
                                    size="md"
                                    loading={busy}
                                    onClick={() =>
                                      reopen(
                                        student.id,
                                        enrollment.id,
                                        currentActive?.id ?? null
                                      )
                                    }
                                  >
                                    Oui, rouvrir
                                  </Button>
                                  <button
                                    onClick={() => setReopening(null)}
                                    className="text-ink/60 text-sm font-medium hover:underline"
                                  >
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {progressingId === student.id && (
                    <div className="mt-3 rounded-card border border-apple/30 bg-oca-tint/30 p-4">
                      <p className="text-[15px] font-medium text-ink">
                        Faire progresser {displayName(student)}
                      </p>
                      <p className="text-ink/50 mb-1 mt-0.5 text-sm">
                        Utilisez cette action pour passer l’étudiant au semestre
                        ou à l’année suivante en conservant l’historique.
                      </p>
                      <p className="text-ink/50 mb-3 text-sm">
                        Actuellement :{' '}
                        {student.enrollmentStatus
                          ? `${student.program} · ${student.semester} · ${student.academicYear}`
                          : 'aucune inscription active'}
                      </p>

                      {targetPickers}

                      <p className="mt-3 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        L’ancien rattachement sera marqué comme terminé. Les
                        cours visibles seront ceux du nouveau semestre. La
                        progression déjà enregistrée n’est pas supprimée.
                      </p>

                      {progressError && (
                        <div
                          role="alert"
                          className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                        >
                          {progressError}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          disabled={
                            !progressForm.programId || !progressForm.semesterId
                          }
                          onClick={() => progressStudent(student.id)}
                        >
                          Confirmer la progression
                        </Button>
                        <button
                          onClick={closePanels}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {editingId === student.id && (
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
                        l’identifiant de l’étudiant.
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
                          onClick={() => saveStudent(student.id)}
                        >
                          Enregistrer
                        </Button>
                        <button
                          onClick={closePanels}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {movingId === student.id && (
                    <div className="mt-3 rounded-card border border-apple/30 bg-oca-tint/30 p-4">
                      <p className="mb-1 text-[15px] font-medium text-ink">
                        Corriger le rattachement de {displayName(student)}
                      </p>
                      <p className="text-ink/50 mb-1 text-sm">
                        Utilisez cette action pour corriger une erreur de
                        rattachement. Pour un passage de semestre, utilisez
                        « Faire progresser ».
                      </p>
                      <p className="text-ink/50 mb-3 text-sm">
                        Actuellement :{' '}
                        {student.enrollmentStatus
                          ? `${student.program} · ${student.semester} · ${student.academicYear}`
                          : 'aucune inscription'}
                      </p>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-ink/70">
                            Programme
                          </span>
                          <select
                            value={moveForm.programId}
                            onChange={(e) =>
                              setMoveForm((c) => ({
                                ...c,
                                programId: e.target.value,
                                semesterId: '',
                              }))
                            }
                            className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                          >
                            <option value="">Choisir un programme</option>
                            {structure.programs.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-ink/70">
                            Année universitaire
                          </span>
                          <select
                            value={moveForm.academicYearId}
                            onChange={(e) =>
                              setMoveForm((c) => ({
                                ...c,
                                academicYearId: e.target.value,
                                semesterId: '',
                              }))
                            }
                            className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                          >
                            <option value="">Toutes les années</option>
                            {structure.academicYears.map((y) => (
                              <option key={y.id} value={y.id}>
                                {y.isCurrent ? `${y.name} · en cours` : y.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-ink/70">
                            Semestre
                          </span>
                          <select
                            value={moveForm.semesterId}
                            onChange={(e) =>
                              setMoveForm((c) => ({
                                ...c,
                                semesterId: e.target.value,
                              }))
                            }
                            className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                          >
                            <option value="">Choisir un semestre</option>
                            {moveSemesters.map((sem) => (
                              <option key={sem.id} value={sem.id}>
                                {sem.name}
                              </option>
                            ))}
                          </select>
                          {!moveForm.programId && (
                            <span className="text-ink/45 mt-1 block text-xs">
                              Choisissez d’abord un programme
                            </span>
                          )}
                        </label>
                      </div>

                      <p className="mt-3 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Changer le semestre modifie les cours visibles pour cet
                        étudiant. Sa progression déjà enregistrée n’est pas
                        supprimée, mais elle porte sur les cours de l’ancien
                        semestre.
                      </p>

                      {moveError && (
                        <div
                          role="alert"
                          className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                        >
                          {moveError}
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          disabled={!moveForm.programId || !moveForm.semesterId}
                          onClick={() => moveStudent(student.id)}
                        >
                          {student.enrollmentStatus
                            ? 'Déplacer l’étudiant'
                            : 'Inscrire dans ce semestre'}
                        </Button>
                        <button
                          onClick={closePanels}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {resettingId === student.id && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        Générer un nouveau mot de passe provisoire pour{' '}
                        {displayName(student)} ? L’ancien cessera aussitôt de
                        fonctionner, et le nouveau ne s’affichera qu’une fois.
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          onClick={() => resetPassword(student)}
                        >
                          Générer
                        </Button>
                        <button
                          onClick={closePanels}
                          className="text-ink/60 text-sm font-medium hover:underline"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {togglingId === student.id && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">
                        {student.isActive
                          ? `Retirer l’accès de ${displayName(student)} ? Cet étudiant ne pourra plus se connecter à votre établissement ni voir ses cours. Son compte et son inscription sont conservés, et l’accès peut être rétabli.`
                          : `Rétablir l’accès de ${displayName(student)} ? Il retrouvera ses cours.`}
                      </p>
                      <div className="mt-2.5 flex items-center gap-3">
                        <Button
                          size="md"
                          loading={busy}
                          onClick={() => toggleAccess(student)}
                        >
                          {student.isActive ? 'Retirer l’accès' : 'Rétablir'}
                        </Button>
                        <button
                          onClick={closePanels}
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

            <p className="text-ink/40 mt-4 border-t border-hairline pt-4 text-xs">
              Aucun étudiant n’est supprimé : retirer l’accès conserve le
              compte, l’inscription et la progression.
            </p>
          </>
        )}
      </Card>
    </AppShell>
  )
}

// Protection côté serveur : administrateur d'établissement uniquement.
export const getServerSideProps = requireRoleSSR([Role.ADMIN])
