"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

const GRADIENT =
  "bg-gradient-to-r from-blue-800 to-orange-500";

export default function ModulePage() {
  const router = useRouter();

  const [courseId, setCourseId] = useState<string | null>(null);
  const [currentModule, setCurrentModule] = useState<number | null>(null);

  const totalModules = 3;

  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizValidated, setQuizValidated] = useState(false);
  const [completed, setCompleted] = useState(false);

  const correctAnswer = 1;

  useEffect(() => {
    if (router.isReady) {
      const { id, moduleId } = router.query;

      if (typeof id === "string") {
        setCourseId(id);
      }

      if (typeof moduleId === "string") {
        setCurrentModule(Number(moduleId));
      }
    }
  }, [router.isReady, router.query]);

  const validateQuiz = () => {
    if (quizAnswer === correctAnswer) {
      setQuizValidated(true);
    } else {
      alert("Réponse incorrecte. Réessayez.");
    }
  };

  const validateModule = () => {
    if (!quizValidated) {
      alert("Vous devez valider le quiz avant.");
      return;
    }
    setCompleted(true);
    alert("Module validé 🎉");
  };

  if (!courseId || currentModule === null) {
    return null;
  }

  return (
    <div className="no-underline min-h-screen bg-gradient-to-b from-white via-slate-50 to-white p-12">

      {/* Breadcrumb */}
      <div className="no-underline mb-6 text-sm text-slate-600">
        <Link href="/student">
          <a className="no-underline hover:text-blue-700">Dashboard</a>
        </Link>
        {"  >  "}
        <Link href={`/student/course/${courseId}`}>
          <a className="no-underline hover:text-blue-700">{courseId}</a>
        </Link>
        {"  >  "}
        <span className="text-black font-medium">
          Module {currentModule}
        </span>
      </div>

      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-semibold text-slate-900">
          Module {currentModule} – Analyse Financière
        </h1>
        <p className="text-slate-500 mt-3">
          Module {currentModule} sur {totalModules}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-10">

        {/* MAIN */}
        <div className="lg:col-span-2 space-y-12">

          {/* Video */}
          <div className="bg-white p-8 rounded-3xl shadow-sm">
            <h2 className="text-xl font-semibold mb-6">
              🎥 Vidéo explicative
            </h2>
            <div className="aspect-video bg-slate-200 rounded-xl flex items-center justify-center">
              <span className="text-slate-500">
                Intégration vidéo ici
              </span>
            </div>
          </div>

          {/* Lecture */}
          <div className="bg-white p-8 rounded-3xl shadow-sm">
            <h2 className="text-xl font-semibold mb-6">
              📚 Lecture académique
            </h2>
            <p className="text-slate-600 leading-relaxed">
              L'analyse financière permet d'évaluer la performance d'une entreprise
              en étudiant ses états financiers. Elle repose sur plusieurs indicateurs
              tels que la rentabilité, la solvabilité et la liquidité.
            </p>
          </div>

          {/* Quiz */}
          <div className="bg-white p-8 rounded-3xl shadow-sm">
            <h2 className="text-xl font-semibold mb-6">
              🧠 Quiz de validation
            </h2>

            <p className="mb-6">
              Quel indicateur mesure la rentabilité d'une entreprise ?
            </p>

            <div className="space-y-4">
              {[
                "Le taux d'endettement",
                "Le ROE",
                "Le besoin en fonds de roulement",
              ].map((option, index) => (
                <button
                  key={index}
                  onClick={() => setQuizAnswer(index)}
                  className={`w-full text-left px-6 py-4 rounded-xl border transition ${
                    quizAnswer === index
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={validateQuiz}
              className={`mt-6 px-8 py-3 rounded-full text-white ${GRADIENT}`}
            >
              Valider le quiz
            </button>

            {quizValidated && (
              <p className="mt-4 text-green-600 font-medium">
                Quiz validé ✅
              </p>
            )}
          </div>

          {/* Validation */}
          <div className="text-center">
            <button
              onClick={validateModule}
              className={`px-10 py-4 rounded-full text-white font-semibold ${GRADIENT}`}
            >
              Valider le module
            </button>

            {completed && (
              <p className="mt-6 text-green-600 font-medium">
                Module complété 🎓
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-12">

            {currentModule > 1 ? (
              <Link href={`/student/course/${courseId}/module/${currentModule - 1}`}>
                <a className="font-semibold no-underline px-6 py-3 rounded-xl bg-slate-200 hover:bg-slate-200 transition inline-block">
                  Précédent
                </a>
              </Link>
            ) : (
              <div />
            )}

            {currentModule < totalModules ? (
              <Link href={`/student/course/${courseId}/module/${currentModule + 1}`}>
                <a className={`no-underline px-6 py-3 rounded-xl bg-black text-white hover:opacity-90 transition inline-block`}>
                  Suivant
                </a>
              </Link>
            ) : (
              <div />
            )}

          </div>
        </div>

        {/* Sidebar */}
        <div className="bg-white p-8 rounded-3xl shadow-sm h-fit">
          <h3 className="no-underline text-lg font-semibold mb-6">
            Modules du cours
          </h3>

          <ul className="space-y-4">
            {[1, 2, 3].map((m) => (
              <li key={m}>
                <Link href={`/student/course/${courseId}/module/${m}`}>
                  <a
                    className={`no-underline block px-4 py-2 rounded-lg transition ${
                      m === currentModule
                        ? "no-underline bg-slate-100 text-black font-semibold"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    Module {m}
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
