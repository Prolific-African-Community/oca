import { Role } from '@prisma/client';
import { requireRoleSSR } from '../../lib/pageGuard';
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
import { AuditFeed } from '../../components/admin/AuditFeed';
import { useRegisterCommands } from '../../components/overlay/command';
import {
  PlusIcon,
  BuildingIcon,
  GlobeIcon,
  UsersIcon,
  LayersIcon,
} from '../../components/ui/icons';

/** Vue d'ensemble servie par /api/superadmin/overview — comptages réels uniquement. */
interface Overview {
  totals: {
    institutions: number;
    activeInstitutions: number;
    inactiveInstitutions: number;
    admins: number;
    professors: number;
    students: number;
    programs: number;
    courses: number;
    publishedCourses: number;
  };
  institutions: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
    status: 'active' | 'inactive';
    adminEmail: string | null;
    counts: {
      admins: number;
      professors: number;
      students: number;
      programs: number;
      courses: number;
    };
  }[];
}

const EMPTY_OVERVIEW: Overview = {
  totals: {
    institutions: 0,
    activeInstitutions: 0,
    inactiveInstitutions: 0,
    admins: 0,
    professors: 0,
    students: 0,
    programs: 0,
    courses: 0,
    publishedCourses: 0,
  },
  institutions: [],
};

export default function SuperAdminNetwork() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [drawer, setDrawer] = useState(false);

  const fetchOverview = () => {
    fetch('/api/superadmin/overview')
      .then((r) => (r.ok ? r.json() : EMPTY_OVERVIEW))
      .then((d) => setOverview({ ...EMPTY_OVERVIEW, ...d }))
      .catch(() => setOverview(EMPTY_OVERVIEW));
  };
  useEffect(fetchOverview, []);

  const totals = overview?.totals ?? EMPTY_OVERVIEW.totals;
  const universities = overview?.institutions ?? [];

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

  const activeRate = useMemo(
    () =>
      totals.institutions === 0
        ? 0
        : Math.round((totals.activeInstitutions / totals.institutions) * 100),
    [totals]
  );

  // Bandeau : uniquement des comptages issus de la base.
  const metrics = useMemo(
    () => [
      {
        icon: BuildingIcon,
        label: `${totals.institutions} établissement${totals.institutions > 1 ? 's' : ''}`,
        hint:
          totals.inactiveInstitutions > 0
            ? `${totals.activeInstitutions} actif${totals.activeInstitutions > 1 ? 's' : ''} · ${
                totals.inactiveInstitutions
              } inactif${totals.inactiveInstitutions > 1 ? 's' : ''}`
            : 'Tous actifs',
      },
      {
        icon: UsersIcon,
        label: `${totals.admins + totals.professors + totals.students} comptes rattachés`,
        hint: `${totals.admins} admin · ${totals.professors} enseignants · ${totals.students} étudiants`,
      },
      {
        icon: LayersIcon,
        label: `${totals.programs} programme${totals.programs > 1 ? 's' : ''}`,
        hint: `${totals.courses} cours · ${totals.publishedCourses} publié${
          totals.publishedCourses > 1 ? 's' : ''
        }`,
      },
    ],
    [totals]
  );

  return (
    <AppShell
      role="superadmin"
      title="Réseau"
      subtitle="Établissements partenaires du réseau"
      action={
        <button onClick={() => setDrawer(true)} className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}>
          <PlusIcon size={18} /> Ajouter une université
        </button>
      }
    >
      {/* HEALTH BAND */}
      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex items-center gap-3 rounded-hero border border-hairline bg-white p-4 text-left shadow-soft"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cloud text-ink/60">
                <m.icon size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium text-ink">{m.label}</span>
                <span className="block truncate text-sm text-ink/45">{m.hint}</span>
              </span>
            </div>
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
                        <p className="truncate text-sm text-ink/45">
                          {u.adminEmail ?? 'Aucun administrateur'}
                        </p>
                        <p className="truncate text-[13px] text-ink/35">
                          {u.counts.students} étudiants · {u.counts.professors} enseignants ·{' '}
                          {u.counts.programs} programmes · {u.counts.courses} cours
                        </p>
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
              <AuditFeed limit={8} />
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
                  <p className="text-2xl font-medium tracking-tightest text-ink">
                    {totals.institutions}
                  </p>
                  <p className="text-sm text-ink/45">
                    {totals.institutions > 1 ? 'établissements' : 'établissement'}
                  </p>
                  {totals.institutions > 0 && (
                    <Badge tone={totals.inactiveInstitutions > 0 ? 'warning' : 'success'} className="mt-2">
                      {activeRate}% actifs
                    </Badge>
                  )}
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
          fetchOverview();
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
  const empty = { name: '', adminEmail: '', adminPassword: '', country: '' };
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      onError();
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/universities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const created = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(created.message || 'Création impossible');
      onCreated(created);
      setForm(empty);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Création impossible');
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
        <Input label="Nom de l’université" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Nom officiel de l’établissement" />
        <Input
          label="Email administrateur"
          type="email"
          value={form.adminEmail}
          onChange={(e) => set('adminEmail', e.target.value)}
          placeholder="admin@etablissement.africa"
        />
        <Input
          label="Mot de passe administrateur"
          type="password"
          value={form.adminPassword}
          onChange={(e) => set('adminPassword', e.target.value)}
          placeholder="••••••••"
        />

        <Input
          label="Pays (optionnel)"
          value={form.country}
          onChange={(e) => set('country', e.target.value)}
          placeholder="CI"
        />

        <p className="text-sm text-ink/45">
          Les programmes et les cours sont créés ensuite par l’administrateur de l’établissement,
          depuis son espace.
        </p>

        {error && (
          <div role="alert" className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}
      </div>
    </Drawer>
  );
}

// Protection côté serveur : la page n'est rendue que pour un rôle autorisé.
export const getServerSideProps = requireRoleSSR([Role.SUPER_ADMIN]);
