import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '../../components/app/AppShell';
import { DarkCanvas } from '../../components/illustrations/Backdrop';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { Reveal } from '../../components/anim/Reveal';
import { useMagnetic } from '../../components/anim/useMagnetic';
import { useCurrentUser, displayName } from '../../lib/auth';
import { PlayIcon, LiveIcon, ArrowIcon, ClipboardIcon } from '../../components/ui/icons';

const resume = {
  course: 'Finance d’entreprise',
  courseId: 'finance',
  module: 'Module 3 · Analyse des états financiers',
  moduleId: 3,
  progress: 65,
  remaining: '15 min restantes',
  step: '3 / 5',
};

const live = { title: 'Data Analytics', teacher: 'Pr. M. Koné', time: '14:00', eta: 'Dans 2h' };

const week = [
  { title: 'Quiz — Microéconomie', due: 'Demain' },
  { title: 'Partiel — Statistiques', due: 'Lundi' },
];

export default function StudentToday() {
  const { user } = useCurrentUser();
  const first = displayName(user).split(' ')[0];
  const [hello, setHello] = useState({ greet: 'Bonjour', date: '' });

  useEffect(() => {
    const now = new Date();
    const greet = now.getHours() >= 18 ? 'Bonsoir' : 'Bonjour';
    const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    setHello({ greet, date: date.charAt(0).toUpperCase() + date.slice(1) });
  }, []);

  const magnet = useMagnetic<HTMLAnchorElement>(0.3);

  return (
    <AppShell role="student" bareHeader maxWidth="narrow">
      {/* ── OPENING ─────────────────────────────── */}
      <section className="relative pb-16 pt-6 sm:pb-20 sm:pt-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[46rem] max-w-full -translate-x-1/2"
          style={{ background: 'radial-gradient(50% 60% at 50% 40%, rgba(0,113,227,0.08), transparent 70%)' }}
        />
        <div className="relative animate-fade-up">
          <p className="text-[13px] font-medium uppercase tracking-[0.2em] text-ink/35">{hello.date || 'Aujourd’hui'}</p>
          <h1 className="mt-4 text-[40px] font-medium leading-[1.0] tracking-tightest text-ink sm:text-[56px]">
            {hello.greet}, {first}.
          </h1>
          <p className="mt-4 max-w-md text-lg text-ink/45 sm:text-xl">
            Votre prochain objectif vous attend.
          </p>
        </div>
      </section>

      {/* ── FOCUS ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <Reveal y={24}>
          <DarkCanvas className="relative h-full rounded-hero p-8 sm:p-10" showOrbits={false}>
            {/* floating step chip — depth */}
            <div className="absolute right-6 top-6 hidden animate-float-slow items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 backdrop-blur-md sm:flex">
              <span className="text-[12px] font-medium text-white/80">Module {resume.step}</span>
            </div>

            <div className="relative flex h-full flex-col">
              <p className="text-[13px] font-medium uppercase tracking-[0.18em] text-white/50">
                Reprendre
              </p>
              <h2 className="mt-3 text-[26px] font-medium leading-tight tracking-tightest text-white sm:text-[32px]">
                {resume.course}
              </h2>
              <p className="mt-1.5 text-[15px] text-white/50">{resume.module}</p>

              <div className="mt-8">
                <div className="mb-2 flex items-center justify-between text-[13px] text-white/55">
                  <span>{resume.remaining}</span>
                  <span className="font-medium tabular-nums text-white/85">{resume.progress}%</span>
                </div>
                <ProgressBar value={resume.progress} tone="white" />
              </div>

              <div className="mt-8">
                <Link href={`/student/course/${resume.courseId}/module/${resume.moduleId}`}>
                  <a
                    ref={magnet}
                    className="group relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-full bg-white px-8 text-[15px] font-medium text-oca shadow-lift transition-transform duration-200 ease-out"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-white/60 opacity-0 blur-md transition-opacity duration-300 group-hover:animate-shimmer group-hover:opacity-100"
                    />
                    <PlayIcon size={18} />
                    Continuer le module
                    <ArrowIcon size={17} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </a>
                </Link>
              </div>
            </div>
          </DarkCanvas>
        </Reveal>

        {/* next live — quiet satellite */}
        <Reveal y={24} delay={90}>
          <div className="flex h-full flex-col justify-between rounded-hero border border-hairline bg-white p-7 shadow-soft">
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[13px] font-medium text-red-500">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  En direct
                </span>
                <span className="text-[13px] text-ink/35">{live.eta}</span>
              </div>
              <h3 className="mt-5 text-xl font-medium tracking-tightest text-ink">{live.title}</h3>
              <p className="mt-1 text-[15px] text-ink/45">
                {live.teacher} · {live.time}
              </p>
            </div>
            <button className="group mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-oca text-[15px] font-medium text-white transition-colors duration-300 hover:bg-oca-600">
              <PlayIcon size={17} />
              Rejoindre
            </button>
          </div>
        </Reveal>
      </div>

      {/* ── PROGRESSION — calm band ─────────────── */}
      <Reveal y={24} delay={60} className="mt-4 block">
        <div className="rounded-hero border border-hairline bg-white p-8 shadow-soft sm:p-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[13px] font-medium uppercase tracking-[0.16em] text-oca/60">Progression</p>
              <p className="mt-3 max-w-md text-2xl font-medium leading-snug tracking-tightest text-ink sm:text-[26px]">
                Vous êtes à 40 % de votre licence.
              </p>
            </div>
            <p className="text-[15px] text-ink/45">
              <span className="text-2xl font-medium tabular-nums text-ink">72</span>
              <span className="text-ink/30"> / 180</span> crédits · Semestre 3
            </p>
          </div>

          <div className="mt-6">
            <ProgressBar value={40} />
          </div>

          <div className="mt-8 border-t border-hairline pt-6">
            <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-ink/35">Cette semaine</p>
            <ul className="mt-3 divide-y divide-hairline">
              {week.map((w) => (
                <li key={w.title} className="group flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-cloud text-ink/50 transition-colors group-hover:bg-oca-tint group-hover:text-oca">
                    <ClipboardIcon size={18} />
                  </span>
                  <span className="flex-1 text-[15px] font-medium text-ink">{w.title}</span>
                  <span className="text-[13px] text-ink/40">{w.due}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </AppShell>
  );
}
