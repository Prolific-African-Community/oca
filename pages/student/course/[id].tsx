import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

export default function CoursePage() {
  const router = useRouter();
  const { id } = router.query;

  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white flex">

      {/* COURSE SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white p-8 hidden md:flex flex-col">

          {/* Bouton précédent */}
  <Link href="/student">
    <a className="no-underline mb-10 inline-flex items-center gap-2 font-semibold text-sm text-slate-300 hover:text-white transition">
      ← Dashboard
    </a>
  </Link>

        <h2 className="text-xl font-semibold mb-12 capitalize">
          {id}
        </h2>

        <nav className="space-y-2">
          {[
            { key: "overview", label: "Aperçu" },
            { key: "modules", label: "Modules" },
            { key: "live", label: "Sessions Live" },
            { key: "evaluations", label: "Évaluations" },
            { key: "resources", label: "Ressources" },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key)}
              className={`bg-pixel-blue text-white w-full text-left px-4 py-3 rounded-xl transition ${
                activeTab === item.key
                  ? "bg-pixel-blue bg-yellow-500 text-white"
                  : "hover:bg-white/10 hover:text-white hover:tex-black"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-12">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
          <>
            <h1 className="text-4xl font-semibold mb-6 capitalize">
              {id}
            </h1>

            <p className="text-slate-600 mb-10">
              Description du cours et objectifs pédagogiques.
            </p>

            <div className="bg-white p-8 rounded-3xl shadow-sm">
              <h3 className="text-xl font-semibold mb-4">
                Progression globale
              </h3>

              <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-800 to-orange-500"
                  style={{ width: "45%" }}
                />
              </div>

              <p className="mt-4 text-slate-500">
                45% du cours complété
              </p>
            </div>
          </>
        )}

        {/* MODULES */}
{activeTab === "modules" && (
  <div className="space-y-6">

    {[
      { id: 1, title: "Introduction", progress: 100 },
      { id: 2, title: "Analyse financière", progress: 65 },
      { id: 3, title: "Cash Flow", progress: 0 },
    ].map((module) => {

      const isCompleted = module.progress === 100;
      const isLocked = module.progress === 0;

      return (
        <Link
          key={module.id}
          href={`/student/course/${id}/module/${module.id}`}
        >
          <a className="no-underline relative flex items-center gap-6 bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl transition duration-300 group">

            {/* Accent bar */}
            <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-800 to-orange-500 rounded-l-2xl opacity-0 group-hover:opacity-100 transition" />

            {/* Number */}
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 font-semibold text-slate-700">
              {module.id}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">
                {module.title}
              </h3>

              <div className="mt-3 w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-800 to-orange-500"
                  style={{ width: `${module.progress}%` }}
                />
              </div>

              <p className="text-sm text-slate-500 mt-2">
                {isCompleted
                  ? "Complété"
                  : module.progress > 0
                  ? `Progression : ${module.progress}%`
                  : "Non commencé"}
              </p>
            </div>

            {/* Status */}
            <div className="text-sm font-medium">
              {isCompleted && (
                <span className="text-green-600">✔</span>
              )}
              {!isCompleted && module.progress > 0 && (
                <span className="text-blue-600">●</span>
              )}
              {isLocked && (
                <span className="text-slate-400">🔒</span>
              )}
            </div>

          </a>
        </Link>
      );
    })}

  </div>
)}


        {/* LIVE */}
        {activeTab === "live" && (
          <div className="bg-white p-12 rounded-3xl shadow-sm text-center">
            <h3 className="text-3xl font-semibold mb-6">
              Prochaine session live
            </h3>

            <p className="text-slate-500 mb-8">
              Mardi – 14:00
            </p>

            <button className="px-8 py-4 rounded-full text-white bg-gradient-to-r from-blue-800 to-orange-500 hover:opacity-90 transition">
              Rejoindre la session
            </button>
          </div>
        )}

        {/* EVALUATIONS */}
        {activeTab === "evaluations" && (
          <div className="bg-white p-10 rounded-3xl shadow-sm">
            <h3 className="text-2xl font-semibold mb-6">
              Évaluations
            </h3>

            <p className="text-slate-600">
              1 devoir à rendre avant le 20 juin.
            </p>
          </div>
        )}

        {/* RESOURCES */}
        {activeTab === "resources" && (
          <div className="bg-white p-10 rounded-3xl shadow-sm">
            <h3 className="text-2xl font-semibold mb-6">
              Ressources téléchargeables
            </h3>

            <ul className="space-y-3 text-black">
              <li>📄 Support PDF</li>
              <li>📊 Slides PowerPoint</li>
              <li>📁 Étude de cas</li>
            </ul>
          </div>
        )}

      </main>
    </div>
  );
}


