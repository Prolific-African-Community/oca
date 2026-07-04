import { AppShell } from '../../components/app/AppShell';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Reveal } from '../../components/anim/Reveal';
import { DarkCanvas } from '../../components/illustrations/Backdrop';
import { buttonClasses } from '../../components/ui/Button';
import { LiveIcon, PlayIcon, CalendarIcon } from '../../components/ui/icons';

const upcoming = [
  { title: 'Data Analytics', teacher: 'Pr. M. Koné', when: 'Aujourd’hui · 14:00', eta: 'Dans 2h' },
  { title: 'Droit des affaires', teacher: 'Me. F. Sow', when: 'Demain · 10:00', eta: '' },
  { title: 'Finance d’entreprise', teacher: 'Dr. A. Diallo', when: 'Jeudi · 16:00', eta: '' },
];

const replays = [
  { title: 'Comptabilité — Le bilan', when: 'Il y a 3 j', duration: '1h 12' },
  { title: 'Microéconomie — L’offre', when: 'Il y a 6 j', duration: '58 min' },
];

export default function StudentLive() {
  return (
    <AppShell role="student" title="Sessions live" subtitle="Cours en direct et rediffusions">
      <div className="grid gap-5 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <DarkCanvas className="h-full rounded-hero p-7 sm:p-8" showOrbits={false}>
            <div className="relative">
              <Badge tone="live" dot className="bg-white/10 text-white/85">
                Prochaine session
              </Badge>
              <h2 className="mt-4 text-2xl font-medium tracking-tightest text-white sm:text-[26px]">
                Data Analytics
              </h2>
              <p className="mt-1 text-[15px] text-white/55">Pr. M. Koné · Aujourd’hui à 14:00</p>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/55">
                Chapitre 3 : la régression linéaire. Préparez vos jeux de données, la session
                sera interactive.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className={buttonClasses('primary', 'md', 'bg-white text-oca hover:bg-white/90')}>
                  <PlayIcon size={17} /> Rejoindre la session
                </button>
                <button className={buttonClasses('secondary', 'md', 'border-white/25 bg-white/5 text-white hover:border-white/40 hover:bg-white/10')}>
                  <CalendarIcon size={16} /> Ajouter au calendrier
                </button>
              </div>
            </div>
          </DarkCanvas>
        </Reveal>

        <Reveal delay={80}>
          <Card>
            <CardHeader title="À venir" />
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.title} className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-oca-tint text-oca">
                    <LiveIcon size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{s.title}</p>
                    <p className="truncate text-sm text-ink/45">{s.when}</p>
                  </div>
                  {s.eta && <Badge tone="live">{s.eta}</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      </div>

      <Reveal delay={120} className="mt-5 block">
        <Card>
          <CardHeader title="Rediffusions" />
          <ul className="divide-y divide-hairline">
            {replays.map((r) => (
              <li key={r.title}>
                <a className="group flex cursor-pointer items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cloud text-ink/55 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                    <PlayIcon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium text-ink">{r.title}</p>
                    <p className="truncate text-sm text-ink/45">{r.when}</p>
                  </div>
                  <Badge tone="neutral">{r.duration}</Badge>
                </a>
              </li>
            ))}
          </ul>
        </Card>
      </Reveal>
    </AppShell>
  );
}
