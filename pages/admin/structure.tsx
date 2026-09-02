import { Role } from '@prisma/client'
import { requireRoleSSR } from '../../lib/pageGuard'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../components/app/AppShell'
import { LoadError } from '../../components/admin/LoadState'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button, buttonClasses } from '../../components/ui/Button'
import { useToast } from '../../components/overlay/Toast'
import {
  ENTITIES,
  StructureEditForm,
  StructureForm,
  entityMeta,
  frozenNotice,
} from '../../components/admin/StructureForm'
import type {
  EntityKey,
  StructureData,
} from '../../components/admin/StructureForm'
import { LayersIcon } from '../../components/ui/icons'

/**
 * Atelier de structure académique.
 *
 * L'administrateur prépare ici son établissement avant d'inscrire le premier
 * étudiant. Les sept étapes sont présentées dans leur ordre de dépendance :
 * on ne peut pas créer un département sans faculté, ni un cours sans semestre.
 * L'écran le dit plutôt que de laisser l'erreur survenir au moment d'envoyer.
 */

const EMPTY: StructureData = {
  institution: null,
  faculties: [],
  cycles: [],
  programs: [],
  academicYears: [],
  semesters: [],
  courses: [],
}

/** Nombre d'éléments existants pour une étape donnée. */
function countFor(key: EntityKey, structure: StructureData): number {
  switch (key) {
    case 'faculty':
      return structure.faculties.length
    case 'department':
      return structure.faculties.reduce((n, f) => n + f.departments.length, 0)
    case 'cycle':
      return (structure.cycles ?? []).length
    case 'program':
      return structure.programs.length
    case 'academic-year':
      return structure.academicYears.length
    case 'semester':
      return structure.semesters.length
    case 'course':
      return structure.courses.length
  }
}

