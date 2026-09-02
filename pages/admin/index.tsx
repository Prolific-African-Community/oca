import { Role } from '@prisma/client';
import { requireRoleSSR } from '../../lib/pageGuard';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppShell } from '../../components/app/AppShell';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { buttonClasses } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Reveal } from '../../components/anim/Reveal';
import { AuditFeed } from '../../components/admin/AuditFeed';
import { LoadError } from '../../components/admin/LoadState';
import { useToast } from '../../components/overlay/Toast';
import { useRegisterCommands } from '../../components/overlay/command';
import { useCurrentUser } from '../../lib/auth';
import {
  PlusIcon,
  UsersIcon,
  ClipboardIcon,
  BookIcon,
  LayersIcon,
  CheckIcon,
  CapIcon,
} from '../../components/ui/icons';

/** Enseignants et affectations, tels que les servent les routes /api/admin. */
interface Teacher {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  assignmentCount: number;
  /** Un enseignant sans accès reste listé mais ne compte pas comme actif. */
  isActive: boolean;
}

interface Assignment {
  id: string;
  role: string;
  user: { id: string; firstName: string | null; lastName: string | null; email: string };
  course: {
    id: string;
    title: string;
    code: string;
    credits: number;
    program: { name: string; code: string };
    semester: { name: string };
  };
}

/** Structure académique réelle de l'établissement, servie par /api/admin/structure. */
interface Structure {
  institution: { id: string; name: string; slug: string } | null;
  faculties: { id: string; name: string; code: string; departments: { id: string; name: string }[] }[];
  cycles: { id: string; name: string; code: string; level: string }[];
  programs: { id: string; name: string; code: string; facultyId: string; status: string }[];
  academicYears: { id: string; name: string; isCurrent: boolean }[];
  semesters: {
    id: string;
    name: string;
    number: number;
    programId: string;
    academicYearId: string;
    courseCount: number;
  }[];
  courses: { id: string; title: string; code: string; credits: number; semesterId: string }[];
}

const EMPTY_STRUCTURE: Structure = {
  institution: null,
  faculties: [],
  cycles: [],
  programs: [],
  academicYears: [],
  semesters: [],
  courses: [],
};

