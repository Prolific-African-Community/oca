"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";


const GRADIENT = "bg-pixel-blue";

/* ========================================================= */
/* ================= CREATE STUDENT ========================= */
/* ========================================================= */

function CreateStudent({ refresh }: { refresh: () => void }) {
  const router = useRouter();
  
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
  
    if (!storedUser) {
      router.push("/login");
      return;
    }
  
    const user = JSON.parse(storedUser);
  
    if (user.role !== "admin") {
      router.push("/login");
    }
  
  }, []);
  
  const generatePassword = () => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 10 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  };

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    faculty: "Économie",
    program: "Licence",
    semester: "Semestre 1",
    courses: [] as string[],
    password: generatePassword(),
  });

  const [created, setCreated] = useState(false);
  const [loading, setLoading] = useState(false);

  const availableCourses = [
    "Finance d’entreprise",
    "Comptabilité générale",
    "Microéconomie",
    "Statistiques appliquées",
  ];

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCourse = (course: string) => {
    setForm((prev) => ({
      ...prev,
      courses: prev.courses.includes(course)
        ? prev.courses.filter((c) => c !== course)
        : [...prev.courses, course],
    }));
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email) {
      alert("Champs obligatoires manquants.");
      return;
    }

    setLoading(true);

    try {

      const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

      const res = await fetch("/api/students/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          universityId: currentUser.universityId
        }),
      });
      

      if (!res.ok) throw new Error();

      setCreated(true);
      refresh(); // 🔥 met à jour la liste instantanément

      setForm({
        firstName: "",
        lastName: "",
        email: "",
        faculty: "Économie",
        program: "Licence",
        semester: "Semestre 1",
        courses: [],
        password: generatePassword(),
      });

      setTimeout(() => setCreated(false), 2000);
    } catch {
      alert("Erreur création.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-semibold">Inscription étudiant</h2>

      <div className="bg-white p-10 rounded-3xl shadow-sm space-y-8">
        {/* INFOS PERSONNELLES */}
        <div className="grid md:grid-cols-2 gap-6">
          <input
            placeholder="Nom"
            value={form.lastName}
            onChange={(e) => handleChange("lastName", e.target.value)}
            className="border rounded-xl px-4 py-3"
          />
          <input
            placeholder="Prénom"
            value={form.firstName}
            onChange={(e) => handleChange("firstName", e.target.value)}
            className="border rounded-xl px-4 py-3"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => handleChange("email", e.target.value)}
            className="md:col-span-2 border rounded-xl px-4 py-3"
          />
        </div>

        {/* PASSWORD GENERATION */}
        <div className="bg-slate-50 p-6 rounded-xl border">
          <p className="text-sm text-slate-600 mb-2 font-medium">
            Mot de passe généré automatiquement
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="font-mono text-slate-800 text-lg">
              {form.password}
            </span>
            <button
              type="button"
              onClick={() => handleChange("password", generatePassword())}
              className="px-4 py-2 bg-pixel-blue text-white rounded-lg text-sm font-semibold hover:brightness-110 transition"
            >
              Régénérer
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <select
            value={form.faculty}
            onChange={(e) => handleChange("faculty", e.target.value)}
            className="border rounded-xl px-4 py-3"
          >
            <option>Économie</option>
            <option>Droit</option>
            <option>Informatique</option>
          </select>

          <select
            value={form.program}
            onChange={(e) => handleChange("program", e.target.value)}
            className="border rounded-xl px-4 py-3"
          >
            <option>Licence</option>
            <option>Master</option>
          </select>

          <select
            value={form.semester}
            onChange={(e) => handleChange("semester", e.target.value)}
            className="border rounded-xl px-4 py-3"
          >
            <option>Semestre 1</option>
            <option>Semestre 2</option>
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {availableCourses.map((course) => (
            <label
              key={course}
              className="flex gap-3 p-4 bg-slate-50 rounded-xl"
            >
              <input
                type="checkbox"
                checked={form.courses.includes(course)}
                onChange={() => toggleCourse(course)}
              />
              {course}
            </label>
          ))}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-8 py-4 rounded-full text-white bg-pixel-blue"
          >
            {loading ? "Création..." : "Créer l’étudiant"}
          </button>
        </div>

        {created && (
          <div className="text-green-600 font-semibold">
            Étudiant créé avec succès ✅
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================================================= */
/* ================= STUDENTS LIST ========================== */
/* ========================================================= */

function StudentsList({ students }: { students: any[] }) {
  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm">
      <h3 className="text-2xl font-semibold mb-6">
        Étudiants inscrits
      </h3>

      {students.length === 0 && (
        <p className="text-slate-500">Aucun étudiant inscrit.</p>
      )}

      <div className="space-y-4">
        {students.map((student) => (
          <div
            key={student.id}
            className="p-4 border rounded-xl"
          >
            <p className="font-semibold">
              {student.firstName} {student.lastName}
            </p>
            <p className="text-sm text-slate-500">
              {student.email}
            </p>
            <p className="text-sm text-slate-500">
              {student.faculty} — {student.program}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========================================================= */
/* ================= DASHBOARD ============================== */
/* ========================================================= */

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [students, setStudents] = useState<any[]>([]);

  const fetchStudents = () => {
    fetch("/api/students/list")
      .then((res) => res.json())
      .then((data) => setStudents(data));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex">

          
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
              { key: "students", label: "Étudiants" },
              { key: "create", label: "Inscription" },
              { key: "programs", label: "Programmes" },
              { key: "courses", label: "Cours" },
              { key: "teachers", label: "Professeurs" },
              { key: "settings", label: "Paramètres" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full bg-pixel-blue text-white px-6 py-3 rounded-lg font-semibold hover:brightness-110 transition ${
                  activeTab === item.key
                    ? "bg-gradient-to-r no-border text-white shadow-lg"
                    : "text-white no-border hover:bg-pixel-blue hover:bg-yellow-500 hover:text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 p-12 space-y-10">

                {/* HEADER */}
                <div className="flex justify-between items-start mb-16">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">
              Bonjour 👋
            </h1>
            <p className="text-slate-500 mt-3 text-lg">
              Gestion académique.
            </p>
          </div>

          <div className="px-6 py-3 rounded-full text-sm font-semibold bg-slate-900 text-white">
            Administrateur
          </div>
        </div>


        {activeTab === "overview" && (
          <div className="grid md:grid-cols-4 gap-8">
            <StatCard label="Étudiants inscrits" value={students.length} />
            <StatCard label="Programmes actifs" value="4" />
            <StatCard label="Cours disponibles" value="26" />
            <StatCard label="Sessions live" value="3" />
          </div>
        )}

        {activeTab === "students" && (
          <StudentsList students={students} />
        )}

        {activeTab === "create" && (
          <CreateStudent refresh={fetchStudents} />
        )}

        {["programs", "courses", "teachers", "settings"].includes(activeTab) && (
          <div className="bg-white p-10 rounded-3xl shadow-sm text-slate-500">
            Section en construction.
          </div>
        )}

      </main>
    </div>
  );
}



/* ========================================================= */
/* ================= STAT CARD ============================== */
/* ========================================================= */

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white p-8 rounded-b-3xl shadow-sm relative">
      <div className="absolute top-0 left-0 w-full h-1 bg-pixel-blue rounded-t-3xl" />
      <p className="text-sm text-slate-500 uppercase mb-4">{label}</p>
      <h3 className="text-3xl font-semibold">{value}</h3>
    </div>
  );
}
