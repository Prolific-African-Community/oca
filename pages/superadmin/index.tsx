"use client";

import { useState, useEffect } from "react";

const GRADIENT = "bg-pixel-blue";

/* ========================================================= */
/* ================= CREATE UNIVERSITY ====================== */
/* ========================================================= */

function CreateUniversity({ refresh }: { refresh: () => void }) {
  const [form, setForm] = useState({
    name: "",
    adminEmail: "",
    adminPassword: "",
    programs: [] as string[],
    courses: [] as string[],
  });

  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);

  const availablePrograms = ["Licence", "Master"];
  const availableCourses = [
    "Finance d’entreprise",
    "Comptabilité générale",
    "Microéconomie",
    "Data Analytics",
  ];

  const handleChange = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: "programs" | "courses", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || !form.adminEmail || !form.adminPassword) {
      alert("Champs obligatoires manquants.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/universities/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error();

      setCreated(true);
      refresh();

      setForm({
        name: "",
        adminEmail: "",
        adminPassword: "",
        programs: [],
        courses: [],
      });

      setTimeout(() => setCreated(false), 2000);
    } catch {
      alert("Erreur création université.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold text-slate-900">
        Création d’une université
      </h2>

      <div className="bg-white p-10 rounded-3xl shadow-sm space-y-8">
        <div className="grid md:grid-cols-2 gap-6">
          <input
            placeholder="Nom de l’université"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            className="border rounded-xl px-4 py-3"
          />
          <input
            placeholder="Email administrateur"
            value={form.adminEmail}
            onChange={(e) => handleChange("adminEmail", e.target.value)}
            className="border rounded-xl px-4 py-3"
          />
          <input
            placeholder="Mot de passe administrateur"
            type="password"
            value={form.adminPassword}
            onChange={(e) => handleChange("adminPassword", e.target.value)}
            className="border rounded-xl px-4 py-3 md:col-span-2"
          />
        </div>

        <div>
          <h3 className="font-semibold mb-4">Programmes assignés</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {availablePrograms.map((program) => (
              <label key={program} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={form.programs.includes(program)}
                  onChange={() => toggleArrayField("programs", program)}
                />
                {program}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Cours disponibles</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {availableCourses.map((course) => (
              <label key={course} className="flex gap-3 p-4 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={form.courses.includes(course)}
                  onChange={() => toggleArrayField("courses", course)}
                />
                {course}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className={`px-8 py-4 rounded-full text-white font-semibold ${GRADIENT}`}
          >
            {loading ? "Création..." : "Créer l’université"}
          </button>
        </div>

        {created && (
          <div className="text-green-600 font-semibold">
            Université créée avec succès ✅
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================= */
/* ================= UNIVERSITIES LIST ====================== */
/* ========================================================= */

function UniversitiesList({ universities }: { universities: any[] }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm">
      <h3 className="text-2xl font-semibold mb-6">Universités enregistrées</h3>

      {universities.length === 0 && (
        <p className="text-slate-500">Aucune université enregistrée.</p>
      )}

      <div className="space-y-4">
        {universities.map((uni) => (
          <div key={uni.id} className="p-4 border rounded-xl">
            <p className="font-semibold">{uni.name}</p>
            <p className="text-sm text-slate-500">Admin : {uni.adminEmail}</p>
            <p className="text-sm text-slate-500">
              {uni.programs?.join(", ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================= */
/* ================= SUPERADMIN DASHBOARD =================== */
/* ========================================================= */

export default function SuperAdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [universities, setUniversities] = useState<any[]>([]);

  const fetchUniversities = () => {
    fetch("/api/universities/list")
      .then((res) => res.json())
      .then((data) => setUniversities(data));
  };

  useEffect(() => {
    fetchUniversities();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-100 to-white flex">
           
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
          <nav className="space-y-3">
            {[
              { key: "overview", label: "Vue globale" },
              { key: "universities", label: "Universités" },
              { key: "create", label: "Créer université" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`bg-pixel-blue text-white px-6 py-3 rounded-lg font-semibold hover:brightness-110 transition ${
                  activeTab === item.key
                    ? `${GRADIENT} text-white`
                    : "hover:bg-white/10 hover:bg-pixel-blue hover:bg-yellow-500 hover:text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      <main className="flex-1 p-12 space-y-10">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              Dashboard Super Admin
            </h1>
            <p className="text-slate-500 mt-2">
              Gestion globale des universités partenaires.
            </p>
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid md:grid-cols-3 gap-8">
            <StatCard label="Universités" value={universities.length} />
            <StatCard label="Programmes globaux" value="8" />
            <StatCard label="Cours totaux" value="42" />
          </div>
        )}

        {activeTab === "universities" && (
          <UniversitiesList universities={universities} />
        )}

        {activeTab === "create" && (
          <CreateUniversity refresh={fetchUniversities} />
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-pixel-blue rounded-t-3xl" />
      <p className="text-sm text-slate-500 uppercase mb-4">{label}</p>
      <h3 className="text-3xl font-semibold text-slate-900">{value}</h3>
    </div>
  );
}
