import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppShell } from '../../components/app/AppShell'
import { DarkCanvas } from '../../components/illustrations/Backdrop'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Reveal } from '../../components/anim/Reveal'
import { useMagnetic } from '../../components/anim/useMagnetic'
import { useCurrentUser, displayName } from '../../lib/auth'
import { PlayIcon, ArrowIcon, BookIcon } from '../../components/ui/icons'

interface StudentCourse {
  id: string
  title: string
  code: string
  credits: number
  program: { name: string; code: string }
  semester: { name: string; academicYear: string }
  teacher: string | null
  moduleCount: number
  lessonCount: number
  completedLessons: number
  progress: number
  firstModule: { id: string; title: string } | null
}

interface Resume {
  courseId: string
  lessonId: string
  lessonTitle: string
  moduleTitle: string
  status: 'IN_PROGRESS' | 'COMPLETED'
}

export default function StudentToday() {
  const { user } = useCurrentUser()
  const first = displayName(user).split(' ')[0]
  const [hello, setHello] = useState({ greet: 'Bonjour', date: '' })
  const [courses, setCourses] = useState<StudentCourse[] | null>(null)
  const [enrolled, setEnrolled] = useState(true)
  const [resumePoint, setResumePoint] = useState<Resume | null>(null)

  useEffect(() => {
    fetch('/api/student/courses')
      .then((r) =>
        r.ok ? r.json() : { enrolled: false, courses: [], resume: null }
      )
      .then((d) => {
        setEnrolled(Boolean(d.enrolled))
        setCourses(Array.isArray(d.courses) ? d.courses : [])
        setResumePoint(d.resume ?? null)
      })
      .catch(() => setCourses([]))
  }, [])

  const list = courses ?? []
  // Reprise : le cours de la dernière leçon consultée ; à défaut, le premier
  // cours doté de contenu publié.
  const resumeCourse = resumePoint
    ? list.find((c) => c.id === resumePoint.courseId) ?? null
    : null
  const resume = resumeCourse ?? list.find((c) => c.lessonCount > 0) ?? null
  const semester = list[0]?.semester ?? null
  const totalCredits = list.reduce((n, c) => n + c.credits, 0)
  const totalLessons = list.reduce((n, c) => n + c.lessonCount, 0)
  const totalCompleted = list.reduce((n, c) => n + c.completedLessons, 0)
  const overallProgress =
    totalLessons === 0 ? 0 : Math.round((totalCompleted / totalLessons) * 100)

  useEffect(() => {
    const now = new Date()
    const greet = now.getHours() >= 18 ? 'Bonsoir' : 'Bonjour'
    const date = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    setHello({ greet, date: date.charAt(0).toUpperCase() + date.slice(1) })
  }, [])

  const magnet = useMagnetic<HTMLAnchorElement>(0.3)

  return (
    <AppShell
      role="student"
      requiredRole="student"
      bareHeader
      maxWidth="narrow"
    >
      {/* ── OPENING ─────────────────────────────── */}
      <section className="relative pb-16 pt-6 sm:pb-20 sm:pt-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[46rem] max-w-full -translate-x-1/2"
          style={{
            background:
              'radial-gradient(50% 60% at 50% 40%, rgba(0,113,227,0.08), transparent 70%)',
          }}
        />
        <div className="relative animate-fade-up">
          <p className="text-ink/35 text-[13px] font-medium uppercase tracking-[0.2em]">
            {hello.date || 'Aujourd’hui'}
          </p>
          <h1 className="mt-4 text-[40px] font-medium leading-[1.0] tracking-tightest text-ink sm:text-[56px]">
            {hello.greet}, {first}.
          </h1>
          <p className="text-ink/45 mt-4 max-w-md text-lg sm:text-xl">
            Votre prochain objectif vous attend.
          </p>
        </div>
      </section>

      {/* ── FOCUS ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Reveal y={24}>
          <DarkCanvas
            className="relative h-full rounded-hero p-8 sm:p-10"
            showOrbits={false}
          >
            {resume && (
              <div className="border-white/15 absolute right-6 top-6 hidden animate-float-slow items-center gap-2 rounded-full border bg-white/10 px-3 py-1.5 backdrop-blur-md sm:flex">
                <span className="text-[12px] font-medium text-white/80">
                  {resume.completedLessons} / {resume.lessonCount} leçons
                </span>
              </div>
            )}

            <div className="relative flex h-full flex-col">
              <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/50">
                {resumeCourse
                  ? 'Reprendre'
                  : resume
                  ? 'Commencer'
                  : 'Votre espace'}
              </p>
              <h2 className="mt-3 text-[26px] font-medium leading-tight tracking-tightest text-white sm:text-[32px]">
                {resume
                  ? resume.title
                  : !enrolled
                  ? 'Aucune inscription'
                  : 'Contenu à venir'}
              </h2>
              <p className="mt-1.5 text-[15px] text-white/50">
                {resumePoint && resumeCourse
                  ? `${resumePoint.moduleTitle} · ${resumePoint.lessonTitle}`
                  : resume
                  ? resume.firstModule
                    ? resume.firstModule.title
                    : `${resume.code} · ${resume.program.name}`
                  : !enrolled
                  ? 'Contactez votre administration pour être inscrit à un semestre.'
                  : 'Vos enseignants n’ont pas encore publié de leçon.'}
              </p>

              {resume && (
                <div className="mt-8">
                  <div className="text-white/55 mb-2 flex items-center justify-between text-[13px]">
                    <span>
                      {resume.completedLessons} / {resume.lessonCount} leçons
                      terminées
                    </span>
                    <span className="text-white/85 font-medium tabular-nums">
                      {resume.progress}%
                    </span>
                  </div>
                  <ProgressBar value={resume.progress} tone="white" />
                </div>
              )}

              <div className="mt-8">
                <Link
                  href={
                    resumePoint && resumeCourse
                      ? `/student/course/${resumePoint.courseId}/lesson/${resumePoint.lessonId}`
                      : resume
                      ? `/student/course/${resume.id}`
                      : '/student/courses'
                  }
                  ref={magnet}
                  className="group relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-full bg-white px-8 text-[15px] font-medium text-oca shadow-lift transition-transform duration-200 ease-out"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/60 opacity-0 blur-md transition-opacity duration-300 group-hover:animate-shimmer group-hover:opacity-100"
                  />
                  <PlayIcon size={18} />
                  {resumePoint && resumeCourse
                    ? 'Reprendre la leçon'
                    : resume
                    ? 'Ouvrir le cours'
                    : 'Voir mes cours'}
                  <ArrowIcon
                    size={17}
                    className="transition-transform duration-300 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>
            </div>
          </DarkCanvas>
        </Reveal>

        {/* next live — quiet satellite */}
        <Reveal y={24} delay={90}>
          <div className="flex h-full flex-col justify-between rounded-hero border border-hairline bg-white p-7 shadow-soft">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium uppercase tracking-[0.16em] text-oca/60">
                  Mon semestre
                </span>
                <span className="text-ink/35 text-[13px]">
                  {semester ? semester.academicYear : '—'}
                </span>
              </div>
              <h3 className="mt-5 text-xl font-medium tracking-tightest text-ink">
                {semester ? semester.name : 'Non inscrit'}
              </h3>
              <p className="text-ink/45 mt-1 text-[15px]">
                {list[0] ? list[0].program.name : 'Aucun programme'}
              </p>
            </div>
            <Link
              href="/student/courses"
              className="group mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-oca text-[15px] font-medium text-white no-underline transition-colors duration-300 hover:bg-oca-600"
            >
              Voir mes cours
              <ArrowIcon size={16} />
            </Link>
          </div>
        </Reveal>
      </div>

      {/* ── PROGRESSION — calm band ─────────────── */}
      <Reveal y={24} delay={60} className="mt-4 block">
        <div className="rounded-hero border border-hairline bg-white p-8 shadow-soft sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-oca/60">
                Ce semestre
              </p>
              <p className="mt-3 max-w-md text-2xl font-medium leading-snug tracking-tightest text-ink sm:text-[26px]">
                {list.length === 0
                  ? 'Aucun cours disponible pour le moment.'
                  : totalLessons === 0
                  ? `${list.length} cours · contenu à venir.`
                  : `${totalCompleted} leçon${
                      totalCompleted > 1 ? 's' : ''
                    } terminée${
                      totalCompleted > 1 ? 's' : ''
                    } sur ${totalLessons}.`}
              </p>
            </div>
            <p className="text-ink/45 text-[15px]">
              <span className="text-2xl font-medium tabular-nums text-ink">
                {totalCredits}
              </span>{' '}
              crédits {semester ? `· ${semester.name}` : ''}
            </p>
          </div>

          {totalLessons > 0 && (
            <div className="mt-6">
              <ProgressBar value={overallProgress} />
            </div>
          )}

          <div className="mt-8 border-t border-hairline pt-6">
            <p className="text-ink/35 text-[13px] font-medium uppercase tracking-[0.14em]">
              Mes cours
            </p>
            {list.length === 0 ? (
              <p className="text-ink/45 mt-3 text-[15px]">
                {enrolled
                  ? 'Aucun cours publié pour votre semestre.'
                  : 'Vous n’êtes inscrit à aucun semestre.'}
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-hairline">
                {list.slice(0, 5).map((c) => (
                  <li key={c.id} className="group">
                    <Link
                      href={`/student/course/${c.id}`}
                      className="flex items-center gap-4 py-3.5 no-underline first:pt-0 last:pb-0"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-cloud text-ink/50 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                        <BookIcon size={18} />
                      </span>
                      <span className="flex-1 truncate text-[15px] font-medium text-ink">
                        {c.title}
                      </span>
                      <span className="text-[13px] tabular-nums text-ink/40">
                        {c.lessonCount > 0
                          ? `${c.completedLessons}/${c.lessonCount} · ${c.progress}%`
                          : 'À venir'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Reveal>
    </AppShell>
  )
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.STUDENT])
