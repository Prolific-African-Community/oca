import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '../components/ui/cn';
import { Button, buttonClasses } from '../components/ui/Button';
import { Wordmark } from '../components/brand/Wordmark';
import { HeroScene } from '../components/illustrations/HeroScene';
import { DarkCanvas, GridField, NoiseOverlay } from '../components/illustrations/Backdrop';
import { Reveal } from '../components/anim/Reveal';
import {
  CapIcon,
  LiveIcon,
  ProgressIcon,
  AwardIcon,
  ShieldIcon,
  GlobeIcon,
  LayersIcon,
  ArrowIcon,
} from '../components/ui/icons';

const nav = [
  { href: '#experience', label: 'Plateforme' },
  { href: '#vision', label: 'Vision' },
  { href: '#facultes', label: 'Facultés' },
  { href: '#contact', label: 'Contact' },
];

const pillars = [
  {
    icon: CapIcon,
    title: 'Cours & modules',
    desc: 'Des parcours structurés en unités d’enseignement, avec ressources, quiz et validation module par module.',
  },
  {
    icon: LiveIcon,
    title: 'Sessions live',
    desc: 'Cours en direct, présence et interaction, rejoignables en un clic depuis l’espace étudiant.',
  },
  {
    icon: ProgressIcon,
    title: 'Notes & crédits',
    desc: 'Suivi de progression, moyennes et crédits ECTS capitalisables, conformes au standard LMD.',
  },
  {
    icon: AwardIcon,
    title: 'Certificats',
    desc: 'Diplômes et certifications délivrés à la validation, vérifiables et reconnus par les partenaires.',
  },
];

const steps = [
  { n: '01', label: 'Connexion sécurisée', icon: ShieldIcon },
  { n: '02', label: 'Cours & sessions live', icon: LiveIcon },
  { n: '03', label: 'Notes & crédits', icon: ProgressIcon },
  { n: '04', label: 'Validation & diplôme', icon: AwardIcon },
];

const faculties = [
  { title: 'Sciences Économiques & Gestion', desc: 'Finance, comptabilité, management et économie appliquée.' },
  { title: 'Technologie & Data', desc: 'Développement logiciel, intelligence artificielle et data science.' },
  { title: 'Droit & Gouvernance', desc: 'Droit des affaires, régulation, conformité et gouvernance.' },
  { title: 'Entrepreneuriat & Innovation', desc: 'Création d’entreprise, innovation stratégique et incubation.' },
];

