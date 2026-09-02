import { useEffect, useMemo, useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * Formulaires de création de la structure académique.
 *
 * Extraits de l'ancien tiroir latéral pour être posés à l'aise dans la page
 * `/admin/structure` : mêmes champs, mêmes routes, mêmes validations. Seule
 * la place change — et la place, ici, fait la différence entre un formulaire
 * qu'on remplit et un formulaire qu'on subit.
 */

export interface StructureData {
  institution: { id: string; name: string; slug: string } | null
  faculties: {
    id: string
    name: string
    code: string
    departments: { id: string; name: string }[]
  }[]
  programs: {
    id: string
    name: string
    code: string
    facultyId: string
    status: string
  }[]
  cycles?: { id: string; name: string; code: string; level: string }[]
  academicYears: { id: string; name: string; isCurrent: boolean }[]
  semesters: {
    id: string
    name: string
    number: number
    programId: string
    academicYearId: string
    courseCount: number
  }[]
  courses: {
    id: string
    title: string
    code: string
    credits: number
    semesterId: string
  }[]
}

export type EntityKey =
  | 'faculty'
  | 'department'
  | 'cycle'
  | 'program'
  | 'academic-year'
  | 'semester'
  | 'course'

/**
 * Description de chaque étape : ce que c'est, ce qu'il faut avant.
 * `requires` sert à la fois au message d'aide et au blocage du formulaire —
 * inutile d'ouvrir un formulaire de département sans faculté.
 */
export const ENTITIES: {
  key: EntityKey
  step: number
  label: string
  plural: string
  description: string
  requires?: { key: EntityKey; message: string }
}[] = [
  {
    key: 'faculty',
    step: 1,
    label: 'Faculté',
    plural: 'Facultés',
    description:
      'Les grandes divisions de votre établissement. Tout part de là : sans faculté, rien d’autre ne peut être créé.',
  },
  {
    key: 'department',
    step: 2,
    label: 'Département',
    plural: 'Départements',
    description:
      'Les subdivisions d’une faculté. Facultatives, mais utiles pour ranger les programmes.',
    requires: { key: 'faculty', message: 'Créez d’abord une faculté.' },
  },
  {
    key: 'cycle',
    step: 3,
    label: 'Cycle',
    plural: 'Cycles',
    description:
      'Licence, Master ou Doctorat : la durée et le volume de crédits d’un parcours type.',
  },
  {
    key: 'program',
    step: 4,
    label: 'Programme',
    plural: 'Programmes',
    description:
      'La formation que suivent vos étudiants — par exemple « Licence Gestion des Entreprises ».',
    requires: {
      key: 'faculty',
      message: 'Créez d’abord une faculté, puis un cycle.',
    },
  },
  {
    key: 'academic-year',
    step: 5,
    label: 'Année universitaire',
    plural: 'Années universitaires',
    description:
      'La période de référence, par exemple 2025-2026. Une seule année est « en cours » à la fois.',
  },
  {
    key: 'semester',
    step: 6,
    label: 'Semestre',
    plural: 'Semestres',
    description:
      'Le découpage d’un programme sur une année. C’est à un semestre que les cours se rattachent.',
    requires: {
      key: 'program',
      message: 'Créez d’abord un programme et une année universitaire.',
    },
  },
  {
    key: 'course',
    step: 7,
    label: 'Cours',
    plural: 'Cours',
    description:
      'L’enseignement que suivront les étudiants et que préparera un professeur.',
    requires: {
      key: 'semester',
      message: 'Créez d’abord un semestre.',
    },
  },
]

export function entityMeta(key: EntityKey) {
  return ENTITIES.find((entity) => entity.key === key) ?? ENTITIES[0]
}

type Form = Record<string, string | boolean>

const DEFAULTS: Record<EntityKey, Form> = {
  faculty: { name: '', code: '' },
  department: { facultyId: '', name: '', code: '' },
  cycle: {
    level: 'LICENCE',
    name: 'Licence',
    code: 'L',
    durationYears: '3',
    totalCredits: '180',
  },
  program: {
    facultyId: '',
    departmentId: '',
    cycleId: '',
    name: '',
    code: '',
    durationYears: '3',
  },
  'academic-year': { name: '', startDate: '', endDate: '', isCurrent: true },
  semester: {
    programId: '',
    academicYearId: '',
    name: 'Semestre 1',
    number: '1',
    startDate: '',
    endDate: '',
  },
  course: {
    programId: '',
    semesterId: '',
    title: '',
    code: '',
    credits: '6',
    coefficient: '1',
  },
}

function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  hint,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
      >
        <option value="">{placeholder ?? '—'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-ink/45 mt-1 block text-xs">{hint}</span>}
    </label>
  )
}

