"use client";
import Link from "next/link";

import { useState } from "react";

const ACCENT =
  "bg-pixel-blue";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-100 to-white flex">

      {/* SIDEBAR */}
            {/* SIDEBAR */}
      <aside className="w-72 bg-slate-950 no-border text-black p-8 hidden md:flex flex-col justify-between">
        <div>
        <div className="mb-16 flex items-center">
  <img
    src="/logo7.png"
    alt="OCA Logo"
    className="h-36 w-auto object-contain"
  />
</div>


          <nav className="space-y-2">
            {[
              { key: "overview", label: "Tableau de bord" },
              { key: "courses", label: "Mes cours" },
              { key: "grades", label: "Notes & Crédits" },
              { key: "live", label: "Sessions Live" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`bg-pixel-blue text-white px-6 py-3 rounded-lg font-semibold hover:brightness-110 transition ${
                  activeTab === item.key
                    ? "no-border text-white shadow-lg"
                    : "text-slate-800 no-border hover:bg-white/10 hover:bg-pixel-blue hover:bg-yellow-500 hover:text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <button className="text-red-400 text-left px-5 py-3 rounded-xl hover:bg-red-500/10 transition font-medium border-none outline-none bg-transparent">
          Déconnexion
        </button>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-12">

        {/* HEADER */}
        <div className="flex justify-between items-start mb-16">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              Bonjour 👋
            </h1>
            <p className="text-slate-500 mt-3 text-lg">
              Voici votre progression académique.
            </p>
          </div>

          <div className="px-6 py-3 rounded-full text-sm font-semibold bg-slate-900 text-white">
            Licence – Semestre 3
          </div>
        </div>

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-12">

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { label: "Cours actifs", value: "6" },
                { label: "Crédits validés", value: "72 / 180" },
                { label: "Prochaine session", value: "Finance – 14:00" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="relative bg-white p-10 rounded-b-3xl  shadow-sm hover:shadow-xl transition"
                >
                  <div className="absolute top-0 left-0 w-full h-[4px] bg-pixel-blue rounded-t-3xl" />
                  <p className="text-slate-500 mb-6 text-sm uppercase tracking-wide">
                    {item.label}
                  </p>
                  <h3 className="text-4xl font-semibold text-slate-900">
                    {item.value}
                  </h3>
                </div>
              ))}
            </div>

            {/* Progress Card */}
            <div className="bg-white p-10 rounded-3xl  shadow-sm">
              <h3 className="text-2xl font-semibold text-slate-900 mb-6">
                Progression globale
              </h3>
              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                <div className="h-full bg-pixel-blue" style={{ width: "40%" }} />
              </div>
              <p className="mt-4 text-slate-500">40% du programme complété</p>
            </div>

          </div>
        )}

        {/* COURSES */}
        {activeTab === "courses" && (
          <div className="grid md:grid-cols-2 gap-8">
            {[
  { id: "finance", title: "Finance d’entreprise" },
  { id: "data-analytics", title: "Data Analytics" },
  { id: "droit-affaires", title: "Droit des affaires" },
].map((course) => (
  <Link key={course.id} href={`/student/course/${course.id}`}>
    <div className="bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition cursor-pointer">
      <h3 className="text-xl font-semibold text-slate-900 mb-4">
        {course.title}
      </h3>
      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-pixel-blue"
          style={{ width: "65%" }}
        />
      </div>
      <p className="text-slate-500 text-sm">Progression : 65%</p>
    </div>
  </Link>
))}

          </div>
        )}

        {/* GRADES */}
        {activeTab === "grades" && (
          <div className="bg-white p-12 rounded-3xl  shadow-sm">
            <h3 className="text-3xl font-semibold text-slate-900 mb-6">
              Moyenne générale
            </h3>
            <p className="text-6xl font-semibold bg-pixel-blue bg-clip-text text-transparent">
              14.2 / 20
            </p>
          </div>
        )}

        {/* LIVE */}
        {activeTab === "live" && (
          <div className="bg-white p-12 rounded-3xl  shadow-sm text-center">
            <h3 className="text-3xl font-semibold text-slate-900 mb-10">
              Session en direct
            </h3>
            <button
              className="px-10 py-5 rounded-full text-white font-semibold bg-pixel-blue hover:opacity-90 transition"
            >
              Rejoindre maintenant
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
