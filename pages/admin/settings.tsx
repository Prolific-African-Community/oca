import { Role } from '@prisma/client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { requireRoleSSR } from '../../lib/pageGuard'
import { AppShell } from '../../components/app/AppShell'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { buttonClasses } from '../../components/ui/Button'
import { LoadError } from '../../components/admin/LoadState'
import { LayersIcon, UsersIcon, CapIcon } from '../../components/ui/icons'

/**
 * Paramètres de l'établissement.
 *
 * Cette page ne propose aucun réglage qui n'existe pas. Tant qu'aucune route
 * ne permet de modifier l'établissement lui-même, elle présente ce qui est
 * vrai — identité, année en cours, volumétrie — et renvoie vers les ateliers
 * où les changements se font réellement. Une page de réglages remplie
 * d'interrupteurs sans effet serait pire qu'une page sobre : elle ferait
 * croire à des actions possibles.
 */

interface Data {
  institution: { id: string; name: string; slug: string } | null
  programs: unknown[]
  courses: unknown[]
  faculties: unknown[]
  semesters: unknown[]
  academicYears: { id: string; name: string; isCurrent: boolean }[]
}

const EMPTY: Data = {
  institution: null,
  programs: [],
  courses: [],
  faculties: [],
  semesters: [],
  academicYears: [],
}

export default function AdminSettings() {
  const [data, setData] = useState<Data>(EMPTY)
  const [studentCount, setStudentCount] = useState(0)
  const [teacherCount, setTeacherCount] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch('/api/admin/structure'),
      fetch('/api/students/list'),
      fetch('/api/admin/teachers'),
    ])
    if (responses.some((r) => !r.ok)) throw new Error('unavailable')

    const [structure, students, teachers] = await Promise.all(
      responses.map((r) => r.json())
    )
    setData({ ...EMPTY, ...structure })
    // Seuls les comptes réellement actifs sont comptés : un compte dont
    // l'accès a été retiré ne pèse plus dans la volumétrie de l'établissement.
    setStudentCount(
      Array.isArray(students)
        ? students.filter((s: any) => s.isActive !== false).length
        : 0
    )
    setTeacherCount(
      Array.isArray(teachers)
        ? teachers.filter((t: any) => t.isActive !== false).length
        : 0
    )
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

  const currentYear = data.academicYears.find((y) => y.isCurrent) ?? null

  return (
    <AppShell
      role="admin"
      requiredRole="admin"
      title="Paramètres"
      subtitle="Les informations de votre établissement, et où les modifier"
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

      {/* ------------------------------------------------------- identité */}
      <Card>
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Établissement
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          Ces informations ont été définies à la création de votre
          établissement. Elles ne se modifient pas depuis cet écran.
        </p>

        <dl className="mt-4 space-y-3">
          <Row label="Nom">{data.institution?.name ?? '—'}</Row>
          <Row label="Identifiant">
            <span className="font-mono text-[14px]">
              {data.institution?.slug ?? '—'}
            </span>
          </Row>
          <Row label="Année universitaire en cours">
            {currentYear ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                {currentYear.name}
                <Badge tone="success">En cours</Badge>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                Aucune
                <Badge tone="warning">À déclarer</Badge>
              </span>
            )}
          </Row>
        </dl>

        {!currentYear && (
          <div className="mt-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              Sans année universitaire en cours, les semestres n’ont pas de
              cadre : les inscriptions et les progressions deviennent difficiles
              à situer dans le temps.
            </p>
            <Link
              href="/admin/structure?tab=academic-year"
              className={buttonClasses('secondary', 'md', 'no-underline mt-3')}
            >
              Déclarer l’année en cours
            </Link>
          </div>
        )}
      </Card>

      {/* ----------------------------------------------------- volumétrie */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Contenu de l’établissement
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          Ce que contient votre campus aujourd’hui.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <Count label="Facultés" value={data.faculties.length} />
          <Count label="Programmes" value={data.programs.length} />
          <Count label="Cours" value={data.courses.length} />
          <Count label="Étudiants" value={studentCount} />
          <Count label="Professeurs" value={teacherCount} />
        </div>
      </Card>

      {/* ----------------------------------------------------- raccourcis */}
      <Card className="mt-5">
        <h2 className="text-[17px] font-medium tracking-tight text-ink">
          Où modifier quoi
        </h2>
        <p className="text-ink/45 mt-0.5 text-sm">
          Chaque réglage se fait dans l’atelier auquel il appartient.
        </p>
        <ul className="mt-4 space-y-2">
          <Shortcut
            href="/admin/structure"
            icon={<LayersIcon size={19} />}
            title="Structure académique"
            description="Facultés, cycles, programmes, années, semestres et cours."
          />
          <Shortcut
            href="/admin/professors"
            icon={<CapIcon size={19} />}
            title="Professeurs"
            description="Comptes enseignants, affectations aux cours, accès."
          />
          <Shortcut
            href="/admin/students"
            icon={<UsersIcon size={19} />}
            title="Étudiants"
            description="Inscriptions, cohortes, progression académique, accès."
          />
        </ul>

        <p className="text-ink/40 mt-5 text-sm">
          Paramètres avancés à venir : personnalisation de l’établissement,
          règles de notation et modèles de documents.
        </p>
      </Card>
    </AppShell>
  )
}

function Row({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline pb-3 last:border-0 last:pb-0">
      <dt className="text-ink/50 text-sm">{label}</dt>
      <dd className="min-w-0 break-words text-[15px] font-medium text-ink">
        {children}
      </dd>
    </div>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-medium tracking-tight text-ink">{value}</p>
      <p className="text-ink/50 text-sm leading-tight">{label}</p>
    </div>
  )
}

function Shortcut({
  href,
  icon,
  title,
  description,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-2xl border border-hairline p-3 no-underline transition-colors hover:bg-cloud"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-oca-tint text-oca">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-medium text-ink">{title}</span>
          <span className="text-ink/50 block text-sm">{description}</span>
        </span>
      </Link>
    </li>
  )
}

// Protection côté serveur : la page n'est rendue que pour un administrateur.
export const getServerSideProps = requireRoleSSR([Role.ADMIN])
