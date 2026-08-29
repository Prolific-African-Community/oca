import { useMemo, useState } from 'react';
import { Drawer } from '../overlay/Drawer';
import { Button, buttonClasses } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { LayersIcon } from '../ui/icons';

/**
 * Création de la structure académique d'un établissement.
 * Un seul tiroir, un sélecteur de type, et les champs correspondants —
 * volontairement sobre : l'objectif est de rendre un établissement utilisable,
 * pas de livrer un back-office complet.
 */

export interface StructureData {
  institution: { id: string; name: string; slug: string } | null;
  faculties: { id: string; name: string; code: string; departments: { id: string; name: string }[] }[];
  programs: { id: string; name: string; code: string; facultyId: string; status: string }[];
  cycles?: { id: string; name: string; code: string; level: string }[];
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

type EntityKey =
  | 'faculty'
  | 'department'
  | 'cycle'
  | 'program'
  | 'academic-year'
  | 'semester'
  | 'course';

const ENTITY_LABELS: { key: EntityKey; label: string }[] = [
  { key: 'faculty', label: '1 · Faculté' },
  { key: 'department', label: '2 · Département' },
  { key: 'cycle', label: '3 · Cycle' },
  { key: 'program', label: '4 · Programme' },
  { key: 'academic-year', label: '5 · Année universitaire' },
  { key: 'semester', label: '6 · Semestre' },
  { key: 'course', label: '7 · Cours' },
];

type Form = Record<string, string | boolean>;

const DEFAULTS: Record<EntityKey, Form> = {
  faculty: { name: '', code: '' },
  department: { facultyId: '', name: '', code: '' },
  cycle: { level: 'LICENCE', name: 'Licence', code: 'L', durationYears: '3', totalCredits: '180' },
  program: { facultyId: '', departmentId: '', cycleId: '', name: '', code: '', durationYears: '3' },
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
};

function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
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
    </label>
  );
}

