"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type ClassValue = string | false | null | undefined;
const cn = (...c: ClassValue[]) => c.filter(Boolean).join(" ");

/* ---------------- DESIGN TOKENS ---------------- */
const TITLE_GRADIENT =
  "bg-pixel-blue bg-clip-text text-transparent";

  const ACCENT_GRADIENT =
  "bg-pixel-blue hover:bg-white hover:text-black opacity-90";

const GLOW =
  "shadow-[0_20px_60px_-15px_rgba(30,58,95,0.25)]";

const CARD_GLOW =
  "hover:shadow-[0_20px_60px_-15px_rgba(30,58,95,0.25)]";

const SECTION_Y = "py-32";

export default function OCAHome() {
  const [facultyIndex, setFacultyIndex] = useState(0);

  const faculties = [
    {
      title: "Sciences Économiques & Gestion",
      desc: "Finance, comptabilité, management, stratégie et économie appliquée avec une approche orientée performance et gouvernance moderne."
    },
    {
      title: "Technologie & Data",
      desc: "Développement logiciel, intelligence artificielle, data science et transformation digitale adaptés aux réalités africaines."
    },
    {
      title: "Droit & Gouvernance",
      desc: "Droit des affaires, régulation, conformité et gouvernance institutionnelle alignés sur les standards régionaux."
    },
    {
      title: "Entrepreneuriat & Innovation",
      desc: "Création d’entreprise, innovation stratégique et incubation intégrée pour former les bâtisseurs de demain."
    }
  ];

  const visibleFaculties = [0,1,2].map(i => faculties[(facultyIndex + i) % faculties.length]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto slider
  useEffect(() => {
    const interval = setInterval(() => {
      setFacultyIndex((prev) => (prev + 1) % faculties.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative bg-slate-100 text-slate-900 overflow-hidden">

      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(30,64,175,0.08),transparent_40%)]" />

      {/* HEADER */}
      <header
        className={cn(
          "fixed top-0 w-full z-50 transition-all",
          scrolled
            ? "bg-slate-100 backdrop-blur-xl border-b border-slate-200"
            : "bg-transparent"
        )}
      >
        <nav className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
        <Link href="/">
  <a className="flex items-center no-underline">
    <Image
      src="/logo7.png"
      alt="Open Campus Africa"
      width={160}
      height={120}
      priority
      className="object-contain"
    />
  </a>
</Link>

          

          <div className="hidden lg:flex gap-12 text-semibold font-medium tracking-[0.2em] text-slate-600">
            <a href="#programmes" className="text-black no-underline hover:text-blue-700 transition">Programmes</a>
            <a href="#about" className="text-black no-underline hover:text-blue-700 transition">Qui sommes-nous</a>
            <a href="#partenaires" className="text-black no-underline hover:text-blue-700 transition">Partenaires</a>
            <a href="#contact" className="text-black no-underline hover:text-blue-700 transition">Contact</a>
          </div>

          <a
            href="/login"
            className={cn(
              "no-underline px-7 py-3 rounded-full text-white font-semibold transition hover:opacity-90",
              ACCENT_GRADIENT,
              GLOW
            )}
          >
            Login
          </a>
        </nav>
      </header>

      {/* HERO - MANIFESTO */}
      <section className="relative min-h-screen flex items-center justify-center px-8">
        <div className="text-center max-w-5xl">

          <h1 className={cn("text-6xl md:text-8xl font-semibold leading-[1.05]", TITLE_GRADIENT)}>
            Repenser l’université.
            <br />
            Structurer l’avenir.
          </h1>

          <p className="mt-12 text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Open Campus Africa est une plateforme universitaire numérique
            permettant aux étudiants de suivre leurs cours, valider leurs
            crédits, assister aux sessions live et suivre leur progression
            académique dans un environnement structuré et conforme aux
            standards régionaux.
          </p>

          <div className="mt-16 flex justify-center gap-8 flex-wrap">
            <a
              href="/login"
              className={cn(
                "no-underline px-12 py-5 rounded-full text-white font-semibold transition hover:opacity-90",
                ACCENT_GRADIENT,
                GLOW
              )}
            >
              Accéder à mon espace
            </a>

            <a
              href="#programmes"
              className="bg-pixel-blue bg-yellow-500 text-white no-underline px-12 py-5 rounded-full border border-slate-300 font-semibold hover:border-orange-400 hover:text-orange-500 transition"
            >
              Découvrir les programmes
            </a>
          </div>
        </div>
      </section>

      {/* PROGRAMMES */}
      <section id="programmes" className={SECTION_Y}>
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-5xl font-semibold text-center mb-24 text-blue-900">
            Des programmes structurés.
          </h2>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              "Licence – 180 crédits capitalisables",
              "Master – 120 crédits spécialisés",
              "Certifications professionnelles",
            ].map((item) => (
              <div
                key={item}
                className={cn(
                  "relative p-12 rounded-b-3xl border border-slate-200 bg-white transition duration-500 hover:-translate-y-2",
                  CARD_GLOW
                )}
              >
                <div className="absolute top-0 left-0 w-full h-[3px] rounded-t-xl bg-pixel-blue" />
                <h3 className="text-2xl font-semibold text-slate-900 mb-6">
                  {item}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  Organisation en semestres, unités d’enseignement,
                  évaluation continue et validation académique formalisée.
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

                  {/* FACULTÉS DÉTAILLÉES */}
      <section className={SECTION_Y}>
        <div className="max-w-7xl mx-auto px-8">
          <h2 className="text-5xl font-semibold text-center mb-16 text-blue-900">
            Facultés & Domaines d’excellence
          </h2>

                    <div className="grid md:grid-cols-3 gap-16">
            {visibleFaculties.map((fac) => (
              <div
                key={fac.title}
                className={cn(
                  "relative p-14 rounded-b-3xl border border-slate-200 bg-white transition duration-500 hover:-translate-y-2",
                  CARD_GLOW
                )}
              >
                <div className="absolute top-0 left-0 w-full h-[4px] bg-pixel-blue rounded-t-xl" />
                <h3 className="text-2xl font-semibold text-slate-900 mb-6">
                  {fac.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {fac.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM FLOW */}}
      <section className={SECTION_Y}>
        <div className="max-w-6xl mx-auto px-8 text-center">
          <h2 className="text-5xl font-semibold mb-20 text-blue-900">
            Une expérience académique fluide.
          </h2>

          <div className="grid md:grid-cols-4 gap-10">
            {[
              "Connexion sécurisée",
              "Accès aux cours et live",
              "Suivi des notes et crédits",
              "Validation et progression",
            ].map((item) => (
              <div
                key={item}
                className={cn(
                  "relative p-10 rounded-r-3xl border border-slate-200 bg-white transition duration-500 hover:-translate-y-2",
                  CARD_GLOW
                )}
              >
                <div className="absolute left-0 top-0 h-full w-[3px] bg-pixel-blue bg-yellow-400" />
                <p className="text-lg font-semibold text-slate-900">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className={SECTION_Y}>
        <div className="max-w-4xl mx-auto text-center px-8">
          <h2 className="text-5xl font-semibold text-blue-900">
            Qui sommes-nous
          </h2>

          <p className="mt-10 text-slate-600 text-xl leading-relaxed">
            Open Campus Africa développe une infrastructure académique
            numérique permettant aux universités partenaires de déployer
            des programmes conformes aux standards régionaux tout en offrant
            aux étudiants une plateforme moderne et structurée.
          </p>
        </div>
      </section>

      {/* PARTENAIRES */}
      <section id="partenaires" className={SECTION_Y}>
        <div className="max-w-4xl mx-auto text-center px-8">
          <h2 className="text-6xl font-semibold leading-tight text-blue-900">
            Une plateforme adoptée par les universités.
          </h2>

          <p className="mt-10 text-slate-600 text-xl leading-relaxed">
            Les universités intègrent leurs étudiants, administrent leurs
            cohortes et déploient des programmes structurés au sein d’une
            plateforme académique complète.
          </p>

          <div className="mt-16">
            <a
              href="/login"
              className={cn(
                "no-underline px-14 py-6 rounded-full text-white font-semibold hover:opacity-90 transition",
                ACCENT_GRADIENT,
                GLOW
              )}
            >
              Accéder à mon espace
            </a>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="py-32 bg-white border-t border-slate-200">
        <div className="max-w-5xl mx-auto px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-semibold text-blue-900">
              Contact
            </h2>
            <p className="mt-6 text-slate-600 text-lg">
              Une question sur nos programmes ? Un partenariat universitaire ?
              Contactez-nous directement.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-16">
            {/* Left info */}
            <div className="space-y-8">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Email</h3>
                <p className="mt-2 text-slate-600">contact@opencampus.africa</p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">Partenariats universitaires</h3>
                <p className="mt-2 text-slate-600">
                  Pour toute demande de collaboration institutionnelle ou
                  intégration de programme.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-slate-900">Support plateforme</h3>
                <p className="mt-2 text-slate-600">
                  Assistance technique pour étudiants, professeurs et
                  administrateurs.
                </p>
              </div>
            </div>

            {/* Form */}
            <form className="space-y-6 bg-slate-50 p-10 rounded-3xl border border-slate-200">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nom complet
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Message
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full px-8 py-4 rounded-full text-white font-semibold bg-pixel-blue hover:opacity-90 transition"
              >
                Envoyer le message
              </button>
            </form>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 text-center py-12 text-slate-500">
        © {new Date().getFullYear()} Open Campus Africa
      </footer>
    </main>
  );
}
