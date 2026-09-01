import { useState } from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CheckIcon } from '../ui/icons'
import { StructuredLesson } from '../lesson/StructuredLesson'

/**
 * Édition d'une leçon section par section.
 *
 * Chaque section est enregistrée séparément : le serveur fusionne avec le
 * contenu existant, donc corriger l'introduction ne peut pas effacer les
 * exercices. Les leçons sans contenu structuré gardent l'ancien repli texte,
 * et le premier enregistrement les fait passer en structuré sans rien perdre.
 */

export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
export type Readiness = 'TOO_LIGHT' | 'ACCEPTABLE' | 'STRONG'

export interface StructuredContent {
  introduction: string
  keyConcepts: string[]
  explanation: string
  practicalExample: string
  recap: string
  exercises: string[]
}

export interface LessonQuality {
  contentLength: number
  structured: boolean
  missingSections: string[]
  warnings: string[]
  readiness: Readiness
  targetLength: number | null
}

export type VisibilityCode =
  | 'VISIBLE'
  | 'LESSON_DRAFT'
  | 'MODULE_DRAFT'
  | 'COURSE_NOT_PUBLISHED'

export interface Visibility {
  visible: boolean
  code: VisibilityCode
  label: string
  reason: string
}

export interface EditorLesson {
  id: string
  title: string
  order: number
  status: ContentStatus
  estimatedMinutes: number | null
  updatedAt: string
  structuredContent: StructuredContent | null
  plainContent: string | null
  quality: LessonQuality
  visibility: Visibility
}

export interface EditorModule {
  id: string
  title: string
  description: string | null
  order: number
  status: ContentStatus
  publishedLessonCount: number
  visibility: Visibility
  lessons: EditorLesson[]
}

export interface EditorReview {
  draftModules: number
  draftLessons: number
  tooLightLessons: number
  lessonsMissingSections: number
  publishedTooLight: number
  visibleLessons: number
  totalLessons: number
}

export interface EditorCourse {
  id: string
  title: string
  code: string
  credits: number
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
  program: { name: string; code: string }
  semester: { name: string; academicYear: string }
  assignmentRole: string
  review: EditorReview
  modules: EditorModule[]
}

/** Pastille de visibilite etudiante, formulation identique partout. */
export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <Badge tone={visibility.visible ? 'success' : 'neutral'}>
      {visibility.label}
    </Badge>
  )
}

const READINESS_LABELS: Record<Readiness, string> = {
  TOO_LIGHT: 'Trop léger',
  ACCEPTABLE: 'Acceptable',
  STRONG: 'Solide',
}

const READINESS_TONES: Record<Readiness, 'warning' | 'neutral' | 'success'> = {
  TOO_LIGHT: 'warning',
  ACCEPTABLE: 'neutral',
  STRONG: 'success',
}

const TEXT_SECTIONS = [
  { key: 'introduction', label: 'Introduction', rows: 4 },
  { key: 'explanation', label: 'Explication', rows: 10 },
  { key: 'practicalExample', label: 'Exemple pratique', rows: 6 },
  { key: 'recap', label: 'Récapitulatif', rows: 4 },
] as const

const LIST_SECTION_FIELDS = [
  {
    key: 'keyConcepts',
    label: 'Concepts clés',
    hint: 'Un concept par ligne',
    rows: 5,
  },
  {
    key: 'exercises',
    label: 'Exercices',
    hint: 'Un exercice par ligne',
    rows: 6,
  },
] as const

export type SectionKey = keyof StructuredContent
type SectionMode = 'GENERATE' | 'IMPROVE' | 'REGENERATE'

interface SectionPreview {
  generationId: string
  section: SectionKey
  mode: SectionMode
  text?: string
  items?: string[]
}

const LIST_SECTIONS: SectionKey[] = ['keyConcepts', 'exercises']

const isList = (section: SectionKey) => LIST_SECTIONS.includes(section)

const MODE_LABELS: Record<SectionMode, string> = {
  GENERATE: 'Générer',
  IMPROVE: 'Améliorer',
  REGENERATE: 'Régénérer',
}