export default function OCAHome() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <Head>
        <title>Open Campus Africa — Le campus numérique de l’excellence africaine</title>
        <meta
          name="description"
          content="La plateforme académique des universités africaines : cours, sessions live, crédits ECTS et certificats, dans un environnement premium et structuré."
        />
      </Head>

      <div className="min-h-screen bg-page text-ink">
        {/* HEADER */}
        <header
          className={cn(
            'fixed top-0 z-50 w-full transition-all duration-300',
            scrolled
              ? 'border-b border-hairline bg-page/70 backdrop-blur-xl'
              : 'border-b border-transparent bg-transparent'
          )}
        >
          <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/">
              <a aria-label="Accueil">
                <Wordmark />
              </a>
            </Link>
            <div className="hidden items-center gap-9 lg:flex">
              {nav.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-[15px] text-ink/60 transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <Link href="/login">
              <a className={buttonClasses('primary', 'md')}>Se connecter</a>
            </Link>
          </nav>
        </header>

        {/* HERO */}
        <section className="relative overflow-hidden px-6 pb-20 pt-32 lg:pb-28 lg:pt-40">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(60% 45% at 78% 12%, rgba(0,113,227,0.10) 0%, transparent 60%), radial-gradient(50% 40% at 8% 8%, rgba(10,42,107,0.06) 0%, transparent 55%)',
            }}
          />
          <GridField tone="light" className="opacity-70" />

          <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.02fr_1fr]">
            {/* left — copy */}
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-white px-4 py-1.5 text-sm text-ink/60 shadow-soft">
                <span className="h-1.5 w-1.5 rounded-full bg-apple" />
                Le campus numérique de l’excellence africaine
              </span>

              <h1 className="mt-7 text-[44px] font-medium leading-[1.03] tracking-tightest text-ink sm:text-6xl lg:text-[66px]">
                Repenser
                <br />
                l’université.
                <br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(100deg,#0A2A6B,#0071E3)' }}
                >
                  Structurer l’avenir.
                </span>
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-relaxed text-ink/55">
                Cours, sessions live, crédits ECTS et certificats — réunis dans une
                plateforme académique claire, structurée et conforme aux standards
                régionaux.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link href="/login">
                  <a className={buttonClasses('primary', 'lg')}>
                    Accéder à mon espace
                    <ArrowIcon size={18} />
                  </a>
                </Link>
                <a href="#experience" className={buttonClasses('secondary', 'lg')}>
                  Découvrir la plateforme
                </a>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-ink/45">
                <span className="inline-flex items-center gap-2"><ShieldIcon size={17} className="text-oca/70" /> Conforme LMD</span>
                <span className="inline-flex items-center gap-2"><LayersIcon size={17} className="text-oca/70" /> Crédits ECTS</span>
                <span className="inline-flex items-center gap-2"><GlobeIcon size={17} className="text-oca/70" /> Multi-universités</span>
              </div>
            </div>

            {/* right — hero scene */}
            <div className="animate-fade-in">
              <HeroScene className="mx-auto h-[440px] w-full max-w-[520px] lg:h-[600px]" />
            </div>
          </div>
        </section>

        {/* VISION */}
        <section id="vision" className="scroll-mt-24 px-6 py-28">
          <Reveal className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-medium uppercase tracking-[0.16em] text-oca/70">Notre conviction</p>
            <p className="mt-6 text-3xl font-medium leading-[1.25] tracking-tightest text-ink sm:text-[40px] sm:leading-[1.2]">
              Nous ne construisons pas un logiciel de gestion. Nous construisons le{' '}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(100deg,#0A2A6B,#0071E3)' }}
              >
                campus
              </span>{' '}
              où l’Afrique forme sa prochaine génération de bâtisseurs.
            </p>
          </Reveal>
        </section>

        {/* EXPERIENCE / PILLARS */}
        <section id="experience" className="scroll-mt-24 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionHeading eyebrow="La plateforme" title="Tout le parcours académique, réuni" />
            </Reveal>
            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {pillars.map((p, i) => (
                <Reveal key={p.title} delay={i * 90}>
                  <PillarCard icon={p.icon} title={p.title} desc={p.desc} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* PARCOURS TIMELINE */}
        <section className="px-6 py-16">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionHeading eyebrow="Le flux" title="De la connexion au diplôme" />
            </Reveal>
            <div className="relative mt-14">
              <div
                className="absolute left-0 right-0 top-6 hidden h-px lg:block"
                style={{ background: 'linear-gradient(90deg,transparent,#C9D6EE 12%,#C9D6EE 88%,transparent)' }}
              />
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                {steps.map((s, i) => (
                  <Reveal key={s.n} delay={i * 90} className="relative text-center lg:text-left">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-hairline bg-white text-oca shadow-soft lg:mx-0">
                      <s.icon size={20} />
                    </div>
                    <p className="mt-4 text-sm font-medium text-oca">{s.n}</p>
                    <p className="mt-1 font-medium leading-snug text-ink">{s.label}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FACULTÉS */}
        <section id="facultes" className="scroll-mt-24 px-6 py-24">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <SectionHeading eyebrow="Facultés" title="Des domaines d’excellence" />
            </Reveal>
            <div className="mt-14 grid gap-5 md:grid-cols-2">
              {faculties.map((f, i) => (
                <Reveal key={f.title} delay={i * 80}>
                  <div className="group flex items-start gap-5 rounded-hero border border-hairline bg-white p-7 shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift">
                    <div className="text-2xl font-medium tracking-tightest text-oca/25 transition-colors group-hover:text-oca/50">
                      0{i + 1}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium tracking-tightest text-ink">{f.title}</h3>
                      <p className="mt-2 leading-relaxed text-ink/55">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* CLOSING — CTA + CONTACT on dark canvas */}
        <section id="contact" className="scroll-mt-24 px-6 py-16">
          <Reveal className="mx-auto max-w-6xl">
            <DarkCanvas className="rounded-hero px-8 py-16 sm:px-14 sm:py-20" showOrbits={false}>
              <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-white/50">Partenaires</p>
                  <h2 className="mt-4 text-4xl font-medium leading-[1.08] tracking-tightest text-white sm:text-5xl">
                    Faites entrer votre université dans le campus.
                  </h2>
                  <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
                    Intégrez vos étudiants, administrez vos cohortes et déployez des
                    programmes structurés au sein d’une plateforme complète.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link href="/login">
                      <a className={buttonClasses('primary', 'lg', 'bg-white text-oca hover:bg-white/90')}>
                        Accéder à mon espace
                      </a>
                    </Link>
                    <a
                      href="mailto:contact@opencampus.africa"
                      className={buttonClasses('secondary', 'lg', 'border-white/25 bg-white/5 text-white hover:bg-white/10 hover:border-white/40')}
                    >
                      Nous écrire
                    </a>
                  </div>
                </div>

                <form className="relative space-y-4 rounded-hero border border-white/12 bg-white/[0.06] p-7 backdrop-blur-md">
                  <Field label="Nom complet">
                    <input type="text" className={darkField} placeholder="Votre nom" />
                  </Field>
                  <Field label="Email">
                    <input type="email" className={darkField} placeholder="nom@universite.africa" />
                  </Field>
                  <Field label="Message">
                    <textarea rows={3} className={cn(darkField, 'resize-none py-3')} placeholder="Votre message" />
                  </Field>
                  <Button type="submit" size="lg" className="w-full bg-white text-oca hover:bg-white/90">
                    Envoyer le message
                  </Button>
                </form>
              </div>
              <NoiseOverlay />
            </DarkCanvas>
          </Reveal>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-hairline">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
            <Wordmark />
            <p className="text-sm text-ink/45">© {new Date().getFullYear()} Open Campus Africa</p>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ---------- local primitives ---------- */

const darkField =
  'h-12 w-full rounded-card border border-white/15 bg-white/5 px-4 text-[15px] text-white ' +
  'placeholder:text-white/35 transition-all duration-200 hover:border-white/30 ' +
  'focus:border-white/60 focus:outline-none focus:ring-4 focus:ring-white/10';

function SectionHeading({
  eyebrow,
  title,
  centered,
}: {
  eyebrow: string;
  title: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? 'text-center' : ''}>
      <p className="text-sm font-medium uppercase tracking-[0.14em] text-oca/70">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-medium tracking-tightest text-ink sm:text-[40px]">{title}</h2>
    </div>
  );
}

function PillarCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: (p: { size?: number; className?: string }) => JSX.Element;
  title: string;
  desc: string;
}) {
  return (
    <div className="group relative h-full overflow-hidden rounded-hero border border-hairline bg-white p-7 shadow-soft transition-all duration-500 hover:-translate-y-1.5 hover:shadow-lift">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: 'radial-gradient(80% 100% at 50% 0%, rgba(0,113,227,0.10), transparent)' }}
      />
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-oca-tint text-oca transition-transform duration-500 group-hover:scale-105">
        <Icon size={22} />
      </div>
      <h3 className="relative mt-5 text-lg font-medium tracking-tightest text-ink">{title}</h3>
      <p className="relative mt-2 text-[15px] leading-relaxed text-ink/55">{desc}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-white/70">{label}</span>
      {children}
    </label>
  );
}