export function StructureForm({
  entity,
  structure,
  onCreated,
  onError,
}: {
  entity: EntityKey
  structure: StructureData
  onCreated: (entity: EntityKey, created: any) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<Form>(DEFAULTS[entity])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Changer d'étape repart d'un formulaire vierge, pas des champs précédents.
  useEffect(() => {
    setForm(DEFAULTS[entity])
    setError('')
  }, [entity])

  const set = (k: string, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }))

  const facultyOptions = structure.faculties.map((f) => ({
    value: f.id,
    label: f.name,
  }))
  const cycleOptions = (structure.cycles ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }))
  const programOptions = structure.programs.map((p) => ({
    value: p.id,
    label: p.name,
  }))
  const yearOptions = structure.academicYears.map((y) => ({
    value: y.id,
    label: y.isCurrent ? `${y.name} · en cours` : y.name,
  }))

  const departmentOptions = useMemo(() => {
    const facultyId = String(form.facultyId ?? '')
    const faculty = structure.faculties.find((f) => f.id === facultyId)
    return (faculty?.departments ?? []).map((d) => ({
      value: d.id,
      label: d.name,
    }))
  }, [form.facultyId, structure.faculties])

  const semesterOptions = useMemo(() => {
    const programId = String(form.programId ?? '')
    return structure.semesters
      .filter((s) => s.programId === programId)
      .map((s) => ({ value: s.id, label: s.name }))
  }, [form.programId, structure.semesters])

  const submit = async () => {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/structure/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Création impossible')

      onCreated(entity, data)
      setForm(DEFAULTS[entity])
    } catch (err: any) {
      const message = err.message || 'Création impossible'
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {entity === 'faculty' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Nom de la faculté"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Faculté des Sciences Économiques"
          />
          <Input
            label="Code court"
            value={String(form.code)}
            onChange={(e) => set('code', e.target.value)}
            placeholder="FSEG"
          />
        </div>
      )}

      {entity === 'department' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Faculté"
            value={String(form.facultyId)}
            options={facultyOptions}
            onChange={(v) => set('facultyId', v)}
            placeholder="Choisir une faculté"
          />
          <Input
            label="Nom du département"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Département de Gestion"
          />
          <Input
            label="Code court"
            value={String(form.code)}
            onChange={(e) => set('code', e.target.value)}
            placeholder="GESTION"
          />
        </div>
      )}

      {entity === 'cycle' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Niveau LMD"
            value={String(form.level)}
            options={[
              { value: 'LICENCE', label: 'Licence' },
              { value: 'MASTER', label: 'Master' },
              { value: 'DOCTORAT', label: 'Doctorat' },
            ]}
            onChange={(v) => set('level', v)}
          />
          <Input
            label="Nom"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Code court"
            value={String(form.code)}
            onChange={(e) => set('code', e.target.value)}
          />
          <Input
            label="Durée (années)"
            type="number"
            value={String(form.durationYears)}
            onChange={(e) => set('durationYears', e.target.value)}
          />
          <Input
            label="Crédits totaux"
            type="number"
            value={String(form.totalCredits)}
            onChange={(e) => set('totalCredits', e.target.value)}
          />
        </div>
      )}

      {entity === 'program' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Faculté"
            value={String(form.facultyId)}
            options={facultyOptions}
            onChange={(v) => {
              set('facultyId', v)
              set('departmentId', '')
            }}
            placeholder="Choisir une faculté"
          />
          <Select
            label="Département"
            value={String(form.departmentId)}
            options={departmentOptions}
            onChange={(v) => set('departmentId', v)}
            placeholder="Aucun"
            hint="Facultatif"
          />
          <Select
            label="Cycle"
            value={String(form.cycleId)}
            options={cycleOptions}
            onChange={(v) => set('cycleId', v)}
            placeholder="Choisir un cycle"
          />
          <Input
            label="Nom du programme"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Licence Gestion des Entreprises"
          />
          <Input
            label="Code court"
            value={String(form.code)}
            onChange={(e) => set('code', e.target.value)}
            placeholder="LGE"
          />
          <Input
            label="Durée (années)"
            type="number"
            value={String(form.durationYears)}
            onChange={(e) => set('durationYears', e.target.value)}
          />
        </div>
      )}

      {entity === 'academic-year' && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Nom"
              value={String(form.name)}
              onChange={(e) => set('name', e.target.value)}
              placeholder="2025-2026"
            />
            <Input
              label="Début"
              type="date"
              value={String(form.startDate)}
              onChange={(e) => set('startDate', e.target.value)}
            />
            <Input
              label="Fin"
              type="date"
              value={String(form.endDate)}
              onChange={(e) => set('endDate', e.target.value)}
            />
          </div>
          <label className="text-ink/70 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={Boolean(form.isCurrent)}
              onChange={(e) => set('isCurrent', e.target.checked)}
              className="h-4 w-4 rounded border-hairline text-oca focus:ring-apple/30"
            />
            C’est l’année en cours (les autres cesseront de l’être)
          </label>
        </>
      )}

      {entity === 'semester' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Programme"
            value={String(form.programId)}
            options={programOptions}
            onChange={(v) => set('programId', v)}
            placeholder="Choisir un programme"
          />
          <Select
            label="Année universitaire"
            value={String(form.academicYearId)}
            options={yearOptions}
            onChange={(v) => set('academicYearId', v)}
            placeholder="Choisir une année"
          />
          <Input
            label="Nom"
            value={String(form.name)}
            onChange={(e) => set('name', e.target.value)}
          />
          <Input
            label="Numéro"
            type="number"
            value={String(form.number)}
            onChange={(e) => set('number', e.target.value)}
          />
          <Input
            label="Début"
            type="date"
            value={String(form.startDate)}
            onChange={(e) => set('startDate', e.target.value)}
          />
          <Input
            label="Fin"
            type="date"
            value={String(form.endDate)}
            onChange={(e) => set('endDate', e.target.value)}
          />
        </div>
      )}

      {entity === 'course' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            label="Programme"
            value={String(form.programId)}
            options={programOptions}
            onChange={(v) => {
              set('programId', v)
              set('semesterId', '')
            }}
            placeholder="Choisir un programme"
          />
          <Select
            label="Semestre"
            value={String(form.semesterId)}
            options={semesterOptions}
            onChange={(v) => set('semesterId', v)}
            placeholder="Choisir un semestre"
            hint={
              String(form.programId)
                ? undefined
                : 'Choisissez d’abord un programme'
            }
          />
          <Input
            label="Titre du cours"
            value={String(form.title)}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Comptabilité générale"
          />
          <Input
            label="Code court"
            value={String(form.code)}
            onChange={(e) => set('code', e.target.value)}
            placeholder="COMPTA-101"
          />
          <Input
            label="Crédits"
            type="number"
            value={String(form.credits)}
            onChange={(e) => set('credits', e.target.value)}
          />
          <Input
            label="Coefficient"
            type="number"
            value={String(form.coefficient)}
            onChange={(e) => set('coefficient', e.target.value)}
          />
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <Button onClick={submit} loading={loading}>
        Créer {entityMeta(entity).label.toLocaleLowerCase('fr')}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------- correction ------ */

/** Champs corrigeables par entité, et leur nature. */
type FieldSpec = {
  key: string
  label: string
  kind: 'text' | 'number' | 'date' | 'textarea' | 'select'
  options?: (structure: StructureData) => { value: string; label: string }[]
  hint?: string
}

const EDITABLE: Record<EntityKey, FieldSpec[]> = {
  faculty: [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'code', label: 'Code court', kind: 'text' },
  ],
  department: [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'code', label: 'Code court', kind: 'text' },
    {
      key: 'facultyId',
      label: 'Faculté',
      kind: 'select',
      options: (s) => s.faculties.map((f) => ({ value: f.id, label: f.name })),
    },
  ],
  cycle: [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'code', label: 'Code court', kind: 'text' },
    {
      key: 'level',
      label: 'Niveau LMD',
      kind: 'select',
      options: () => [
        { value: 'LICENCE', label: 'Licence' },
        { value: 'MASTER', label: 'Master' },
        { value: 'DOCTORAT', label: 'Doctorat' },
      ],
    },
    { key: 'durationYears', label: 'Durée (années)', kind: 'number' },
    { key: 'totalCredits', label: 'Crédits totaux', kind: 'number' },
  ],
  program: [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'code', label: 'Code court', kind: 'text' },
    { key: 'durationYears', label: 'Durée (années)', kind: 'number' },
    {
      key: 'cycleId',
      label: 'Cycle',
      kind: 'select',
      options: (s) =>
        (s.cycles ?? []).map((c) => ({ value: c.id, label: c.name })),
    },
    {
      key: 'departmentId',
      label: 'Département',
      kind: 'select',
      hint: 'Facultatif',
      options: (s) =>
        s.faculties.flatMap((f) =>
          f.departments.map((d) => ({
            value: d.id,
            label: `${d.name} · ${f.name}`,
          }))
        ),
    },
  ],
  'academic-year': [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'startDate', label: 'Début', kind: 'date' },
    { key: 'endDate', label: 'Fin', kind: 'date' },
  ],
  semester: [
    { key: 'name', label: 'Nom', kind: 'text' },
    { key: 'number', label: 'Numéro', kind: 'number' },
    { key: 'startDate', label: 'Début', kind: 'date' },
    { key: 'endDate', label: 'Fin', kind: 'date' },
    {
      key: 'academicYearId',
      label: 'Année universitaire',
      kind: 'select',
      options: (s) =>
        s.academicYears.map((y) => ({
          value: y.id,
          label: y.isCurrent ? `${y.name} · en cours` : y.name,
        })),
    },
  ],
  course: [
    { key: 'title', label: 'Titre', kind: 'text' },
    { key: 'code', label: 'Code court', kind: 'text' },
    { key: 'credits', label: 'Crédits', kind: 'number' },
    { key: 'coefficient', label: 'Coefficient', kind: 'number' },
    { key: 'description', label: 'Description', kind: 'textarea' },
  ],
}

