import { useEffect, useState } from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button, buttonClasses } from '../ui/Button'
import { Input } from '../ui/Input'
import { SparkIcon } from '../ui/icons'
import { StructuredLesson } from '../lesson/StructuredLesson'
import { structuredLessonContentFromDraft } from '../../lib/lessonContent'
import { useCourseDraft } from '../../lib/useCourseDraft'
import type {
  DraftLessonPreview,
  DraftModulePreview,
} from '../../lib/useCourseDraft'

/**
 * Construction assistée d'un cours, à l'intérieur du Course Studio.
 *
 * Remplace le tiroir latéral : l'enseignant reste dans son atelier, voit
 * l'avancement, relit l'aperçu, puis applique. Le brouillon appliqué arrive
 * en DRAFT — aucune publication automatique, aucune donnée étudiante envoyée.
 */

/**
 * Étapes affichées pendant l'attente.
 *
 * Honnêteté nécessaire : la route renvoie **une seule réponse**, sans flux
 * intermédiaire. Ces étapes décrivent ce que le modèle produit, elles ne
 * mesurent pas sa progression réelle. Le panneau le dit à l'écran plutôt que
 * de laisser croire à un suivi en temps réel.
 */
const STAGES = [
  'Préparation du plan de cours',
  'Génération des modules',
  'Rédaction des leçons',
  'Ajout des concepts clés',
  'Ajout des exemples et exercices',
  'Contrôle de qualité',
] as const

/** Cadence indicative, calée sur la durée habituelle d'une génération. */
const STAGE_INTERVAL_MS = 6000

