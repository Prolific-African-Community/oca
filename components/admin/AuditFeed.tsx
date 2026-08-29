import { useEffect, useState } from 'react';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { GlobeIcon } from '../ui/icons';

/**
 * Flux d'audit récent, partagé par /superadmin et /admin.
 * Le périmètre est décidé côté serveur par `/api/audit/recent` : réseau entier
 * pour un SUPER_ADMIN, établissement seul pour un ADMIN.
 */

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { name: string; email: string };
  institution: { id: string; name: string; slug: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  'institution.create': 'a créé l’établissement',
  'structure.create': 'a créé',
  'student.create': 'a inscrit un étudiant',
  'teacher.create': 'a créé un compte enseignant',
  'assignment.create': 'a affecté un enseignant',
  'module.create': 'a créé un module',
  'module.update': 'a modifié un module',
  'lesson.create': 'a créé une leçon',
  'lesson.update': 'a modifié une leçon',
  'lesson.complete': 'a terminé une leçon',
  'lesson.uncomplete': 'a rouvert une leçon',
};

const ENTITY_LABELS: Record<string, string> = {
  faculty: 'une faculté',
  department: 'un département',
  cycle: 'un cycle',
  program: 'un programme',
  'academic-year': 'une année universitaire',
  semester: 'un semestre',
  course: 'un cours',
};

function describe(entry: AuditEntry): string {
  const verb = ACTION_LABELS[entry.action] ?? entry.action;

  if (entry.action === 'structure.create') {
    return `${verb} ${ENTITY_LABELS[entry.entityType] ?? entry.entityType}`;
  }

  return verb;
}

function detail(entry: AuditEntry): string | null {
  const m = (entry.metadata ?? {}) as Record<string, unknown>;
  const parts = [m.name, m.title, m.code, m.email, m.teacherEmail, m.courseCode]
    .filter((v): v is string => typeof v === 'string' && v.length > 0);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;

  const days = Math.round(hours / 24);
  return days === 1 ? 'hier' : `il y a ${days} j`;
}

export function AuditFeed({ limit = 8 }: { limit?: number }) {
  const [logs, setLogs] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    fetch(`/api/audit/recent?limit=${limit}`)
      .then((r) => (r.ok ? r.json() : { logs: [] }))
      .then((d) => setLogs(Array.isArray(d.logs) ? d.logs : []))
      .catch(() => setLogs([]));
  }, [limit]);

  if (logs === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <EmptyState
        icon={<GlobeIcon size={22} />}
        title="Aucune activité enregistrée"
        description="Les actions structurantes — créations, affectations, publications — apparaîtront ici dès qu’elles auront lieu."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {logs.map((entry) => {
        const info = detail(entry);

        return (
          <li key={entry.id} className="flex gap-3.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-oca-tint text-oca">
              <GlobeIcon size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-ink">
                {entry.actor.name} {describe(entry)}
                {info ? <span className="text-ink/50"> — {info}</span> : null}
              </p>
              <p className="text-sm text-ink/45">
                {timeAgo(entry.createdAt)}
                {entry.institution ? ` · ${entry.institution.name}` : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
