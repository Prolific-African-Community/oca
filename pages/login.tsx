"use client";

import { useState } from "react";
import { useRouter } from "next/router";

const TITLE_GRADIENT =
  "bg-pixel-blue bg-clip-text text-transparent";

const ACCENT_GRADIENT =
  "bg-pixel-blue";

const CARD_GLOW =
  "hover:shadow-[0_30px_80px_-20px_rgba(30,64,175,0.25)]";

export default function LoginPage() {
  const router = useRouter();

  const [role, setRole] = useState<"student" | "partner" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const user = await res.json();

      if (!res.ok) {
        throw new Error(user.message || "Erreur de connexion");
      }

      localStorage.setItem("user", JSON.stringify(user));


      // Redirection selon rôle
      if (user.role === "superadmin") {
        router.push("/superadmin");
      } else if (user.role === "admin") {
        router.push("/admin");
      } else if (user.role === "student") {
        router.push("/student");
      } else {
        throw new Error("Rôle inconnu");
      }

    } catch (err: any) {
      setError(err.message || "Erreur serveur");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-100 to-white px-6 flex items-center justify-center">
      <div className="max-w-5xl w-full">

        <div className="text-center mb-16">
          
          <p className="text-slate-600 mt-6 text-lg">
            Connectez-vous pour accéder à votre espace.
          </p>
        </div>


        {/* Formulaire */}
        <div className="bg-white border border-slate-200 rounded-3xl p-12 shadow-xl transition-all duration-500">
          <h3 className="text-3xl font-semibold text-slate-900 mb-10 text-center">
            Connexion
          </h3>

          <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Mot de passe
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 transition"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full px-8 py-4 rounded-full text-white font-semibold outline-none border-none hover:opacity-90 transition ${ACCENT_GRADIENT}`}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>

          </form>
        </div>

      </div>
    </main>
  );
}


