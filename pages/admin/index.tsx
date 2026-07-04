import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/app/AppShell';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { Reveal } from '../../components/anim/Reveal';
import { Drawer } from '../../components/overlay/Drawer';
import { useToast } from '../../components/overlay/Toast';
import { useRegisterCommands } from '../../components/overlay/command';
import { useCurrentUser } from '../../lib/auth';
import {
  PlusIcon,
  UsersIcon,
  ClipboardIcon,
  LayersIcon,
  CheckIcon,
  ChevronRightIcon,
  CapIcon,
  MessageIcon,
} from '../../components/ui/icons';

const FACULTIES = ['Économie', 'Droit', 'Informatique'];
const PROGRAMS = ['Licence', 'Master'];
const SEMESTERS = ['Semestre 1', 'Semestre 2'];
const COURSES = ['Finance d’entreprise', 'Comptabilité générale', 'Microéconomie', 'Statistiques appliquées'];

const attention = [
  { icon: ClipboardIcon, label: '2 dossiers à valider', hint: 'Inscriptions en attente', tone: 'warning' as const },
  { icon: LayersIcon, label: '1 programme incomplet', hint: 'Licence Droit — 2 cours manquants', tone: 'brand' as const },
  { icon: MessageIcon, label: '3 messages étudiants', hint: 'Sans réponse depuis 2 jours', tone: 'neutral' as const },
];

const validations = [
  { name: 'Ibrahim Touré', detail: 'Master Économie · dossier complet' },
  { name: 'Fatou Ndiaye', detail: 'Licence Droit · pièce manquante' },
];

const programs = [
  { name: 'Licence Économie', complete: 100 },
  { name: 'Master Data', complete: 80 },
  { name: 'Licence Droit', complete: 60 },
];

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 10 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

