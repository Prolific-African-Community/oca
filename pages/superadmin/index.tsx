import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../components/app/AppShell';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { EmptyState } from '../../components/ui/EmptyState';
import { Reveal } from '../../components/anim/Reveal';
import { Drawer } from '../../components/overlay/Drawer';
import { useToast } from '../../components/overlay/Toast';
import { useRegisterCommands } from '../../components/overlay/command';
import {
  PlusIcon,
  BuildingIcon,
  ProgressIcon,
  BellIcon,
  CheckIcon,
  GlobeIcon,
  UsersIcon,
} from '../../components/ui/icons';

const PROGRAMS = ['Licence', 'Master'];
const COURSES = ['Finance d’entreprise', 'Comptabilité générale', 'Microéconomie', 'Data Analytics'];

const health = [
  { icon: BuildingIcon, label: '1 université inactive', hint: 'Aucune connexion depuis 14 j', tone: 'warning' as const },
  { icon: ProgressIcon, label: 'Activité en hausse', hint: '+18 % cette semaine', tone: 'success' as const },
  { icon: BellIcon, label: '2 alertes', hint: 'Quota étudiants bientôt atteint', tone: 'neutral' as const },
];

const netActivity = [
  { text: 'Université de Dakar — 42 inscriptions', when: 'Aujourd’hui' },
  { text: 'IUG Abidjan — nouveau programme Master', when: 'Hier' },
  { text: 'ISM — 1re session live diffusée', when: 'Il y a 3 j' },
];