export default function AdminWorkspace() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [structure, setStructure] = useState<Structure>(EMPTY_STRUCTURE);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);

  /**
   * Le cockpit ne peut pas se contenter d'écrans vides en cas de panne : ses
   * chiffres et sa liste d'étapes seraient faux plutôt qu'absents. Un échec de
   * chargement est donc affiché, avec une relance manuelle.
   */
  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch('/api/students/list'),
      fetch('/api/admin/structure'),
      fetch('/api/admin/teachers'),
      fetch('/api/admin/assignments'),
    ]);
    if (responses.some((r) => !r.ok)) throw new Error('unavailable');

    const [list, struct, t, a] = await Promise.all(
      responses.map((r) => r.json())
    );
    setStudents(Array.isArray(list) ? list : []);
    setStructure({ ...EMPTY_STRUCTURE, ...struct });
    setTeachers(Array.isArray(t) ? t : []);
    setAssignments(Array.isArray(a) ? a : []);
    setLoadFailed(false);
  }, []);

  const retry = useCallback(() => {
    setRetrying(true);
    load()
      .catch(() => setLoadFailed(true))
      .then(() => setRetrying(false));
  }, [load]);

  useEffect(() => {
    load().catch(() => setLoadFailed(true));
  }, [load]);

  /**
   * Mise en route de l'établissement, étape par étape.
   *
   * Chaque étape est vraie ou fausse d'après les données réelles : rien n'est
   * coché par défaut, et le pourcentage n'est pas décoratif. L'ordre suit la
   * dépendance réelle — sans faculté, pas de programme ; sans semestre, pas
   * de cours ; sans cours, pas d'affectation.
   */
  const setup = useMemo(() => {
    const currentYear = structure.academicYears.find((y) => y.isCurrent)
    const semestersThisYear = currentYear
      ? structure.semesters.filter((sem) => sem.academicYearId === currentYear.id)
      : []

    const steps = [
      {
        key: 'faculty',
        tab: 'faculty',
        label: 'Créer une faculté',
        done: structure.faculties.length > 0,
        action: 'structure' as const,
      },
      {
        key: 'program',
        tab: 'program',
        label: 'Créer un programme',
        done: structure.programs.length > 0,
        action: 'structure' as const,
      },
      {
        key: 'year',
        tab: 'academic-year',
        label: 'Déclarer l’année universitaire en cours',
        done: Boolean(currentYear),
        action: 'structure' as const,
      },
      {
        key: 'semester',
        tab: 'semester',
        label: 'Ajouter les semestres de l’année',
        done: semestersThisYear.length > 0,
        action: 'structure' as const,
      },
      {
        key: 'course',
        tab: 'course',
        label: 'Créer au moins un cours',
        done: structure.courses.length > 0,
        action: 'structure' as const,
      },
      {
        key: 'assignment',
        label: 'Affecter un professeur à un cours',
        done: assignments.length > 0,
        action: 'assignment' as const,
      },
      {
        key: 'student',
        label: 'Inscrire un premier étudiant',
        done: students.length > 0,
        action: 'student' as const,
      },
    ]

    const done = steps.filter((step) => step.done).length
    return {
      steps,
      done,
      total: steps.length,
      percent: Math.round((done / steps.length) * 100),
      next: steps.find((step) => !step.done) ?? null,
      currentYear,
    }
  }, [structure, assignments, students])

  // Avancement d'un programme = part de ses semestres qui contiennent au moins un cours.
  const programProgress = useMemo(
    () =>
      structure.programs.map((prog) => {
        const semesters = structure.semesters.filter((sem) => sem.programId === prog.id);
        const filled = semesters.filter((sem) => sem.courseCount > 0).length;
        return {
          name: prog.name,
          complete: semesters.length === 0 ? 0 : Math.round((filled / semesters.length) * 100),
        };
      }),
    [structure]
  );

  useRegisterCommands(
    'admin:actions',
    [
      {
        id: 'admin:new-student',
        label: 'Inscrire un étudiant',
        hint: 'Nouveau',
        group: 'Actions',
        icon: <PlusIcon size={17} />,
        perform: () => router.push('/admin/students'),
      },
      {
        id: 'admin:assignments',
        label: 'Affecter les enseignants',
        hint: 'Enseignant ↔ cours',
        group: 'Actions',
        icon: <UsersIcon size={17} />,
        perform: () => router.push('/admin/professors'),
      },
      {
        id: 'admin:structure',
        label: 'Structure académique',
        hint: 'Facultés, programmes, semestres, cours',
        group: 'Actions',
        icon: <LayersIcon size={17} />,
        perform: () => router.push('/admin/structure'),
      },
    ],
    []
  );

  const recent = useMemo(() => students.slice(-5).reverse(), [students]);

  const activeStudents = useMemo(
    () => students.filter((s) => s.isActive !== false),
    [students]
  );

  const studentsWithoutEnrollment = useMemo(
    () => students.filter((s) => !s.enrollmentStatus).length,
    [students]
  );

  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.isActive !== false),
    [teachers]
  );

  const coursesWithoutTeacher = useMemo(() => {
    const taught = new Set(assignments.map((a) => a.course.id));
    return structure.courses.filter((c) => !taught.has(c.id)).length;
  }, [structure.courses, assignments]);

  const blocked =
    loadFailed && students.length === 0 && structure.faculties.length === 0;

  /**
   * Le cockpit ne montre rien plutôt que de mentir : ses étapes de mise en
   * route se déduiraient de données absentes et annonceraient un établissement
   * à configurer, alors qu'il l'est peut-être déjà.
   */
  if (blocked) {
    return (
      <AppShell
        role="admin"
        requiredRole="admin"
        title="Pilotage"
        subtitle="Votre campus aujourd’hui"
      >
        <LoadError onRetry={retry} retrying={retrying} />
      </AppShell>
    );
  }

  return (
    <AppShell
      role="admin"
      requiredRole="admin"
      title="Pilotage"
      subtitle="Votre campus aujourd’hui"
      action={
        <Link
          href="/admin/students"
          className={buttonClasses('primary', 'md', 'no-underline hidden sm:inline-flex')}
        >
          <PlusIcon size={18} /> Inscrire un étudiant
        </Link>
      }
    >
      {loadFailed && (
        <LoadError className="mb-5" onRetry={retry} retrying={retrying} />
      )}

      {/* ---------------------------------------------- Vue d'ensemble */}
      <Reveal>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-ink/45 text-sm">Établissement</p>
              <p className="text-xl font-medium tracking-tight text-ink">
                {structure.institution?.name ?? 'Établissement non configuré'}
              </p>
              <p className="text-ink/45 mt-1 text-sm">
                {setup.currentYear
                  ? `Année universitaire ${setup.currentYear.name}`
                  : 'Aucune année universitaire en cours'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-medium tracking-tight text-ink">
                {setup.percent}%
              </p>
              <p className="text-ink/45 text-sm">
                {setup.done} étape(s) sur {setup.total}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <ProgressBar value={setup.percent} />
          </div>

          {setup.next ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-cloud/60 px-4 py-3">
              <p className="text-[15px] text-ink">
                <span className="text-ink/50">Prochaine étape · </span>
                {setup.next.label}
              </p>
              {/* Chaque étape mène là où elle se traite réellement. */}
              {/* Chaque étape mène là où elle se traite réellement. */}
              <Link
                href={
                  setup.next.action === 'student'
                    ? '/admin/students'
                    : setup.next.action === 'assignment'
                    ? '/admin/professors?mode=assign'
                    : `/admin/structure?tab=${setup.next.tab ?? 'faculty'}`
                }
                className={buttonClasses('primary', 'md', 'no-underline')}
              >
                Faire maintenant
              </Link>
            </div>
          ) : (
            <p className="mt-4 rounded-card border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Votre établissement est configuré. Vous pouvez inscrire des
              étudiants et suivre l’activité ci-dessous.
            </p>
          )}
        </Card>
      </Reveal>

      {/* -------------------------------------------------- Chiffres clés */}
      <Reveal delay={60}>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Metric
            label="Étudiants inscrits"
            value={activeStudents.length}
            hint={`${studentsWithoutEnrollment} sans inscription`}
            alert={studentsWithoutEnrollment > 0}
          />
          <Metric
            label="Professeurs"
            value={activeTeachers.length}
            hint={`${assignments.length} affectation(s)`}
          />
          <Metric
            label="Cours"
            value={structure.courses.length}
            hint={`${coursesWithoutTeacher} sans professeur`}
            alert={coursesWithoutTeacher > 0}
          />
          <Metric
            label="Programmes"
            value={structure.programs.length}
            hint={`${structure.faculties.length} faculté(s)`}
          />
        </div>
      </Reveal>

      {/* --------------------------------------------------- Que faire ? */}
      <Reveal delay={90}>
        <Card className="mt-5">
          <CardHeader title="Que souhaitez-vous faire ?" />
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/students"
              className={buttonClasses('primary', 'md', 'no-underline')}
            >
              <PlusIcon size={18} /> Inscrire un étudiant
            </Link>
            <Link
              href="/admin/structure"
              className={buttonClasses('secondary', 'md', 'no-underline')}
            >
              Configurer la structure
            </Link>
            <Link
              href="/admin/professors?mode=assign"
              className={buttonClasses('secondary', 'md', 'no-underline')}
            >
              Affecter un professeur
            </Link>
            <Link
              href="/admin/structure?tab=course"
              className={buttonClasses('secondary', 'md', 'no-underline')}
            >
              Créer un cours
            </Link>
            {/* La barre latérale n'existe pas sur mobile : ce raccourci est le
                seul accès aux paramètres depuis un téléphone. */}
            <Link
              href="/admin/settings"
              className={buttonClasses('secondary', 'md', 'no-underline')}
            >
              Paramètres
            </Link>
          </div>
        </Card>
      </Reveal>

      {/* ------------------------------------------- Structure académique */}
      <Section
        id="structure"
        title="Structure académique"
        description="Facultés, programmes, années et semestres de votre établissement."
        actionLabel="Configurer la structure"
        actionHref="/admin/structure"
      >
        {structure.faculties.length === 0 ? (
          <EmptyState
            icon={<LayersIcon size={22} />}
            title="Rien n’est encore configuré"
            description="Créez une faculté, puis un programme : le reste en découle."
            action={
              <Link
                href="/admin/structure"
                className={buttonClasses('primary', 'md', 'no-underline')}
              >
                Commencer
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Metric compact label="Facultés" value={structure.faculties.length} />
              <Metric
                compact
                label="Départements"
                value={structure.faculties.reduce(
                  (n, f) => n + f.departments.length,
                  0
                )}
              />
              <Metric compact label="Cycles" value={structure.cycles.length} />
              <Metric compact label="Programmes" value={structure.programs.length} />
              <Metric compact label="Semestres" value={structure.semesters.length} />
            </div>

            {programProgress.length > 0 && (
              <ul className="mt-5 space-y-4">
                {programProgress.map((p) => (
                  <li key={p.name}>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span
                        className={
                          p.complete < 100 ? 'text-amber-600' : 'text-emerald-600'
                        }
                      >
                        {p.complete < 100
                          ? 'Semestres à compléter'
                          : 'Tous les semestres ont des cours'}
                      </span>
                    </div>
                    <ProgressBar value={p.complete} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      {/* ------------------------------------------------------ Étudiants */}
      <Section
        id="etudiants"
        title="Étudiants"
        description="Les personnes inscrites dans votre établissement."
        actionLabel="Gérer les étudiants"
        actionHref="/admin/students"
      >
        {students.length === 0 ? (
          <EmptyState
            icon={<UsersIcon size={22} />}
            title="Aucun étudiant pour le moment"
            description="Inscrivez votre premier étudiant — cela prend quelques secondes."
            action={
              <Link
                href="/admin/students"
                className={buttonClasses('primary', 'md', 'no-underline')}
              >
                <PlusIcon size={17} /> Inscrire un étudiant
              </Link>
            }
          />
        ) : (
          <>
            <p className="text-ink/50 mb-3 text-sm">
              {students.length} étudiant(s) · les {recent.length} derniers
              inscrits
            </p>
            <ul className="space-y-1">
              {recent.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
                >
                  <Avatar name={`${s.firstName} ${s.lastName}`} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {s.firstName} {s.lastName}
                    </p>
                    <p className="truncate text-sm text-ink/45">{s.email}</p>
                  </div>
                  <div className="hidden items-center gap-2 sm:flex">
                    {s.enrollmentStatus ? (
                      <>
                        <Badge tone="brand">{s.faculty}</Badge>
                        <Badge tone="neutral">{s.program}</Badge>
                        {s.semester && <Badge tone="neutral">{s.semester}</Badge>}
                      </>
                    ) : (
                      <Badge tone="warning">Sans inscription</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* ---------------------------------------------------- Professeurs */}
      <Section
        id="professeurs"
        title="Professeurs"
        description="Les enseignants et les cours dont ils ont la charge."
        actionLabel="Gérer les professeurs"
        actionHref="/admin/professors"
      >
        {activeTeachers.length === 0 ? (
          <EmptyState
            icon={<CapIcon size={22} />}
            title="Aucun professeur enregistré"
            description="Les professeurs apparaîtront ici une fois ajoutés à l’établissement."
          />
        ) : (
          <ul className="space-y-1">
            {activeTeachers.slice(0, 6).map((t) => {
              // Le compte est déjà calculé côté API pour chaque enseignant.
              const count = t.assignmentCount
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
                >
                  <Avatar name={`${t.firstName} ${t.lastName}`} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">
                      {t.firstName} {t.lastName}
                    </p>
                    <p className="truncate text-sm text-ink/45">{t.email}</p>
                  </div>
                  <Badge tone={count === 0 ? 'warning' : 'neutral'}>
                    {count === 0 ? 'Aucun cours' : `${count} cours`}
                  </Badge>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      {/* ---------------------------------------------------------- Cours */}
      <Section
        id="cours"
        title="Cours"
        description="Les enseignements rattachés aux semestres de vos programmes."
        actionLabel="Créer un cours"
        actionHref="/admin/structure?tab=course"
      >
        {structure.courses.length === 0 ? (
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Aucun cours"
            description="Créez d’abord un semestre, puis ajoutez-y des cours."
            action={
              <Link
                href="/admin/structure"
                className={buttonClasses('primary', 'md', 'no-underline')}
              >
                Configurer la structure
              </Link>
            }
          />
        ) : (
          <>
            {coursesWithoutTeacher > 0 && (
              <p className="mb-3 text-sm text-amber-600">
                {coursesWithoutTeacher} cours n’ont pas encore de professeur.
              </p>
            )}
            <ul className="space-y-1">
              {structure.courses.slice(0, 8).map((course) => {
                const taught = assignments.some((a) => a.course.id === course.id)
                return (
                  <li
                    key={course.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cloud text-ink/50">
                      <BookIcon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">
                        {course.title}
                      </p>
                      <p className="truncate text-sm text-ink/45">
                        {course.code} · {course.credits} crédits
                      </p>
                    </div>
                    <Badge tone={taught ? 'success' : 'warning'}>
                      {taught ? 'Professeur affecté' : 'Sans professeur'}
                    </Badge>
                  </li>
                )
              })}
            </ul>
            {structure.courses.length > 8 && (
              <p className="text-ink/45 mt-3 text-sm">
                et {structure.courses.length - 8} autre(s) cours.
              </p>
            )}
          </>
        )}
      </Section>

      {/* ------------------------------------------------ Activité récente */}
      <Section
        id="activite"
        title="Activité récente"
        description="Ce qui a été créé ou modifié dans votre établissement."
      >
        <AuditFeed limit={8} />
      </Section>

    </AppShell>
  );
}

/** Une mesure du cockpit : chiffre lisible, intitulé simple, alerte si utile. */
function Metric({
  label,
  value,
  hint,
  alert,
  compact,
}: {
  label: string;
  value: number;
  hint?: string;
  alert?: boolean;
  compact?: boolean;
}) {
  const body = (
    <>
      <p
        className={
          (compact ? 'text-lg' : 'text-2xl') +
          ' font-medium tracking-tight ' +
          (alert ? 'text-amber-600' : 'text-ink')
        }
      >
        {value}
      </p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
      {hint && <p className="text-ink/40 mt-0.5 text-xs">{hint}</p>}
    </>
  );

  if (compact) return <div className="min-w-0">{body}</div>;

  return (
    <div className="rounded-hero border border-hairline bg-white p-4 shadow-soft">
      {body}
    </div>
  );
}

/** Section ancrée du cockpit : un titre, une phrase, une action. */
function Section({
  id,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  children,
}: {
  id: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Certaines actions mènent à une page dédiée plutôt qu'à un tiroir. */
  actionHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-5 scroll-mt-24">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-medium tracking-tight text-ink">
              {title}
            </h2>
            <p className="text-ink/45 mt-0.5 text-sm">{description}</p>
          </div>
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className={buttonClasses('secondary', 'md', 'no-underline')}
            >
              {actionLabel}
            </Link>
          )}
          {actionLabel && !actionHref && onAction && (
            <button
              onClick={onAction}
              className={buttonClasses('secondary', 'md')}
            >
              {actionLabel}
            </button>
          )}
        </div>
        {children}
      </Card>
    </section>
  );
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.ADMIN]);
