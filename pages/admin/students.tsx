import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { buttonClasses } from '../../components/ui/Button'
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

  const load = useCallback(async () => {
    const [list, s] = await Promise.all([
      fetch('/api/students/list').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/structure').then((r) => (r.ok ? r.json() : null)),
    ])
    setStudents(Array.isArray(list) ? list : [])
    setStructure({
      programs: s?.programs ?? [],
      academicYears: s?.academicYears ?? [],
      semesters: s?.semesters ?? [],
    })
  }, [])

  useEffect(() => {
    load().catch(() => undefined)
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
            description="Créez d’abord un programme et un semestre : un étudiant s’inscrit toujours dans un semestre."
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
              </li>
            ))}
          </ul>
          <p className="text-ink/40 mt-3 text-xs">
            Le rattachement d’un compte existant sera traité dans un prochain
            run : aujourd’hui, l’inscription se fait à la création.
          </p>
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

        {cohorts.length === 0 ? (
          <p className="text-ink/45 text-sm">
            Aucune cohorte : inscrivez des étudiants dans un semestre.
          </p>
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
                      setProgramFilter(
                        cohort.students[0]?.programId ?? ''
                      )
                      setQuery(cohort.semester)
                      setFilter('all')
                    }}
                    className="text-sm font-medium text-apple hover:underline"
                  >
                    Voir
                  </button>
                </div>
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

        {students.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={22} />}
            title="Aucun étudiant"
            description="Inscrivez votre premier étudiant — cela prend quelques secondes."
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
                  className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
                >
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
                </li>
              ))}
            </ul>

            <p className="text-ink/40 mt-4 border-t border-hairline pt-4 text-xs">
              La correction d’un compte étudiant, la réinitialisation de son
              mot de passe et le retrait d’accès seront traités dans un
              prochain run.
            </p>
          </>
        )}
      </Card>
    </AppShell>
  )
}

// Protection côté serveur : administrateur d'établissement uniquement.
export const getServerSideProps = requireRoleSSR([Role.ADMIN])