export default function SuperAdminNetwork() {
  const { toast } = useToast();
  const [universities, setUniversities] = useState<any[]>([]);
  const [drawer, setDrawer] = useState(false);

  const fetchUniversities = () => {
    fetch('/api/universities/list')
      .then((r) => r.json())
      .then((d) => setUniversities(Array.isArray(d) ? d : []))
      .catch(() => setUniversities([]));
  };
  useEffect(fetchUniversities, []);

  useRegisterCommands(
    'super:actions',
    [
      {
        id: 'super:new-university',
        label: 'Ajouter une université',
        hint: 'Nouveau',
        group: 'Actions',
        icon: <PlusIcon size={17} />,
        perform: () => setDrawer(true),
      },
    ],
    []
  );

  const activeRate = useMemo(() => {
    if (universities.length === 0) return 100;
    const active = universities.filter((u) => u.status !== 'inactive').length;
    return Math.round((active / universities.length) * 100);
  }, [universities]);

  return (
    <AppShell
      role="superadmin"
      title="Réseau"
      subtitle="Santé et activité des établissements partenaires"
      action={
        <button onClick={() => setDrawer(true)} className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}>
          <PlusIcon size={18} /> Ajouter une université
        </button>
      }
    >
      {/* HEALTH BAND */}
      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {health.map((h) => (
            <button
              key={h.label}
              onClick={() => toast({ title: h.label, description: h.hint, tone: 'info' })}
              className="group flex items-center gap-3 rounded-hero border border-hairline bg-white p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cloud text-ink/60 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                <h.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{h.label}</span>
                <span className="block truncate text-sm text-ink/45">{h.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </Reveal>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* main */}
        <div className="space-y-5 lg:col-span-2">
          <Reveal delay={60}>
            <Card>
              <CardHeader
                title="Établissements"
                action={
                  <button onClick={() => setDrawer(true)} className="inline-flex items-center gap-1 text-sm font-medium text-apple hover:underline">
                    Ajouter <PlusIcon size={15} />
                  </button>
                }
              />
              {universities.length === 0 ? (
                <EmptyState
                  icon={<BuildingIcon size={22} />}
                  title="Aucune université partenaire"
                  description="Ajoutez le premier établissement pour lancer le réseau."
                  action={
                    <button onClick={() => setDrawer(true)} className={buttonClasses('primary', 'md')}>
                      <PlusIcon size={17} /> Ajouter une université
                    </button>
                  }
                />
              ) : (
                <ul className="space-y-1">
                  {universities.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-oca-tint text-oca">
                        <BuildingIcon size={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium text-ink">{u.name}</p>
                        <p className="truncate text-sm text-ink/45">{u.adminEmail}</p>
                      </div>
                      <Badge tone={u.status === 'inactive' ? 'warning' : 'success'} dot>
                        {u.status === 'inactive' ? 'Inactive' : 'Active'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={110}>
            <Card>
              <CardHeader title="Activité du réseau" />
              <ul className="space-y-4">
                {netActivity.map((a, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-oca-tint text-oca">
                      <GlobeIcon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[15px] font-medium text-ink">{a.text}</p>
                      <p className="text-sm text-ink/45">{a.when}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </Reveal>
        </div>

        {/* aside */}
        <div className="space-y-5">
          <Reveal delay={80}>
            <Card>
              <CardHeader title="Santé du réseau" />
              <div className="flex items-center gap-5">
                <ProgressRing value={activeRate} size={92} stroke={9} />
                <div>
                  <p className="text-2xl font-medium tracking-tightest text-ink">{universities.length}</p>
                  <p className="text-sm text-ink/45">{universities.length > 1 ? 'établissements' : 'établissement'}</p>
                  <Badge tone="success" className="mt-2">{activeRate}% actifs</Badge>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={130}>
            <Card>
              <CardHeader title="Actions rapides" />
              <div className="space-y-2">
                <button
                  onClick={() => setDrawer(true)}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-oca-tint bg-oca-tint px-3.5 py-3 text-left text-oca transition-colors hover:bg-oca hover:text-white"
                >
                  <PlusIcon size={18} />
                  <span className="flex-1 text-[15px] font-medium">Ajouter une université</span>
                  <span className="text-xs opacity-50">⌘K</span>
                </button>
                <button
                  onClick={() => toast({ title: 'Bientôt disponible', tone: 'info' })}
                  className="flex w-full items-center gap-3 rounded-2xl border border-hairline bg-white px-3.5 py-3 text-left text-ink/70 transition-colors hover:bg-cloud"
                >
                  <UsersIcon size={18} />
                  <span className="flex-1 text-[15px] font-medium">Inviter un administrateur</span>
                </button>
              </div>
            </Card>
          </Reveal>
        </div>
      </div>

      <CreateUniversityDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        onCreated={(u) => {
          setUniversities((prev) => [...prev, u]);
          toast({ title: 'Université ajoutée', description: u.name, tone: 'success' });
        }}
        onError={() => toast({ title: 'Échec de la création', description: 'Veuillez réessayer.', tone: 'error' })}
      />
    </AppShell>
  );
}

function CreateUniversityDrawer({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (u: any) => void;
  onError: () => void;
}) {
  const empty = { name: '', adminEmail: '', adminPassword: '', programs: [] as string[], courses: [] as string[] };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));
  const toggle = (field: 'programs' | 'courses', v: string) =>
    setForm((p) => ({ ...p, [field]: p[field].includes(v) ? p[field].filter((x) => x !== v) : [...p[field], v] }));

  const submit = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      onError();
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/universities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const created = await res.json().catch(() => null);
      onCreated(created && created.id ? created : { ...form, id: Date.now().toString(), status: 'active' });
      setForm(empty);
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
      title="Ajouter une université"
      description="Un espace administrateur est créé automatiquement"
      icon={<BuildingIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className={buttonClasses('secondary', 'md')}>
            Annuler
          </button>
          <Button onClick={submit} loading={loading}>
            Créer l’université
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input label="Nom de l’université" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Université de Dakar" />
        <Input
          label="Email administrateur"
          type="email"
          value={form.adminEmail}
          onChange={(e) => set('adminEmail', e.target.value)}
          placeholder="admin@universite.africa"
        />
        <Input
          label="Mot de passe administrateur"
          type="password"
          value={form.adminPassword}
          onChange={(e) => set('adminPassword', e.target.value)}
          placeholder="••••••••"
        />

        <ChipGroup title="Programmes" options={PROGRAMS} selected={form.programs} onToggle={(v) => toggle('programs', v)} />
        <ChipGroup title="Cours disponibles" options={COURSES} selected={form.courses} onToggle={(v) => toggle('courses', v)} />
      </div>
    </Drawer>
  );
}

function ChipGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-ink/70">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => onToggle(o)}
              className={
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ' +
                (on ? 'border-oca bg-oca text-white' : 'border-hairline bg-white text-ink/65 hover:bg-cloud')
              }
            >
              {on && <CheckIcon size={14} />}
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