/** Le rattachement structurant n'est pas corrigeable : on dit pourquoi. */
const FROZEN: Partial<Record<EntityKey, string>> = {
  semester:
    'Le programme d’un semestre n’est pas modifiable : ses cours et les inscriptions des étudiants y sont rattachés.',
  course:
    'Le programme et le semestre d’un cours ne sont pas modifiables : ils déterminent quels étudiants y ont accès.',
}

export function frozenNotice(entity: EntityKey): string | undefined {
  return FROZEN[entity]
}

/** Une date ISO du serveur vers la valeur attendue par un champ `date`. */
const asDateInput = (value: unknown) =>
  typeof value === 'string' && value ? value.slice(0, 10) : ''

export function StructureEditForm({
  entity,
  record,
  structure,
  onSaved,
  onCancel,
  onError,
}: {
  entity: EntityKey
  record: Record<string, any>
  structure: StructureData
  onSaved: (updated: any, fields: string[]) => void
  onCancel: () => void
  onError: (message: string) => void
}) {
  const specs = EDITABLE[entity]

  const initial = useMemo(() => {
    const values: Record<string, string> = {}
    for (const spec of specs) {
      const raw = record[spec.key]
      values[spec.key] =
        spec.kind === 'date'
          ? asDateInput(raw)
          : raw === null || raw === undefined
          ? ''
          : String(raw)
    }
    return values
  }, [record, specs])

  const [form, setForm] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(initial)
    setError('')
  }, [initial])

  // Seuls les champs réellement touchés partent au serveur.
  const changed = specs
    .map((spec) => spec.key)
    .filter((key) => form[key] !== initial[key])

  const submit = async () => {
    if (changed.length === 0) return
    setLoading(true)
    setError('')

    const payload: Record<string, unknown> = {}
    for (const key of changed) payload[key] = form[key]

    try {
      const res = await fetch(`/api/admin/structure/${entity}/${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Modification impossible')

      onSaved(data, changed)
    } catch (err: any) {
      const message = err.message || 'Modification impossible'
      setError(message)
      onError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 rounded-card border border-apple/30 bg-oca-tint/30 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-medium text-ink">
          Modifier · {entityMeta(entity).label}
        </p>
        <button
          onClick={onCancel}
          className="text-ink/50 text-sm font-medium hover:underline"
        >
          Annuler
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specs.map((spec) =>
          spec.kind === 'select' ? (
            <Select
              key={spec.key}
              label={spec.label}
              value={form[spec.key] ?? ''}
              options={spec.options ? spec.options(structure) : []}
              onChange={(v) => setForm((c) => ({ ...c, [spec.key]: v }))}
              placeholder={spec.hint ? 'Aucun' : '—'}
              hint={spec.hint}
            />
          ) : spec.kind === 'textarea' ? (
            <label key={spec.key} className="block sm:col-span-2 lg:col-span-3">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                {spec.label}
              </span>
              <textarea
                value={form[spec.key] ?? ''}
                rows={3}
                onChange={(e) =>
                  setForm((c) => ({ ...c, [spec.key]: e.target.value }))
                }
                className="w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] leading-relaxed text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
              />
            </label>
          ) : (
            <Input
              key={spec.key}
              label={spec.label}
              type={spec.kind === 'text' ? 'text' : spec.kind}
              value={form[spec.key] ?? ''}
              onChange={(e) =>
                setForm((c) => ({ ...c, [spec.key]: e.target.value }))
              }
            />
          )
        )}
      </div>

      {FROZEN[entity] && (
        <p className="text-ink/45 mt-4 text-sm">{FROZEN[entity]}</p>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button loading={loading} disabled={changed.length === 0} onClick={submit}>
          Enregistrer
        </Button>
        <span className="text-ink/45 text-sm">
          {changed.length === 0
            ? 'Aucune modification'
            : `${changed.length} champ(s) modifié(s)`}
        </span>
      </div>
    </div>
  )
}
