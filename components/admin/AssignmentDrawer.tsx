import { useMemo, useState } from 'react';
import { Drawer } from '../overlay/Drawer';
import { Button, buttonClasses } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';
import { UsersIcon, BookIcon } from '../ui/icons';
import type { StructureData } from './StructureDrawer';

/**
 * Affectation des enseignants aux cours.
 * Le tiroir permet aussi de créer un compte enseignant : sans cela, un
 * établissement neuf n'aurait aucun PROFESSOR à affecter.
 */

export interface Teacher {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  assignmentCount: number;
}

export interface Assignment {
  id: string;
  role: 'LEAD' | 'CO_TEACHER' | 'ASSISTANT';
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

const ROLE_OPTIONS = [
  { value: 'LEAD', label: 'Responsable' },
  { value: 'CO_TEACHER', label: 'Co-enseignant' },
  { value: 'ASSISTANT', label: 'Assistant' },
];

const ROLE_LABELS: Record<string, string> = {
  LEAD: 'Responsable',
  CO_TEACHER: 'Co-enseignant',
  ASSISTANT: 'Assistant',
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

function fullName(u: { firstName: string | null; lastName: string | null; email: string }) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

export function AssignmentDrawer({
  open,
  onClose,
  structure,
  teachers,
  assignments,
  onChanged,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  structure: StructureData;
  teachers: Teacher[];
  assignments: Assignment[];
  onChanged: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [userId, setUserId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [role, setRole] = useState('LEAD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [showNewTeacher, setShowNewTeacher] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const teacherOptions = teachers.map((t) => ({
    value: t.id,
    label: `${[t.firstName, t.lastName].filter(Boolean).join(' ') || t.email} · ${t.assignmentCount} cours`,
  }));

  const courseOptions = useMemo(() => {
    return structure.courses.map((c) => {
      const semester = structure.semesters.find((s) => s.id === c.semesterId);
      const program = structure.programs.find((p) => p.id === (semester?.programId ?? ''));
      const context = [program?.code, semester?.name].filter(Boolean).join(' · ');
      return { value: c.id, label: context ? `${c.title} (${c.code}) — ${context}` : `${c.title} (${c.code})` };
    });
  }, [structure]);

  const assign = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, courseId, role }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Affectation impossible');

      setCourseId('');
      onChanged(`${fullName(data.user)} → ${data.course.code}`);
    } catch (err: any) {
      setError(err.message || 'Affectation impossible');
      onError(err.message || 'Affectation impossible');
    } finally {
      setLoading(false);
    }
  };

  const createTeacher = async () => {
    setCreatingTeacher(true);
    setError('');

    try {
      const res = await fetch('/api/admin/teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTeacher),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Création impossible');

      setNewTeacher({ firstName: '', lastName: '', email: '', password: '' });
      setShowNewTeacher(false);
      setUserId(data.id);
      onChanged(`Enseignant créé : ${data.email}`);
    } catch (err: any) {
      setError(err.message || 'Création impossible');
      onError(err.message || 'Création impossible');
    } finally {
      setCreatingTeacher(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Affecter les enseignants"
      description="Rattachez un enseignant à un cours de votre établissement"
      icon={<UsersIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className={buttonClasses('secondary', 'md')}>
            Fermer
          </button>
          <Button onClick={assign} loading={loading} disabled={!userId || !courseId}>
            Affecter
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select
          label="Enseignant"
          value={userId}
          options={teacherOptions}
          onChange={setUserId}
          placeholder={teachers.length === 0 ? 'Aucun enseignant enregistré' : 'Choisir un enseignant'}
        />

        <button
          type="button"
          onClick={() => setShowNewTeacher((v) => !v)}
          className="text-sm font-medium text-apple hover:underline"
        >
          {showNewTeacher ? 'Annuler la création' : '+ Créer un compte enseignant'}
        </button>

        {showNewTeacher && (
          <div className="space-y-3 rounded-xl border border-hairline bg-cloud/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prénom"
                value={newTeacher.firstName}
                onChange={(e) => setNewTeacher((p) => ({ ...p, firstName: e.target.value }))}
              />
              <Input
                label="Nom"
                value={newTeacher.lastName}
                onChange={(e) => setNewTeacher((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={newTeacher.email}
              onChange={(e) => setNewTeacher((p) => ({ ...p, email: e.target.value }))}
            />
            <Input
              label="Mot de passe provisoire"
              value={newTeacher.password}
              onChange={(e) => setNewTeacher((p) => ({ ...p, password: e.target.value }))}
              hint="8 caractères minimum"
            />
            <Button onClick={createTeacher} loading={creatingTeacher} size="md">
              Créer l’enseignant
            </Button>
          </div>
        )}

        <Select
          label="Cours"
          value={courseId}
          options={courseOptions}
          onChange={setCourseId}
          placeholder={structure.courses.length === 0 ? 'Aucun cours créé' : 'Choisir un cours'}
        />

        <Select label="Rôle" value={role} options={ROLE_OPTIONS} onChange={setRole} placeholder="Responsable" />

        {error && (
          <div role="alert" className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Affectations actuelles</p>
          {assignments.length === 0 ? (
            <EmptyState
              icon={<BookIcon size={22} />}
              title="Aucune affectation"
              description="Aucun cours n’a encore d’enseignant rattaché."
            />
          ) : (
            <ul className="space-y-1">
              {assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
                  <Avatar name={fullName(a.user)} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{fullName(a.user)}</p>
                    <p className="truncate text-sm text-ink/45">
                      {a.course.title} · {a.course.code} · {a.course.semester.name}
                    </p>
                  </div>
                  <Badge tone={a.role === 'LEAD' ? 'brand' : 'neutral'}>{ROLE_LABELS[a.role]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Drawer>
  );
}