export default function AdminWorkspace() {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [students, setStudents] = useState<any[]>([]);
  const [drawer, setDrawer] = useState(false);

  const fetchStudents = () => {
    fetch('/api/students/list')
      .then((r) => r.json())
      .then((d) => setStudents(Array.isArray(d) ? d : []))
      .catch(() => setStudents([]));
  };
  useEffect(fetchStudents, []);

  useRegisterCommands(
    'admin:actions',
    [
      {
        id: 'admin:new-student',
        label: 'Inscrire un étudiant',
        hint: 'Nouveau',
        group: 'Actions',
        icon: <PlusIcon size={17} />,
        perform: () => setDrawer(true),
      },
      {
        id: 'admin:new-program',
        label: 'Créer un programme',
        group: 'Actions',
        icon: <LayersIcon size={17} />,
        perform: () => toast({ title: 'Bientôt disponible', description: 'La création de programme arrive.', tone: 'info' }),
      },
    ],
    []
  );

  const recent = useMemo(() => students.slice(-5).reverse(), [students]);

  return (
    <AppShell
      role="admin"
      requiredRole="admin"
      title="Pilotage"
      subtitle="Votre campus aujourd’hui"
      action={
        <button onClick={() => setDrawer(true)} className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}>
          <PlusIcon size={18} /> Inscrire un étudiant
        </button>
      }
    >
      {/* ATTENTION BAND */}
      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {attention.map((a) => (
            <button
              key={a.label}
              onClick={() => toast({ title: a.label, description: a.hint, tone: 'info' })}
              className="group flex items-center gap-3 rounded-hero border border-hairline bg-white p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cloud text-ink/60 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                <a.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{a.label}</span>
                <span className="block truncate text-sm text-ink/45">{a.hint}</span>
              </span>
              <ChevronRightIcon size={16} className="text-ink/30 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* main */}
        <div className="space-y-5 lg:col-span-2">
          <Reveal delay={60}>
            <Card>
              <CardHeader title="À valider aujourd’hui" action={<Badge tone="warning">{validations.length}</Badge>} />
              <ul className="space-y-2">
                {validations.map((v) => (
                  <li key={v.name} className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
                    <Avatar name={v.name} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{v.name}</p>
                      <p className="truncate text-sm text-ink/45">{v.detail}</p>
                    </div>
                    <button
                      onClick={() => toast({ title: 'Dossier validé', description: v.name, tone: 'success' })}
                      className="flex h-9 items-center gap-1.5 rounded-full bg-oca-tint px-3.5 text-sm font-medium text-oca transition-colors hover:bg-oca hover:text-white"
                    >
                      <CheckIcon size={16} /> Valider
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>

          <Reveal delay={110}>
            <Card>
              <CardHeader
                title="Derniers inscrits"
                action={
                  <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-1 text-sm font-medium text-apple hover:underline">
                    Inscrire <PlusIcon size={15} />
                  </button>
                }
              />
              {recent.length === 0 ? (
                <EmptyState
                  icon={<UsersIcon size={22} />}
                  title="Aucun étudiant pour le moment"
                  description="Inscrivez votre premier étudiant — cela prend quelques secondes."
                  action={
                    <button onClick={() => setDrawer(true)} className={buttonClasses('primary', 'md')}>
                      <PlusIcon size={17} /> Inscrire un étudiant
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-1">
                  {recent.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
                      <Avatar name={`${s.firstName} ${s.lastName}`} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">
                          {s.firstName} {s.lastName}
                        </p>
                        <p className="truncate text-sm text-ink/45">{s.email}</p>
                      </div>
                      <div className="hidden items-center gap-2 sm:flex">
                        <Badge tone="brand">{s.faculty}</Badge>
                        <Badge tone="neutral">{s.program}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>
        </div>

        {/* aside */}
        <div className="space-y-5">
          <Reveal delay={80}>
            <Card>
              <CardHeader title="Actions rapides" />
              <div className="space-y-2">
                <QuickAction icon={<PlusIcon size={18} />} label="Inscrire un étudiant" hint="⌘K" onClick={() => setDrawer(true)} primary />
                <QuickAction icon={<LayersIcon size={18} />} label="Créer un programme" onClick={() => toast({ title: 'Bientôt disponible', tone: 'info' })} />
                <QuickAction icon={<UsersIcon size={18} />} label="Importer une cohorte" onClick={() => toast({ title: 'Bientôt disponible', tone: 'info' })} />
              </div>
            </Card>
          </Reveal>

          <Reveal delay={130}>
            <Card>
              <CardHeader title="Programmes" />
              <ul className="space-y-4">
                {programs.map((p) => (
                  <li key={p.name}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="font-medium text-ink">{p.name}</span>
                      <span className={p.complete < 100 ? 'text-amber-600' : 'text-emerald-600'}>
                        {p.complete < 100 ? 'À compléter' : 'Complet'}
                      </span>
                    </div>
                    <ProgressBar value={p.complete} />
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>
      </div>

      <CreateStudentDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        universityId={user?.universityId}
        onCreated={(s) => {
          setStudents((prev) => [...prev, s]);
          toast({ title: 'Étudiant inscrit', description: `${s.firstName} ${s.lastName}`, tone: 'success' });
        }}
        onError={() => toast({ title: 'Échec de l’inscription', description: 'Veuillez réessayer.', tone: 'error' })}
      />
    </AppShell>
  );
}

function QuickAction({
  icon,
  label,
  hint,
  onClick,
  primary,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        'group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all duration-300 ' +
        (primary
          ? 'border-oca-tint bg-oca-tint text-oca hover:bg-oca hover:text-white'
          : 'border-hairline bg-white text-ink/70 hover:border-ink/10 hover:bg-cloud')
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {hint && <span className="text-xs opacity-50">{hint}</span>}
    </button>
  );
}

function CreateStudentDrawer({
  open,
  onClose,
  universityId,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  universityId?: string;
  onCreated: (s: any) => void;
  onError: () => void;
}) {
  const empty = {
    firstName: '',
    lastName: '',
    email: '',
    faculty: FACULTIES[0],
    program: PROGRAMS[0],
    semester: SEMESTERS[0],
    courses: [] as string[],
    password: generatePassword(),
  };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const toggleCourse = (c: string) =>
    setForm((p) => ({ ...p, courses: p.courses.includes(c) ? p.courses.filter((x) => x !== c) : [...p.courses, c] }));

  const submit = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      onError();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/students/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, universityId }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json().catch(() => ({ ...form, id: Date.now().toString() }));
      onCreated(created && created.id ? created : { ...form, id: Date.now().toString() });
      setForm({ ...empty, password: generatePassword() });
      onClose();
    } catch {
      onError();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Inscrire un étudiant"
      description="Le compte est créé instantanément"
      icon={<CapIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className={buttonClasses('secondary', 'md')}>
            Annuler
          </button>
          <Button onClick={submit} loading={loading}>
            Créer le compte
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Awa" />
          <Input label="Nom" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Diallo" />
        </div>
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="awa.diallo@universite.africa"
        />

        <div className="grid grid-cols-3 gap-3">
          <SelectField label="Faculté" value={form.faculty} options={FACULTIES} onChange={(v) => set('faculty', v)} />
          <SelectField label="Programme" value={form.program} options={PROGRAMS} onChange={(v) => set('program', v)} />
          <SelectField label="Semestre" value={form.semester} options={SEMESTERS} onChange={(v) => set('semester', v)} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-ink/70">Cours</p>
          <div className="grid grid-cols-1 gap-2">
            {COURSES.map((c) => {
              const on = form.courses.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCourse(c)}
                  className={
                    'flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors ' +
                    (on ? 'border-oca-tint bg-oca-tint text-oca' : 'border-hairline bg-white text-ink/70 hover:bg-cloud')
                  }
                >
                  <span className={'grid h-5 w-5 place-items-center rounded-md border ' + (on ? 'border-oca bg-oca text-white' : 'border-hairline')}>
                    {on && <CheckIcon size={13} />}
                  </span>
                  {c}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-hairline bg-cloud/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink/70">Mot de passe généré</p>
              <p className="mt-0.5 font-mono text-[15px] text-ink">{form.password}</p>
            </div>
            <button
              type="button"
              onClick={() => set('password', generatePassword())}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-oca shadow-soft transition-colors hover:bg-oca-tint"
            >
              Régénérer
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink/70">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