export function StructureDrawer({
  open,
  onClose,
  structure,
  onCreated,
  onError,
  initialEntity,
}: {
  open: boolean;
  onClose: () => void;
  structure: StructureData;
  onCreated: (entity: EntityKey, created: any) => void;
  onError: (message: string) => void;
  initialEntity?: EntityKey;
}) {
  const [entity, setEntity] = useState<EntityKey>(initialEntity ?? 'faculty');
  const [form, setForm] = useState<Form>(DEFAULTS[entity]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string | boolean) => setForm((p) => ({ ...p, [k]: v }));

  const switchEntity = (key: EntityKey) => {
    setEntity(key);
    setForm(DEFAULTS[key]);
    setError('');
  };

  const facultyOptions = structure.faculties.map((f) => ({ value: f.id, label: f.name }));
  const cycleOptions = (structure.cycles ?? []).map((c) => ({
    value: c.id,
    label: `${c.name} (${c.code})`,
  }));
  const programOptions = structure.programs.map((p) => ({ value: p.id, label: p.name }));
  const yearOptions = structure.academicYears.map((y) => ({
    value: y.id,
    label: y.isCurrent ? `${y.name} · en cours` : y.name,
  }));

  const departmentOptions = useMemo(() => {
    const facultyId = String(form.facultyId ?? '');
    const faculty = structure.faculties.find((f) => f.id === facultyId);
    return (faculty?.departments ?? []).map((d) => ({ value: d.id, label: d.name }));
  }, [form.facultyId, structure.faculties]);

  const semesterOptions = useMemo(() => {
    const programId = String(form.programId ?? '');
    return structure.semesters
      .filter((s) => s.programId === programId)
      .map((s) => ({ value: s.id, label: s.name }));
  }, [form.programId, structure.semesters]);

  const submit = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/structure/${entity}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Création impossible');
      }

      onCreated(entity, data);
      setForm(DEFAULTS[entity]);
    } catch (err: any) {
      const message = err.message || 'Création impossible';
      setError(message);
      onError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Structure académique"
      description="Créez la maquette avant d’inscrire des étudiants"
      icon={<LayersIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className={buttonClasses('secondary', 'md')}>
            Fermer
          </button>
          <Button onClick={submit} loading={loading}>
            Créer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {ENTITY_LABELS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => switchEntity(e.key)}
              className={
                'rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ' +
                (entity === e.key
                  ? 'border-oca bg-oca text-white'
                  : 'border-hairline bg-white text-ink/65 hover:bg-cloud')
              }
            >
              {e.label}
            </button>
          ))}
        </div>

        {entity === 'faculty' && (
          <>
            <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} placeholder="Faculté des Sciences Économiques" />
            <Input label="Code" value={String(form.code)} onChange={(e) => set('code', e.target.value)} placeholder="FSEG" />
          </>
        )}

        {entity === 'department' && (
          <>
            <Select label="Faculté" value={String(form.facultyId)} options={facultyOptions} onChange={(v) => set('facultyId', v)} placeholder="Choisir une faculté" />
            <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} placeholder="Département de Gestion" />
            <Input label="Code" value={String(form.code)} onChange={(e) => set('code', e.target.value)} placeholder="GESTION" />
          </>
        )}

        {entity === 'cycle' && (
          <>
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
            <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} />
            <Input label="Code" value={String(form.code)} onChange={(e) => set('code', e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Durée (années)" type="number" value={String(form.durationYears)} onChange={(e) => set('durationYears', e.target.value)} />
              <Input label="Crédits totaux" type="number" value={String(form.totalCredits)} onChange={(e) => set('totalCredits', e.target.value)} />
            </div>
          </>
        )}

        {entity === 'program' && (
          <>
            <Select label="Faculté" value={String(form.facultyId)} options={facultyOptions} onChange={(v) => { set('facultyId', v); set('departmentId', ''); }} placeholder="Choisir une faculté" />
            <Select label="Département (optionnel)" value={String(form.departmentId)} options={departmentOptions} onChange={(v) => set('departmentId', v)} placeholder="Aucun" />
            <Select label="Cycle" value={String(form.cycleId)} options={cycleOptions} onChange={(v) => set('cycleId', v)} placeholder="Choisir un cycle" />
            <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} placeholder="Licence Gestion des Entreprises" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Code" value={String(form.code)} onChange={(e) => set('code', e.target.value)} placeholder="LGE" />
              <Input label="Durée (années)" type="number" value={String(form.durationYears)} onChange={(e) => set('durationYears', e.target.value)} />
            </div>
          </>
        )}

        {entity === 'academic-year' && (
          <>
            <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} placeholder="2025-2026" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Début" type="date" value={String(form.startDate)} onChange={(e) => set('startDate', e.target.value)} />
              <Input label="Fin" type="date" value={String(form.endDate)} onChange={(e) => set('endDate', e.target.value)} />
            </div>
            <label className="flex items-center gap-3 text-sm text-ink/70">
              <input
                type="checkbox"
                checked={Boolean(form.isCurrent)}
                onChange={(e) => set('isCurrent', e.target.checked)}
                className="h-4 w-4 rounded border-hairline text-oca focus:ring-apple/30"
              />
              Année en cours (les autres seront basculées)
            </label>
          </>
        )}

        {entity === 'semester' && (
          <>
            <Select label="Programme" value={String(form.programId)} options={programOptions} onChange={(v) => set('programId', v)} placeholder="Choisir un programme" />
            <Select label="Année universitaire" value={String(form.academicYearId)} options={yearOptions} onChange={(v) => set('academicYearId', v)} placeholder="Choisir une année" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nom" value={String(form.name)} onChange={(e) => set('name', e.target.value)} />
              <Input label="Numéro" type="number" value={String(form.number)} onChange={(e) => set('number', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Début" type="date" value={String(form.startDate)} onChange={(e) => set('startDate', e.target.value)} />
              <Input label="Fin" type="date" value={String(form.endDate)} onChange={(e) => set('endDate', e.target.value)} />
            </div>
          </>
        )}

        {entity === 'course' && (
          <>
            <Select label="Programme" value={String(form.programId)} options={programOptions} onChange={(v) => { set('programId', v); set('semesterId', ''); }} placeholder="Choisir un programme" />
            <Select label="Semestre" value={String(form.semesterId)} options={semesterOptions} onChange={(v) => set('semesterId', v)} placeholder="Choisir un semestre" />
            <Input label="Titre" value={String(form.title)} onChange={(e) => set('title', e.target.value)} placeholder="Comptabilité générale" />
            <div className="grid grid-cols-3 gap-3">
              <Input label="Code" value={String(form.code)} onChange={(e) => set('code', e.target.value)} placeholder="COMPTA-101" />
              <Input label="Crédits" type="number" value={String(form.credits)} onChange={(e) => set('credits', e.target.value)} />
              <Input label="Coefficient" type="number" value={String(form.coefficient)} onChange={(e) => set('coefficient', e.target.value)} />
            </div>
          </>
        )}

        {error && (
          <div role="alert" className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-hairline bg-cloud/60 p-4">
          <p className="mb-2 text-sm font-medium text-ink/70">Structure actuelle</p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{structure.faculties.length} facultés</Badge>
            <Badge tone="neutral">{(structure.cycles ?? []).length} cycles</Badge>
            <Badge tone="neutral">{structure.programs.length} programmes</Badge>
            <Badge tone="neutral">{structure.academicYears.length} années</Badge>
            <Badge tone="neutral">{structure.semesters.length} semestres</Badge>
            <Badge tone="neutral">{structure.courses.length} cours</Badge>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