const EMPTY: StructuredContent = {
  introduction: '',
  keyConcepts: [],
  explanation: '',
  practicalExample: '',
  recap: '',
  exercises: [],
}

const SECTION_LABELS: Record<SectionKey, string> = {
  introduction: 'Introduction',
  keyConcepts: 'Concepts clés',
  explanation: 'Explication',
  practicalExample: 'Exemple pratique',
  recap: 'Récapitulatif',
  exercises: 'Exercices',
}

/** Barre d'actions commune à toutes les sections : manuel d'abord, IA ensuite. */
function SectionActions({
  sectionKey,
  empty,
  saving,
  aiBusy,
  onSave,
  onReset,
  onAi,
  onClear,
  confirmClear,
  onAskClear,
  onCancelClear,
}: {
  sectionKey: SectionKey
  empty: boolean
  saving: boolean
  aiBusy: string | null
  onSave: () => void
  onReset: () => void
  onAi: (mode: SectionMode) => void
  onClear: () => void
  confirmClear: boolean
  onAskClear: () => void
  onCancelClear: () => void
}) {
  const busy = (mode: SectionMode) => aiBusy === `${sectionKey}:${mode}`
  const anyBusy = aiBusy !== null

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-3">
        <Button size="md" loading={saving} onClick={onSave}>
          Enregistrer
        </Button>

        <span aria-hidden="true" className="text-ink/15 hidden sm:inline">
          |
        </span>

        {empty ? (
          <Button
            size="md"
            variant="secondary"
            loading={busy('GENERATE')}
            disabled={anyBusy && !busy('GENERATE')}
            onClick={() => onAi('GENERATE')}
          >
            Générer
          </Button>
        ) : (
          <>
            <Button
              size="md"
              variant="secondary"
              loading={busy('IMPROVE')}
              disabled={anyBusy && !busy('IMPROVE')}
              onClick={() => onAi('IMPROVE')}
            >
              Améliorer
            </Button>
            <Button
              size="md"
              variant="secondary"
              loading={busy('REGENERATE')}
              disabled={anyBusy && !busy('REGENERATE')}
              onClick={() => onAi('REGENERATE')}
            >
              Régénérer
            </Button>
          </>
        )}

        <button
          onClick={onReset}
          className="text-ink/50 text-sm font-medium hover:underline"
        >
          Rétablir
        </button>

        {!empty && !confirmClear && (
          <button
            onClick={onAskClear}
            className="ml-auto text-sm font-medium text-red-500 hover:underline"
          >
            Effacer
          </button>
        )}
      </div>

      {confirmClear && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-800">
            Effacer le contenu de « {SECTION_LABELS[sectionKey]} » ? Cette
            section sera vidée.
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <Button size="md" loading={saving} onClick={onClear}>
              Oui, effacer
            </Button>
            <button
              onClick={onCancelClear}
              className="text-ink/60 text-sm font-medium hover:underline"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Textarea({
  value,
  rows,
  onChange,
}: {
  value: string
  rows: number
  onChange: (v: string) => void
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] leading-relaxed text-ink transition-all duration-200 hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
    />
  )
}

export function LessonSectionEditor({
  lesson,
  moduleTitle,
  busy,
  onSaved,
  onToast,
  onPublish,
  onDelete,
}: {
  lesson: EditorLesson
  moduleTitle: string
  busy: boolean
  onSaved: () => Promise<void> | void
  onToast: (title: string, description?: string, error?: boolean) => void
  onPublish: (
    published: boolean,
    confirm?: boolean
  ) => Promise<{ needsConfirm: boolean; message?: string } | void>
  onDelete: (
    confirm?: boolean
  ) => Promise<{ needsConfirm: boolean; message?: string } | void>
}) {
  const initial = lesson.structuredContent ?? {
    ...EMPTY,
    explanation: lesson.plainContent ?? '',
  }

  const [draft, setDraft] = useState<StructuredContent>(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [plain, setPlain] = useState(lesson.plainContent ?? '')

  // Une seule action IA à la fois, et un seul aperçu ouvert.
  const [aiBusy, setAiBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<SectionPreview | null>(null)
  const [confirmClear, setConfirmClear] = useState<SectionKey | null>(null)
  const [aiError, setAiError] = useState('')

  // Publication d'une lecon signalee comme faible : confirmation explicite.
  const [publishWarning, setPublishWarning] = useState<string | null>(null)
  const [showStudentPreview, setShowStudentPreview] = useState(false)

  // Suppression : jamais en un clic. On demande, puis on confirme.
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const isStructured = lesson.structuredContent !== null
  const published = lesson.status === 'PUBLISHED'

  const saveSection = async (
    field: keyof StructuredContent,
    value: string | string[]
  ) => {
    setSaving(field)
    try {
      const response = await fetch(
        `/api/teacher/lessons/${lesson.id}/structured-content`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Enregistrement impossible')

      await onSaved()
      onToast('Section enregistrée')
    } catch (err: any) {
      onToast('Enregistrement impossible', err.message, true)
    } finally {
      setSaving(null)
    }
  }

  const runAi = async (section: SectionKey, mode: SectionMode) => {
    setAiBusy(`${section}:${mode}`)
    setAiError('')
    try {
      const response = await fetch(
        `/api/teacher/lessons/${lesson.id}/ai/section`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, mode }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        // 429 : quota atteint. Ce n'est pas une panne, le message le dit.
        throw new Error(
          data.message ||
            (response.status === 429
              ? 'Limite de générations atteinte. Réessayez plus tard.'
              : 'Génération impossible')
        )
      }

      setPreview({
        generationId: data.id,
        section,
        mode,
        text: data.preview?.text,
        items: data.preview?.items,
      })
    } catch (err: any) {
      setAiError(err.message || 'Génération impossible')
      onToast('Assistant indisponible', err.message, true)
    } finally {
      setAiBusy(null)
    }
  }

  const applyPreview = async () => {
    if (!preview) return
    const value = isList(preview.section)
      ? preview.items ?? []
      : preview.text ?? ''

    setAiBusy('apply')
    try {
      const response = await fetch(
        `/api/teacher/lessons/${lesson.id}/structured-content`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            [preview.section]: value,
            intent: 'APPLY_AI',
            aiGenerationId: preview.generationId,
          }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Application impossible')

      setDraft((p) => ({ ...p, [preview.section]: value }))
      setPreview(null)
      await onSaved()
      onToast('Section appliquée')
    } catch (err: any) {
      onToast('Application impossible', err.message, true)
    } finally {
      setAiBusy(null)
    }
  }

  const clearSection = async (section: SectionKey) => {
    const value = isList(section) ? [] : ''
    setSaving(section)
    try {
      const response = await fetch(
        `/api/teacher/lessons/${lesson.id}/structured-content`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [section]: value, intent: 'CLEAR' }),
        }
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Effacement impossible')

      setDraft((p) => ({ ...p, [section]: value }))
      setConfirmClear(null)
      await onSaved()
      onToast('Section effacée')
    } catch (err: any) {
      onToast('Effacement impossible', err.message, true)
    } finally {
      setSaving(null)
    }
  }

  const savePlain = async () => {
    setSaving('plain')
    try {
      const response = await fetch(`/api/teacher/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: plain }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Enregistrement impossible')

      await onSaved()
      onToast('Contenu enregistré')
    } catch (err: any) {
      onToast('Enregistrement impossible', err.message, true)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink/45 text-sm">{moduleTitle}</p>
            <h2 className="text-xl font-medium tracking-tightest text-ink">
              {lesson.order + 1}. {lesson.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={published ? 'success' : 'warning'}>
              {published ? 'Publiée' : 'Brouillon'}
            </Badge>
            <Badge tone={READINESS_TONES[lesson.quality.readiness]}>
              {READINESS_LABELS[lesson.quality.readiness]}
            </Badge>
            <VisibilityBadge visibility={lesson.visibility} />
          </div>
        </div>

        <p className="text-ink/45 mt-3 text-sm">
          {isStructured ? 'Structurée' : 'Texte simple'} ·{' '}
          {lesson.quality.contentLength} caractères
          {lesson.quality.targetLength
            ? ` · ~${lesson.quality.targetLength} attendus pour ${lesson.estimatedMinutes} min`
            : ' · durée non précisée'}
        </p>

        {lesson.quality.warnings.length > 0 && (
          <ul className="mt-3 space-y-1">
            {lesson.quality.warnings.map((warning) => (
              <li key={warning} className="text-sm text-amber-600">
                • {warning}
              </li>
            ))}
          </ul>
        )}

        <p className="text-ink/45 mt-3 text-sm">{lesson.visibility.reason}</p>

        <p className="text-ink/40 mt-3 text-xs">
          Indicateur de relecture, pas une évaluation académique : la décision de
          publier reste la vôtre.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {published ? (
            <Button
              variant="secondary"
              size="md"
              loading={busy}
              onClick={() => onPublish(false)}
            >
              Dépublier la leçon
            </Button>
          ) : (
            <Button
              size="md"
              loading={busy}
              onClick={async () => {
                setPublishWarning(null)
                const result = await onPublish(true)
                if (result && result.needsConfirm) {
                  setPublishWarning(result.message ?? null)
                }
              }}
            >
              <CheckIcon size={16} /> Publier la leçon
            </Button>
          )}

          <button
            onClick={() => setShowStudentPreview((v) => !v)}
            className="text-sm font-medium text-apple hover:underline"
          >
            {showStudentPreview ? 'Masquer' : 'Voir'} l’aperçu étudiant
          </button>

          {!deleteWarning && (
            <button
              onClick={async () => {
                setDeleting(true)
                const result = await onDelete()
                setDeleting(false)
                // Une leçon sans conséquence est supprimée directement ;
                // sinon le serveur renvoie ce qui serait détruit.
                if (result && result.needsConfirm) {
                  setDeleteWarning(result.message ?? 'Supprimer cette leçon ?')
                }
              }}
              disabled={deleting}
              className="text-sm font-medium text-red-500 hover:underline disabled:opacity-50"
            >
              Supprimer la leçon
            </button>
          )}
        </div>

        {deleteWarning && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">{deleteWarning}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Button
                size="md"
                loading={deleting}
                onClick={async () => {
                  setDeleting(true)
                  await onDelete(true)
                  setDeleting(false)
                  setDeleteWarning(null)
                }}
              >
                Oui, supprimer définitivement
              </Button>
              <button
                onClick={() => setDeleteWarning(null)}
                className="text-ink/60 text-sm font-medium hover:underline"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        {publishWarning && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm text-amber-800">{publishWarning}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <Button
                size="md"
                loading={busy}
                onClick={async () => {
                  await onPublish(true, true)
                  setPublishWarning(null)
                }}
              >
                Publier quand même
              </Button>
              <button
                onClick={() => setPublishWarning(null)}
                className="text-ink/60 text-sm font-medium hover:underline"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </Card>

      {showStudentPreview && (
        <Card className="border-hairline bg-cloud/50">
          <CardHeader
            title="Aperçu étudiant"
            action={<VisibilityBadge visibility={lesson.visibility} />}
          />
          <p className="text-ink/45 mb-1 text-sm">
            Rendu du contenu <strong>enregistré</strong> : vos modifications
            non enregistrées n’y figurent pas.
          </p>
          {!lesson.visibility.visible && (
            <p className="mb-1 text-sm text-amber-600">
              {lesson.visibility.reason}
            </p>
          )}
          {lesson.structuredContent ? (
            <StructuredLesson content={lesson.structuredContent} />
          ) : (
            <p className="mt-4 whitespace-pre-wrap text-[16px] leading-relaxed text-ink/75">
              {lesson.plainContent || 'Aucun contenu rédigé.'}
            </p>
          )}
        </Card>
      )}

      {lesson.structuredContent === null && (
        <Card>
          <CardHeader title="Contenu (texte simple)" />
          <p className="text-ink/45 mb-3 text-sm">
            Cette leçon n’a pas encore de contenu structuré. Enregistrer une
            section ci-dessous la convertira en conservant ce texte comme
            explication.
          </p>
          <Textarea value={plain} rows={10} onChange={setPlain} />
          <Button
            size="md"
            className="mt-3"
            loading={saving === 'plain'}
            onClick={savePlain}
          >
            Enregistrer le texte
          </Button>
        </Card>
      )}

      {preview && (
        <Card className="border-apple/40 bg-oca-tint/40">
          <CardHeader
            title={`Aperçu — ${MODE_LABELS[preview.mode]}`}
            action={<Badge tone="warning">Brouillon IA à relire</Badge>}
          />
          <p className="text-ink/45 mb-3 text-sm">
            Rien n’est enregistré tant que vous n’avez pas appliqué cet aperçu.
          </p>
          {isList(preview.section) ? (
            <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-ink/75">
              {(preview.items ?? []).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink/75">
              {preview.text}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              size="md"
              loading={aiBusy === 'apply'}
              onClick={applyPreview}
            >
              Appliquer à « {SECTION_LABELS[preview.section]} »
            </Button>
            <button
              onClick={() => setPreview(null)}
              className="text-ink/50 text-sm font-medium hover:underline"
            >
              Annuler
            </button>
          </div>
        </Card>
      )}

      {aiError && !preview && (
        <div
          role="alert"
          className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
        >
          {aiError}
        </div>
      )}

      {TEXT_SECTIONS.map((section) => (
        <Card key={section.key}>
          <CardHeader
            title={section.label}
            action={
              lesson.quality.missingSections.includes(section.key) ? (
                <Badge tone="warning">Manquant</Badge>
              ) : null
            }
          />
          <Textarea
            value={draft[section.key]}
            rows={section.rows}
            onChange={(v) => setDraft((p) => ({ ...p, [section.key]: v }))}
          />
          <SectionActions
            sectionKey={section.key}
            empty={!draft[section.key].trim()}
            saving={saving === section.key}
            aiBusy={aiBusy}
            onSave={() => saveSection(section.key, draft[section.key])}
            onReset={() =>
              setDraft((p) => ({ ...p, [section.key]: initial[section.key] }))
            }
            onAi={(mode) => runAi(section.key, mode)}
            onClear={() => clearSection(section.key)}
            confirmClear={confirmClear === section.key}
            onAskClear={() => setConfirmClear(section.key)}
            onCancelClear={() => setConfirmClear(null)}
          />
        </Card>
      ))}

      {LIST_SECTION_FIELDS.map((section) => (
        <Card key={section.key}>
          <CardHeader
            title={section.label}
            action={
              lesson.quality.missingSections.includes(section.key) ? (
                <Badge tone="warning">Manquant</Badge>
              ) : null
            }
          />
          <p className="text-ink/45 mb-2 text-sm">{section.hint}</p>
          <Textarea
            value={draft[section.key].join('\n')}
            rows={section.rows}
            onChange={(v) =>
              setDraft((p) => ({ ...p, [section.key]: v.split('\n') }))
            }
          />
          <SectionActions
            sectionKey={section.key}
            empty={draft[section.key].filter((i) => i.trim()).length === 0}
            saving={saving === section.key}
            aiBusy={aiBusy}
            onSave={() =>
              saveSection(
                section.key,
                draft[section.key].map((item) => item.trim()).filter(Boolean)
              )
            }
            onReset={() =>
              setDraft((p) => ({ ...p, [section.key]: initial[section.key] }))
            }
            onAi={(mode) => runAi(section.key, mode)}
            onClear={() => clearSection(section.key)}
            confirmClear={confirmClear === section.key}
            onAskClear={() => setConfirmClear(section.key)}
            onCancelClear={() => setConfirmClear(null)}
          />
        </Card>
      ))}
    </div>
  )
}
