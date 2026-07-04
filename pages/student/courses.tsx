import Link from 'next/link';
import { AppShell } from '../../components/app/AppShell';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Reveal } from '../../components/anim/Reveal';
import { BookIcon, ChevronRightIcon } from '../../components/ui/icons';

const courses = [
  { id: 'finance', title: 'Finance d’entreprise', teacher: 'Dr. A. Diallo', progress: 65, next: 'Module 3 · Analyse financière', modules: 6, faculty: 'Économie' },
  { id: 'data-analytics', title: 'Data Analytics', teacher: 'Pr. M. Koné', progress: 42, next: 'Module 2 · Régression', modules: 5, faculty: 'Technologie' },
  { id: 'droit-affaires', title: 'Droit des affaires', teacher: 'Me. F. Sow', progress: 80, next: 'Module 5 · Contrats', modules: 6, faculty: 'Droit' },
  { id: 'microeconomie', title: 'Microéconomie', teacher: 'Dr. K. Traoré', progress: 30, next: 'Module 2 · Élasticité', modules: 4, faculty: 'Économie' },
  { id: 'comptabilite', title: 'Comptabilité générale', teacher: 'Pr. S. Bah', progress: 100, next: 'Terminé', modules: 5, faculty: 'Économie' },
  { id: 'statistiques', title: 'Statistiques appliquées', teacher: 'Dr. N. Camara', progress: 55, next: 'Module 3 · Tests', modules: 5, faculty: 'Technologie' },
];

export default function StudentCourses() {
  return (
    <AppShell role="student" title="Mes cours" subtitle="6 cours ce semestre · Licence S3">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c, i) => (
          <Reveal key={c.id} delay={i * 60}>
            <Link href={`/student/course/${c.id}`}>
              <a className="block h-full">
                <Card interactive className="flex h-full flex-col">
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-oca-tint text-oca">
                      <BookIcon size={22} />
                    </span>
                    {c.progress === 100 ? (
                      <Badge tone="success">Terminé</Badge>
                    ) : (
                      <Badge tone="neutral">{c.faculty}</Badge>
                    )}
                  </div>
                  <h3 className="mt-4 text-lg font-medium tracking-tightest text-ink">{c.title}</h3>
                  <p className="mt-1 text-sm text-ink/45">{c.teacher}</p>

                  <div className="mt-auto pt-5">
                    <div className="mb-2 flex items-center justify-between text-[13px]">
                      <span className="text-ink/45">{c.next}</span>
                      <span className="font-medium tabular-nums text-ink/60">{c.progress}%</span>
                    </div>
                    <ProgressBar value={c.progress} />
                    <div className="mt-4 flex items-center gap-1 text-sm font-medium text-apple">
                      {c.progress === 100 ? 'Revoir le cours' : 'Continuer'}
                      <ChevronRightIcon size={15} />
                    </div>
                  </div>
                </Card>
              </a>
            </Link>
          </Reveal>
        ))}
      </div>
    </AppShell>
  );
}