export default function AdminStructurePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [structure, setStructure] = useState<StructureData>(EMPTY)
  const [tab, setTab] = useState<EntityKey>('faculty')
  const [creating, setCreating] = useState(false)
  /** Élément en cours de correction, et confirmation d'archivage. */
  const [editingId, setEditingId] = useState<string | null>(null)
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [retrying, setRetrying] = useState(false)

  /**
   * Un chargement raté est signalé plutôt qu'absorbé : sans cela, l'écran
   * proposait de créer une faculté qui existe peut-être déjà.
   */
  const load = useCallback(async () => {
    const response = await fetch('/api/admin/structure')
    if (!response.ok) throw new Error('unavailable')
    const data = await response.json()
    setStructure({ ...EMPTY, ...data })
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

  // `?tab=course` permet d'arriver directement sur la bonne étape.
  useEffect(() => {
    const requested = router.query.tab
    if (typeof requested !== 'string') return
    const match = ENTITIES.find((entity) => entity.key === requested)
    if (match) setTab(match.key)
  }, [router.query.tab])

  const currentYear = structure.academicYears.find((y) => y.isCurrent) ?? null

  /** Une étape est faite dès qu'elle contient au moins un élément. */
  const progress = useMemo(() => {
    const done = ENTITIES.filter(
      (entity) => countFor(entity.key, structure) > 0
    )
    const missing = ENTITIES.filter(
      (entity) => countFor(entity.key, structure) === 0
    )
    return {
      done: done.length,
      total: ENTITIES.length,
      percent: Math.round((done.length / ENTITIES.length) * 100),
      missing,
      next: missing[0] ?? null,
    }
  }, [structure])

  const meta = entityMeta(tab)
  const blocked =
    meta.requires && countFor(meta.requires.key, structure) === 0
      ? meta.requires.message
      : null

  const onCreated = (entity: EntityKey, created: any) => {
    load()
    setCreating(false)
    toast({
      title: `${entityMeta(entity).label} créé(e)`,
      description: created?.name ?? created?.title ?? undefined,
      tone: 'success',
    })
  }

  // `blocked` désigne déjà, dans cette page, le prérequis manquant d'un
  // onglet. L'indisponibilité porte donc un autre nom.
  const unavailable =
    loadFailed &&
    structure.faculties.length === 0 &&
    structure.programs.length === 0

  /**
   * Rien n'a pu être chargé : mieux vaut n'afficher que la panne. Laisser les
   * compteurs à zéro et les états vides sous la bannière reviendrait à décrire
   * un établissement vide, ce qui est faux et pousse à recréer l'existant.
   */
  if (unavailable) {
    return (
      <AppShell
        role="admin"
        requiredRole="admin"
        title="Structure académique"
        subtitle="Préparez votre établissement avant d’inscrire des étudiants"
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
      title="Structure académique"
      subtitle="Préparez votre établissement avant d’inscrire des étudiants"
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

      {/* ------------------------------------------------------ synthèse */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-ink/45 text-sm">Établissement</p>
            <p className="text-xl font-medium tracking-tight text-ink">
              {structure.institution?.name ?? 'Chargement…'}
            </p>
            <p className="text-ink/45 mt-1 text-sm">
              {currentYear
                ? `Année universitaire ${currentYear.name}`
                : 'Aucune année universitaire en cours'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-medium tracking-tight text-ink">
              {progress.percent}%
            </p>
            <p className="text-ink/45 text-sm">
              {progress.done} étape(s) sur {progress.total}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <ProgressBar value={progress.percent} />
        </div>

        {progress.next ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-hairline bg-cloud/60 px-4 py-3">
            <p className="text-[15px] text-ink">
              <span className="text-ink/50">Prochaine étape · </span>
              Créer {progress.next.label.toLocaleLowerCase('fr')}
            </p>
            <button
              onClick={() => {
                setTab(progress.next!.key)
                setCreating(true)
              }}
              className={buttonClasses('primary', 'md')}
            >
              Y aller
            </button>
          </div>
        ) : (
          <p className="mt-4 rounded-card border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Votre structure est complète. Vous pouvez inscrire des étudiants
            depuis le pilotage.
          </p>
        )}
      </Card>

      {/* -------------------------------------------------------- étapes */}
      <div className="mt-5 flex flex-wrap gap-2">
        {ENTITIES.map((entity) => {
          const count = countFor(entity.key, structure)
          const active = entity.key === tab
          return (
            <button
              key={entity.key}
              onClick={() => {
                setTab(entity.key)
                setCreating(false)
                setEditingId(null)
                setArchivingId(null)
              }}
              className={
                'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ' +
                (active
                  ? 'border-oca bg-oca text-white'
                  : 'border-hairline bg-white text-ink/65 hover:bg-cloud')
              }
            >
              <span className={active ? 'opacity-70' : 'text-ink/35'}>
                {entity.step}
              </span>
              {entity.plural}
              <span
                className={
                  'rounded-full px-1.5 text-xs ' +
                  (active
                    ? 'bg-white/20'
                    : count > 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-cloud text-ink/40')
                }
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
        {/* ------------------------------------------------ liste + création */}
        <Card>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-[17px] font-medium tracking-tight text-ink">
                {meta.plural}
              </h2>
              <p className="text-ink/45 mt-0.5 text-sm">{meta.description}</p>
            </div>
            {!creating && !blocked && (
              <button
                onClick={() => setCreating(true)}
                className={buttonClasses('primary', 'md')}
              >
                Créer {meta.label.toLocaleLowerCase('fr')}
              </button>
            )}
          </div>

          {blocked && (
            <div className="mb-4 rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {blocked}
            </div>
          )}

          {creating && !blocked && (
            <div className="mb-5 rounded-card border border-apple/30 bg-oca-tint/30 p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] font-medium text-ink">
                  Nouveau · {meta.label}
                </p>
                <button
                  onClick={() => setCreating(false)}
                  className="text-ink/50 text-sm font-medium hover:underline"
                >
                  Annuler
                </button>
              </div>
              <StructureForm
                entity={tab}
                structure={structure}
                onCreated={onCreated}
                onError={(message) =>
                  toast({
                    title: 'Création impossible',
                    description: message,
                    tone: 'error',
                  })
                }
              />
            </div>
          )}

          <StructureList
            tab={tab}
            structure={structure}
            editingId={editingId}
            archivingId={archivingId}
            onEdit={(id) => {
              setEditingId(id)
              setArchivingId(null)
              setCreating(false)
            }}
            onCancelEdit={() => setEditingId(null)}
            onAskArchive={(id) => {
              setArchivingId(id)
              setEditingId(null)
            }}
            onCancelArchive={() => setArchivingId(null)}
            onArchive={async (id, archived) => {
              const response = await fetch(
                `/api/admin/structure/${tab}/${id}`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ archived }),
                }
              )
              const data = await response.json().catch(() => ({}))
              if (!response.ok) {
                toast({
                  title: 'Archivage impossible',
                  description: data.message,
                  tone: 'error',
                })
                return
              }
              setArchivingId(null)
              load()
              toast({
                title: archived ? 'Élément archivé' : 'Élément réactivé',
                tone: 'success',
              })
            }}
            onSaved={(fields) => {
              setEditingId(null)
              load()
              toast({
                title: 'Modification enregistrée',
                description: `${fields.length} champ(s) mis à jour.`,
                tone: 'success',
              })
            }}
            onError={(message) =>
              toast({
                title: 'Modification impossible',
                description: message,
                tone: 'error',
              })
            }
          />
        </Card>

        {/* ------------------------------------------------------- aide */}
        <Card>
          <p className="text-[15px] font-medium text-ink">Comment ça marche</p>
          <p className="text-ink/50 mt-2 text-sm leading-relaxed">
            Les sept étapes se suivent : chacune s’appuie sur la précédente.
            Vous pouvez y revenir à tout moment pour en ajouter.
          </p>

          <ul className="mt-4 space-y-2.5">
            {ENTITIES.map((entity) => {
              const count = countFor(entity.key, structure)
              return (
                <li
                  key={entity.key}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <span
                    className={
                      'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ' +
                      (count > 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-cloud text-ink/35')
                    }
                  >
                    {count > 0 ? '✓' : entity.step}
                  </span>
                  <span className={count > 0 ? 'text-ink/50' : 'text-ink'}>
                    {entity.plural}
                  </span>
                </li>
              )
            })}
          </ul>

          {progress.missing.length > 0 && (
            <p className="text-ink/45 mt-4 border-t border-hairline pt-4 text-sm">
              Il manque encore :{' '}
              {progress.missing
                .map((entity) => entity.plural.toLocaleLowerCase('fr'))
                .join(', ')}
              .
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  )
}

/** Ce qui existe déjà pour l'étape affichée. */
/** Entités dotées d'un statut : elles seules peuvent être archivées. */
const ARCHIVABLE: EntityKey[] = ['program', 'academic-year', 'semester', 'course']

function StructureList({
  tab,
  structure,
  editingId,
  archivingId,
  onEdit,
  onCancelEdit,
  onAskArchive,
  onCancelArchive,
  onArchive,
  onSaved,
  onError,
}: {
  tab: EntityKey
  structure: StructureData
  editingId: string | null
  archivingId: string | null
  onEdit: (id: string) => void
  onCancelEdit: () => void
  onAskArchive: (id: string) => void
  onCancelArchive: () => void
  onArchive: (id: string, archived: boolean) => void
  onSaved: (fields: string[]) => void
  onError: (message: string) => void
}) {
  const meta = entityMeta(tab)
  const rows: {
    id: string
    title: string
    detail: string
    badge?: string
    archived?: boolean
    record: Record<string, any>
  }[] = (() => {
      switch (tab) {
        case 'faculty':
          return structure.faculties.map((f) => ({
            id: f.id,
            title: f.name,
            detail: `${f.code} · ${f.departments.length} département(s)`,
            record: f,
          }))
        case 'department':
          return structure.faculties.flatMap((f) =>
            f.departments.map((d) => ({
              id: d.id,
              title: d.name,
              detail: `Faculté : ${f.name}`,
              record: { ...d, facultyId: f.id },
            }))
          )
        case 'cycle':
          return (structure.cycles ?? []).map((c) => ({
            id: c.id,
            title: c.name,
            detail: `${c.code} · ${c.level}`,
            record: c,
          }))
        case 'program':
          return structure.programs.map((p) => {
            const faculty = structure.faculties.find(
              (f) => f.id === p.facultyId
            )
            return {
              id: p.id,
              title: p.name,
              detail: `${p.code}${faculty ? ` · ${faculty.name}` : ''}`,
              badge: p.status,
              archived: p.status === 'ARCHIVED',
              record: p,
            }
          })
        case 'academic-year':
          return structure.academicYears.map((y) => ({
            id: y.id,
            title: y.name,
            detail: y.isCurrent ? 'Année en cours' : 'Année passée ou à venir',
            badge: y.isCurrent ? 'En cours' : (y as any).status,
            archived: (y as any).status === 'ARCHIVED',
            record: y,
          }))
        case 'semester':
          return structure.semesters.map((s) => {
            const program = structure.programs.find((p) => p.id === s.programId)
            const year = structure.academicYears.find(
              (y) => y.id === s.academicYearId
            )
            return {
              id: s.id,
              title: s.name,
              detail: [program?.name, year?.name].filter(Boolean).join(' · '),
              badge: `${s.courseCount} cours`,
              archived: (s as any).status === 'ARCHIVED',
              record: s,
            }
          })
        case 'course':
          return structure.courses.map((c) => {
            const semester = structure.semesters.find(
              (s) => s.id === c.semesterId
            )
            const program = semester
              ? structure.programs.find((p) => p.id === semester.programId)
              : undefined
            return {
              id: c.id,
              title: c.title,
              detail: [c.code, program?.name, semester?.name]
                .filter(Boolean)
                .join(' · '),
              badge: `${c.credits} crédits`,
              archived: (c as any).status === 'ARCHIVED',
              record: c,
            }
          })
      }
    })()

  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<LayersIcon size={22} />}
        title={`Aucun élément dans « ${meta.plural} »`}
        description={meta.description}
      />
    )
  }

  const archivable = ARCHIVABLE.includes(tab)

  return (
    <>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="flex flex-wrap items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-ink">
                  {row.title}
                </p>
                <p className="truncate text-sm text-ink/45">{row.detail}</p>
              </div>
              {row.archived && <Badge tone="warning">Archivé</Badge>}
              {row.badge && !row.archived && (
                <Badge tone="neutral">{row.badge}</Badge>
              )}
              {editingId !== row.id && (
                <button
                  onClick={() => onEdit(row.id)}
                  className="shrink-0 text-sm font-medium text-apple hover:underline"
                >
                  Modifier
                </button>
              )}
              {archivable && archivingId !== row.id && (
                <button
                  onClick={() => onAskArchive(row.id)}
                  className="text-ink/50 shrink-0 text-sm font-medium hover:underline"
                >
                  {row.archived ? 'Réactiver' : 'Archiver'}
                </button>
              )}
            </div>

            {archivingId === row.id && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800">
                  {row.archived
                    ? `Réactiver « ${row.title} » ?`
                    : tab === 'course'
                    ? `Archiver « ${row.title} » ? Ce cours ne sera plus accessible aux étudiants. L’action est réversible.`
                    : `Archiver « ${row.title} » ? C’est une étiquette de gestion : la visibilité des cours et des leçons n’en dépend pas. L’action est réversible.`}
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <Button
                    size="md"
                    onClick={() => onArchive(row.id, !row.archived)}
                  >
                    {row.archived ? 'Réactiver' : 'Archiver'}
                  </Button>
                  <button
                    onClick={onCancelArchive}
                    className="text-ink/60 text-sm font-medium hover:underline"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {editingId === row.id && (
              <StructureEditForm
                entity={tab}
                record={row.record}
                structure={structure}
                onCancel={onCancelEdit}
                onSaved={(_updated, fields) => onSaved(fields)}
                onError={onError}
              />
            )}
          </li>
        ))}
      </ul>

      <p className="text-ink/40 mt-4 border-t border-hairline pt-4 text-xs leading-relaxed">
        {frozenNotice(tab) ? `${frozenNotice(tab)} ` : ''}
        La suppression définitive sera traitée plus tard, avec contrôle des
        dépendances.
      </p>
    </>
  )
}

// Protection côté serveur : administrateur d'établissement uniquement.
export const getServerSideProps = requireRoleSSR([Role.ADMIN])
