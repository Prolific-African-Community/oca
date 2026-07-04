import { AppShell } from '../../components/app/AppShell';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ProgressRing } from '../../components/ui/ProgressRing';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Reveal } from '../../components/anim/Reveal';

const grades = [
  { course: 'Finance d’entreprise', grade: 15.5, ects: 6, status: 'Validé' as const },
  { course: 'Comptabilité générale', grade: 16.0, ects: 6, status: 'Validé' as const },
  { course: 'Microéconomie', grade: 13.0, ects: 4, status: 'Validé' as const },
  { course: 'Data Analytics', grade: null, ects: 6, status: 'En cours' as const },
  { course: 'Droit des affaires', grade: 12.5, ects: 5, status: 'Validé' as const },
  { course: 'Statistiques appliquées', grade: null, ects: 5, status: 'En cours' as const },
];

export default function StudentGrades() {
  return (
    <AppShell role="student" title="Notes & crédits" subtitle="Relevé académique · Licence S3">
      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal>
          <Card className="flex items-center gap-5">
            <ProgressRing
              value={71}
              size={96}
              stroke={9}
              label={<span className="text-lg font-medium text-ink">14,2</span>}
            />
            <div>
              <p className="text-sm text-ink/45">Moyenne générale</p>
              <p className="text-2xl font-medium tracking-tightest text-ink">14,2<span className="text-ink/30"> / 20</span></p>
              <Badge tone="success" className="mt-2">Mention Bien</Badge>
            </div>
          </Card>
        </Reveal>

        <Reveal delay={70}>
          <Card>
            <CardHeader title="Crédits ECTS" />
            <p className="text-2xl font-medium tracking-tightest text-ink">72<span className="text-ink/30"> / 180</span></p>
            <ProgressBar value={40} className="mt-3" />
            <p className="mt-2 text-sm text-ink/45">40 % du diplôme validé · 108 crédits restants</p>
          </Card>
        </Reveal>

        <Reveal delay={140}>
          <Card>
            <CardHeader title="Ce semestre" />
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-medium tracking-tightest text-ink">17</p>
              <p className="text-sm text-ink/45">/ 27 crédits acquis</p>
            </div>
            <ProgressBar value={63} className="mt-3" />
            <p className="mt-2 text-sm text-ink/45">2 cours en cours de validation</p>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={80} className="mt-5 block">
        <Card padding="none">
          <div className="px-6 pt-6 sm:px-8">
            <CardHeader title="Détail par cours" />
          </div>
          <ul className="divide-y divide-hairline">
            {grades.map((g) => (
              <li key={g.course} className="flex items-center gap-4 px-6 py-4 sm:px-8">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{g.course}</p>
                  <p className="text-sm text-ink/45">{g.ects} crédits ECTS</p>
                </div>
                {g.status === 'Validé' ? (
                  <Badge tone="success">Validé</Badge>
                ) : (
                  <Badge tone="warning">En cours</Badge>
                )}
                <div className="w-16 text-right">
                  {g.grade !== null ? (
                    <span className="text-[15px] font-medium tabular-nums text-ink">{g.grade.toFixed(1)}</span>
                  ) : (
                    <span className="text-sm text-ink/30">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </AppShell>
  );
}
