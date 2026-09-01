import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Avatar } from '../../components/ui/Avatar'
import { Button, buttonClasses } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
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
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [t, a, s] = await Promise.all([
      fetch('/api/admin/teachers').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/assignments').then((r) => (r.ok ? r.json() : [])),
      fetch('/api/admin/structure').then((r) => (r.ok ? r.json() : null)),
    ])
    setTeachers(Array.isArray(t) ? t : [])
    setAssignments(Array.isArray(a) ? a : [])
    setCourses(s?.courses ?? [])
    setSemesters(s?.semesters ?? [])
    setPrograms(s?.programs ?? [])
  }, [])

  useEffect(() => {
    load().catch(() => undefined)
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
        body: JSON.stringify({ userId, courseId }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Affectation impossible')

      setAssigningCourse(null)
      setPickedTeacher('')
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
              title="Aucun cours"
              description="Créez d’abord des cours dans la structure académique."
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
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {displayName(t)} · {t.assignmentCount} cours
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

        {teachers.length === 0 ? (
          <EmptyState
            icon={<CapIcon size={22} />}
            title="Aucun professeur"
            description="Ajoutez un premier enseignant pour pouvoir lui confier des cours."
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
            {teachers.map((teacher) => {
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
                    <Badge tone={taught.length === 0 ? 'warning' : 'neutral'}>
                      {taught.length === 0
                        ? 'Aucun cours'
                        : `${taught.length} cours`}
                    </Badge>
                  </div>

                  {taught.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-hairline pt-2">
                      {taught.map((assignment) => (
                        <li
                          key={assignment.id}
                          className="flex flex-wrap items-center gap-2 px-1 text-sm"
                        >
                          <span className="min-w-0 flex-1 truncate text-ink/70">
                            {assignment.course.title}
                          </span>
                          <span className="text-ink/40 truncate text-xs">
                            {assignment.course.code} ·{' '}
                            {assignment.course.program.name} ·{' '}
                            {assignment.course.semester.name}
                          </span>
                          <Badge tone="neutral">
                            {ROLE_LABELS[assignment.role] ?? assignment.role}
                          </Badge>
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