function StageList({ active }: { active: number }) {
  return (
    <ul className="mt-4 space-y-2">
      {STAGES.map((stage, index) => {
        const done = index < active
        const current = index === active
        return (
          <li key={stage} className="flex items-center gap-3 text-sm">
            <span
              className={
                'grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] ' +
                (done
                  ? 'bg-emerald-50 text-emerald-600'
                  : current
                  ? 'bg-oca-tint text-oca'
                  : 'bg-cloud text-ink/35')
              }
            >
              {done ? '✓' : index + 1}
            </span>
            <span
              className={
                done ? 'text-ink/50' : current ? 'text-ink' : 'text-ink/35'
              }
            >
              {stage}
            </span>
            {current && (
              <span
                aria-hidden="true"
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-oca border-t-transparent"
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Détail d'une leçon du brouillon, tel qu'il sera enregistré.
 *
 * Le rendu passe par `structuredLessonContentFromDraft`, la fonction employée
 * à l'application : ce que l'enseignant lit ici est exactement ce qui sera
 * créé, et non une mise en forme approchée. Le composant d'affichage est
 * celui de la page étudiante, pour la même raison.
 */
function LessonDetail({ lesson }: { lesson: DraftLessonPreview }) {
  const [copied, setCopied] = useState<'ok' | 'ko' | null>(null)

  const content = structuredLessonContentFromDraft({
    title: lesson.title,
    estimatedMinutes: lesson.estimatedMinutes,
    content: lesson.content,
    keyConcepts: lesson.keyConcepts ?? [],
    recap: lesson.recap ?? '',
    practicalExample: lesson.practicalExample ?? '',
    exercises: lesson.exercises ?? [],
  })

  const copy = async () => {
    const text = [
      lesson.title,
      content.introduction,
      content.keyConcepts.join('\n'),
      content.explanation,
      content.practicalExample,
      content.recap,
      content.exercises.join('\n'),
    ]
      .filter((part) => part && part.trim())
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied('ok')
    } catch {
      // Le presse-papiers peut être refusé par le navigateur : on le dit.
      setCopied('ko')
    }
  }

  const missing = [
    !content.introduction.trim() && 'introduction',
    content.keyConcepts.length === 0 && 'concepts clés',
    !content.explanation.trim() && 'explication',
    !content.practicalExample.trim() && 'exemple pratique',
    !content.recap.trim() && 'récapitulatif',
    content.exercises.length === 0 && 'exercices',
  ].filter(Boolean) as string[]

  return (
    <div className="mt-3 rounded-card border border-hairline bg-cloud/40 p-4">
      {missing.length > 0 && (
        <p className="mb-2 text-sm text-amber-600">
          Sections absentes : {missing.join(', ')}.
        </p>
      )}

      <StructuredLesson content={content} />

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={copy}
          className="text-sm font-medium text-apple hover:underline"
        >
          Copier le texte de la leçon
        </button>
        {copied === 'ok' && (
          <span className="text-sm text-emerald-700">Copié.</span>
        )}
        {copied === 'ko' && (
          <span className="text-sm text-amber-600">
            Copie refusée par le navigateur.
          </span>
        )}
      </div>
    </div>
  )
}

/** Aperçu des quiz d'un module : intitulés, questions et bonnes réponses. */
function QuizDetail({ module }: { module: DraftModulePreview }) {
  return (
    <div className="mt-3 space-y-3">
      {module.quizzes.map((quiz, index) => (
        <div
          key={`${quiz.title}-${index}`}
          className="rounded-card border border-hairline bg-white p-4"
        >
          <p className="text-[15px] font-medium text-ink">{quiz.title}</p>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink/70">
            {quiz.questions.map((question, questionIndex) => (
              <li key={questionIndex}>
                <p>{question.prompt}</p>
                {question.options?.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-ink/55">
                    {question.options.map((option, optionIndex) => (
                      <li key={optionIndex}>
                        {Array.isArray(question.correctAnswer) &&
                        question.correctAnswer.includes(optionIndex)
                          ? '✓ '
                          : '· '}
                        {option}
                      </li>
                    ))}
                  </ul>
                )}
                {typeof question.correctAnswer === 'boolean' && (
                  <p className="mt-1 text-ink/55">
                    Réponse attendue : {question.correctAnswer ? 'vrai' : 'faux'}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="text-ink/40 mt-3 text-xs">
            Retour d’apprentissage, jamais une note officielle.
          </p>
        </div>
      ))}
    </div>
  )
}

export function CourseBuildPanel({
  courseId,
  hasModules,
  onClose,
  onApplied,
  onToast,
}: {
  courseId: string
  hasModules: boolean
  onClose: () => void
  /** Reçoit les compteurs créés pour rafraîchir et sélectionner la suite. */
  onApplied: (created: {
    modules: number
    lessons: number
    quizzes: number
  }) => Promise<void> | void
  onToast: (title: string, description?: string, error?: boolean) => void
}) {
  const draft = useCourseDraft(courseId)
  const [stage, setStage] = useState(0)

  /** Leçons dépliées, par « module:leçon ». */
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  /** A-t-on ouvert au moins une leçon ? Sert à rappeler la relecture. */
  const [reviewed, setReviewed] = useState(false)

  // Progression indicative : elle s'arrête à la dernière étape et attend la
  // réponse réelle, plutôt que d'annoncer une fin qui n'est pas advenue.
  useEffect(() => {
    if (draft.status !== 'GENERATING') {
      setStage(0)
      return
    }
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 1))
    }, STAGE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [draft.status])

  const { form, setForm, counts, generated } = draft

  // Petit brouillon : la première leçon est ouverte d'emblée. Gros brouillon :
  // tout reste replié pour rester lisible.
  useEffect(() => {
    if (draft.status !== 'PREVIEW' || !generated) return
    setExpanded(counts.lessons > 0 && counts.lessons <= 3 ? new Set(['0:0']) : new Set())
    setReviewed(counts.lessons > 0 && counts.lessons <= 3)
  }, [draft.status, generated, counts.lessons])

  const toggle = (key: string) => {
    setReviewed(true)
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const expandAll = () => {
    if (!generated) return
    setReviewed(true)
    const keys: string[] = []
    generated.preview.modules.forEach((module, moduleIndex) =>
      module.lessons.forEach((_, lessonIndex) =>
        keys.push(`${moduleIndex}:${lessonIndex}`)
      )
    )
    setExpanded(new Set(keys))
  }
  const requestedModules = Number(form.moduleCount) || 0
  const requestedLessons = requestedModules * (Number(form.lessonsPerModule) || 0)
  const largeWithQuizzes = form.includeQuizzes && requestedLessons > 6

  const apply = async () => {
    const created = await draft.apply()
    if (!created) return
    onToast(
      'Brouillon appliqué',
      `${created.modules} module(s), ${created.lessons} leçon(s) et ${created.quizzes} quiz créés en brouillon.`
    )
    await onApplied(created)
  }

  return (
    <Card className="mb-5 border-apple/30">
      <CardHeader
        title="Construire avec l’assistant"
        action={
          <button
            onClick={onClose}
            disabled={draft.busy}
            className="text-ink/50 text-sm font-medium hover:underline disabled:opacity-40"
          >
            Fermer
          </button>
        }
      />

      <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <SparkIcon size={15} /> L’assistant produit un brouillon. Tout arrive en
        brouillon : vous relisez chaque module et chaque leçon, puis vous
        publiez vous-même.
      </div>

      {/* ---------------------------------------------------- configuration */}
      {draft.status === 'CONFIGURING' && (
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Objectif du cours (optionnel)
            </span>
            <textarea
              value={form.objective}
              onChange={(e) =>
                setForm((c) => ({ ...c, objective: e.target.value }))
              }
              maxLength={1200}
              rows={3}
              placeholder="Compétences ou résultats d’apprentissage recherchés…"
              className="w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] leading-relaxed text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
            />
            <span className="text-ink/40 mt-1 block text-right text-xs">
              {form.objective.length}/1200
            </span>
          </label>

          <Input
            label="Niveau cible (optionnel)"
            value={form.targetLevel}
            maxLength={200}
            placeholder="Ex. Licence 2 — intermédiaire"
            onChange={(e) =>
              setForm((c) => ({ ...c, targetLevel: e.target.value }))
            }
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Modules"
              type="number"
              min={1}
              max={8}
              hint="1 à 8"
              value={form.moduleCount}
              onChange={(e) =>
                setForm((c) => ({ ...c, moduleCount: e.target.value }))
              }
            />
            <Input
              label="Leçons / module"
              type="number"
              min={1}
              max={6}
              hint="30 leçons maximum au total"
              value={form.lessonsPerModule}
              onChange={(e) =>
                setForm((c) => ({ ...c, lessonsPerModule: e.target.value }))
              }
            />
          </div>

          <div className="rounded-card border border-hairline bg-cloud/60 p-4">
            <p className="text-sm font-medium text-ink">Complexité estimée</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral">{requestedModules} modules</Badge>
              <Badge tone="neutral">{requestedLessons} leçons</Badge>
              <Badge tone={form.includeQuizzes ? 'warning' : 'neutral'}>
                Quiz {form.includeQuizzes ? 'activés' : 'désactivés'}
              </Badge>
            </div>
            <p className="text-ink/50 mt-3 text-xs leading-relaxed">
              Pour une qualité optimale, commencez avec 2–3 modules et 2–3
              leçons par module.
            </p>
          </div>

          {largeWithQuizzes && (
            <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Les gros brouillons avec quiz sont plus longs et moins fiables.
              Les quiz pourront être omis pour préserver la qualité des leçons.
            </div>
          )}

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Mode d’ajout
            </span>
            <select
              value={form.mode}
              onChange={(e) => setForm((c) => ({ ...c, mode: e.target.value }))}
              className="h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
            >
              <option value="APPEND_ONLY">
                Ajouter après le contenu existant
              </option>
              <option value="EMPTY_COURSE_ONLY" disabled={hasModules}>
                Uniquement si le cours est vide
              </option>
            </select>
            {hasModules && (
              <span className="text-ink/45 mt-1 block text-xs">
                Le mode « cours vide » est indisponible : ce cours contient déjà
                des modules.
              </span>
            )}
          </label>

          <label className="flex items-start gap-3 rounded-card border border-hairline bg-white p-4">
            <input
              type="checkbox"
              checked={form.includeQuizzes}
              onChange={(e) =>
                setForm((c) => ({ ...c, includeQuizzes: e.target.checked }))
              }
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="block text-sm font-medium text-ink">
                Inclure des quiz formatifs brouillons
              </span>
              <span className="text-ink/45 mt-0.5 block text-xs">
                Jamais publiés automatiquement, jamais de note officielle.
              </span>
            </span>
          </label>

          <Button onClick={draft.generate}>Construire le brouillon</Button>
        </div>
      )}

      {/* ------------------------------------------------------ progression */}
      {draft.status === 'GENERATING' && (
        <div className="mt-5">
          <p className="text-[15px] font-medium text-ink">
            Construction en cours…
          </p>
          <StageList active={stage} />
          <p className="text-ink/40 mt-4 text-xs leading-relaxed">
            Étapes indicatives : l’assistant renvoie le brouillon complet en une
            seule fois, cette liste décrit ce qu’il produit, pas son avancement
            exact. Comptez une à trois minutes selon la taille demandée.
          </p>
        </div>
      )}

      {/* ---------------------------------------------------------- aperçu */}
      {draft.status === 'PREVIEW' && generated && (
        <div className="mt-5 space-y-4">
          <p className="text-[15px] leading-relaxed text-ink/60">
            {generated.preview.courseSummary}
          </p>

          <div className="flex flex-wrap gap-2">
            <Badge tone="warning">{counts.modules} modules brouillons</Badge>
            <Badge tone="neutral">{counts.lessons} leçons</Badge>
            <Badge tone="neutral">{counts.keyConcepts} concepts clés</Badge>
            <Badge tone="neutral">{counts.exercises} exercices</Badge>
            {counts.quizzes > 0 && (
              <Badge tone="neutral">
                {counts.quizzes} quiz · {counts.questions} questions
              </Badge>
            )}
          </div>

          <p className="text-ink/45 text-xs">
            Longueur moyenne : {counts.averageContentLength} caractères par
            leçon. Tout sera créé en brouillon.
          </p>

          {generated.warnings?.length > 0 &&
            generated.warnings.map((warning, index) => (
              <div
                key={`${warning.code}-${index}`}
                className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                {warning.message}
              </div>
            ))}

          <div className="flex flex-wrap items-center gap-3 border-t border-hairline pt-3">
            <span className="text-ink/50 text-sm">Contenu détaillé :</span>
            <button
              onClick={expandAll}
              className="text-sm font-medium text-apple hover:underline"
            >
              Tout déplier
            </button>
            <button
              onClick={() => setExpanded(new Set())}
              className="text-ink/50 text-sm font-medium hover:underline"
            >
              Tout replier
            </button>
          </div>

          <ul className="space-y-3">
            {generated.preview.modules.map((module, index) => (
              <li
                key={`${module.title}-${index}`}
                className="rounded-card border border-hairline bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink">
                      {index + 1}. {module.title}
                    </p>
                    <p className="mt-1 text-sm text-ink/50">
                      {module.description}
                    </p>
                  </div>
                  <Badge tone="warning">Brouillon</Badge>
                </div>
                <ul className="mt-3 space-y-2">
                  {module.lessons.map((lesson, lessonIndex) => {
                    const key = `${index}:${lessonIndex}`
                    const open = expanded.has(key)
                    return (
                      <li key={`${lesson.title}-${lessonIndex}`}>
                        <button
                          onClick={() => toggle(key)}
                          aria-expanded={open}
                          className="flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left text-sm text-ink/70 transition-colors hover:bg-cloud"
                        >
                          <span
                            aria-hidden="true"
                            className="text-ink/35 mt-0.5 shrink-0"
                          >
                            {open ? '▾' : '▸'}
                          </span>
                          <span className="min-w-0 flex-1">
                            {lesson.title} · {lesson.estimatedMinutes} min ·{' '}
                            {lesson.keyConcepts?.length ?? 0} concept(s) ·{' '}
                            {lesson.exercises?.length ?? 0} exercice(s)
                          </span>
                        </button>
                        {open && <LessonDetail lesson={lesson} />}
                      </li>
                    )
                  })}
                </ul>
                {module.quizzes.length > 0 && (
                  <>
                    <p className="mt-3 text-xs font-medium text-apple">
                      {module.quizzes.length} quiz ·{' '}
                      {module.quizzes.reduce(
                        (sum, quiz) => sum + quiz.questions.length,
                        0
                      )}{' '}
                      questions
                    </p>
                    <QuizDetail module={module} />
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="rounded-card border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Relisez le contenu généré avant d’appliquer. Les modules et leçons
            seront créés en brouillon, modifiables ensuite section par section
            dans le Studio.
            {!reviewed && (
              <span className="mt-1 block font-medium">
                Vous n’avez encore ouvert aucune leçon.
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={apply}>Appliquer le brouillon</Button>
            <button
              onClick={draft.reset}
              className="text-ink/50 text-sm font-medium hover:underline"
            >
              Recommencer
            </button>
            <button
              onClick={onClose}
              className="text-ink/50 text-sm font-medium hover:underline"
            >
              Abandonner
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------- écritures */}
      {draft.status === 'APPLYING' && (
        <p className="mt-5 text-[15px] text-ink/60">
          Création des modules et des leçons en brouillon…
        </p>
      )}

      {draft.status === 'APPLIED' && (
        <p className="mt-5 text-[15px] text-emerald-700">
          Brouillon appliqué. Les contenus sont dans la navigation, en
          brouillon : relisez-les avant toute publication.
        </p>
      )}

      {/* ------------------------------------------------------------ échec */}
      {draft.status === 'FAILED' && (
        <div className="mt-5 space-y-3">
          <div
            role="alert"
            className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {draft.error}
            {draft.failureReason && (
              <span className="mt-1 block text-xs text-red-500">
                Dernier motif : {draft.failureReason}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={draft.reset}
              className={buttonClasses('secondary', 'md')}
            >
              Reprendre la configuration
            </button>
            <button
              onClick={onClose}
              className="text-ink/50 text-sm font-medium hover:underline"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
