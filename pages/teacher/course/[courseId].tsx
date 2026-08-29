import { requireAssignedCoursePage } from '../../../lib/pageGuard'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { AppShell } from '../../../components/app/AppShell'
import { Card, CardHeader } from '../../../components/ui/Card'
import { Badge } from '../../../components/ui/Badge'
import { Button, buttonClasses } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/Input'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Reveal } from '../../../components/anim/Reveal'
import { Drawer } from '../../../components/overlay/Drawer'
import { useToast } from '../../../components/overlay/Toast'
import { QuizPanel } from '../../../components/teacher/QuizPanel'
import { AnalyticsPanel } from '../../../components/teacher/AnalyticsPanel'
import {
  BookIcon,
  LayersIcon,
  PlusIcon,
  ChevronRightIcon,
} from '../../../components/ui/icons'

type Status = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

interface Lesson {
  id: string
  title: string
  content: string | null
  order: number
  estimatedMinutes: number | null
  status: Status
}

interface Module {
  id: string
  title: string
  description: string | null
  order: number
  status: Status
  lessons: Lesson[]
}

interface CourseDetail {
  id: string
  title: string
  code: string
  description: string | null
  credits: number
  coefficient: number
  status: string
  program: { name: string; code: string }
  semester: { name: string; academicYear: string }
  assignmentRole: 'LEAD' | 'CO_TEACHER' | 'ASSISTANT'
  modules: Module[]
}

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: 'Brouillon',
  PUBLISHED: 'Publié',
  ARCHIVED: 'Archivé',
}

const STATUS_TONES: Record<Status, 'neutral' | 'success' | 'warning'> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'neutral',
}

const ROLE_LABELS: Record<CourseDetail['assignmentRole'], string> = {
  LEAD: 'Responsable',
  CO_TEACHER: 'Co-enseignant',
  ASSISTANT: 'Assistant',
}

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'PUBLISHED', label: 'Publié' },
  { value: 'ARCHIVED', label: 'Archivé' },
]

function StatusSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink/70">Statut</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus:ring-apple/15 h-12 w-full rounded-card border border-hairline bg-white px-3 text-[15px] text-ink transition-colors hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Formulaire unique : module ou leçon, création ou édition. */
type Editor =
  | { kind: 'module'; mode: 'create' }
  | { kind: 'module'; mode: 'edit'; module: Module }
  | { kind: 'lesson'; mode: 'create'; moduleId: string; moduleTitle: string }
  | {
      kind: 'lesson'
      mode: 'edit'
      moduleId: string
      moduleTitle: string
      lesson: Lesson
    }

export default function TeacherCoursePage() {
  const router = useRouter()
  const { courseId } = router.query
  const { toast } = useToast()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [editor, setEditor] = useState<Editor | null>(null)

  const load = useCallback(() => {
    if (typeof courseId !== 'string') return
    fetch(`/api/teacher/courses/${courseId}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then((d) => d && setCourse(d))
      .catch(() => setNotFound(true))
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const lessonCount = (course?.modules ?? []).reduce(
    (n, m) => n + m.lessons.length,
    0
  )

  return (
    <AppShell
      role="teacher"
      requiredRole="teacher"
      title={course?.title ?? 'Cours'}
      subtitle={
        course
          ? `${course.code} · ${course.program.name} · ${course.semester.name} ${course.semester.academicYear}`
          : undefined
      }
      action={
        course ? (
          <button
            onClick={() => setEditor({ kind: 'module', mode: 'create' })}
            className={buttonClasses('primary', 'md', 'hidden sm:inline-flex')}
          >
            <PlusIcon size={18} /> Ajouter un module
          </button>
        ) : null
      }
    >
      <Link
        href="/teacher"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink/50 transition-colors hover:text-ink"
      >
        ← Mes enseignements
      </Link>

      {notFound ? (
        <Card>
          <EmptyState
            icon={<BookIcon size={22} />}
            title="Cours introuvable"
            description="Ce cours n’existe pas ou ne vous est pas affecté."
          />
        </Card>
      ) : !course ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <>
          <Reveal>
            <Card>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{ROLE_LABELS[course.assignmentRole]}</Badge>
                <Badge tone="neutral">{course.credits} crédits</Badge>
                <Badge tone="neutral">coef. {course.coefficient}</Badge>
                <Badge tone="neutral">{course.modules.length} modules</Badge>
                <Badge tone="neutral">{lessonCount} leçons</Badge>
              </div>
              {course.description && (
                <p className="mt-4 text-[15px] leading-relaxed text-ink/60">
                  {course.description}
                </p>
              )}
            </Card>
          </Reveal>

          <div className="mt-5">
            <AnalyticsPanel
              courseId={typeof courseId === 'string' ? courseId : ''}
            />
          </div>

          <div className="mt-5">
            <QuizPanel
              courseId={typeof courseId === 'string' ? courseId : ''}
              scopeModules={course.modules.map((module) => ({
                id: module.id,
                title: module.title,
                lessons: module.lessons.map((lesson) => ({
                  id: lesson.id,
                  title: lesson.title,
                })),
              }))}
              onToast={(title, description, isError) =>
                toast({
                  title,
                  description,
                  tone: isError ? 'error' : 'success',
                })
              }
            />
          </div>

          <div className="mt-5 space-y-5">
            {course.modules.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<LayersIcon size={22} />}
                  title="Aucun module"
                  description="Structurez votre cours en modules, puis ajoutez-y des leçons."
                  action={
                    <button
                      onClick={() =>
                        setEditor({ kind: 'module', mode: 'create' })
                      }
                      className={buttonClasses('primary', 'md')}
                    >
                      <PlusIcon size={17} /> Ajouter un module
                    </button>
                  }
                />
              </Card>
            ) : (
              course.modules.map((m, i) => (
                <Reveal key={m.id} delay={i * 60}>
                  <Card>
                    <CardHeader
                      title={`${m.order + 1}. ${m.title}`}
                      action={
                        <div className="flex items-center gap-2">
                          <Badge tone={STATUS_TONES[m.status]}>
                            {STATUS_LABELS[m.status]}
                          </Badge>
                          <button
                            onClick={() =>
                              setEditor({
                                kind: 'module',
                                mode: 'edit',
                                module: m,
                              })
                            }
                            className="text-sm font-medium text-apple hover:underline"
                          >
                            Modifier
                          </button>
                        </div>
                      }
                    />

                    {m.description && (
                      <p className="mb-3 text-sm text-ink/50">
                        {m.description}
                      </p>
                    )}

                    {m.lessons.length === 0 ? (
                      <p className="text-ink/45 text-sm">
                        Aucune leçon dans ce module.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {m.lessons.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center gap-3 rounded-2xl p-2.5 transition-colors hover:bg-cloud"
                          >
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cloud text-sm font-medium text-ink/50">
                              {l.order + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-medium text-ink">
                                {l.title}
                              </p>
                              <p className="text-ink/45 truncate text-sm">
                                {l.estimatedMinutes
                                  ? `${l.estimatedMinutes} min`
                                  : 'Durée non précisée'}
                                {l.content ? '' : ' · sans contenu'}
                              </p>
                            </div>
                            <Badge tone={STATUS_TONES[l.status]}>
                              {STATUS_LABELS[l.status]}
                            </Badge>
                            <button
                              onClick={() =>
                                setEditor({
                                  kind: 'lesson',
                                  mode: 'edit',
                                  moduleId: m.id,
                                  moduleTitle: m.title,
                                  lesson: l,
                                })
                              }
                              className="text-ink/30 transition-colors hover:text-ink/70"
                              aria-label={`Modifier ${l.title}`}
                            >
                              <ChevronRightIcon size={18} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <button
                      onClick={() =>
                        setEditor({
                          kind: 'lesson',
                          mode: 'create',
                          moduleId: m.id,
                          moduleTitle: m.title,
                        })
                      }
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-apple hover:underline"
                    >
                      <PlusIcon size={15} /> Ajouter une leçon
                    </button>
                  </Card>
                </Reveal>
              ))
            )}
          </div>
        </>
      )}

      <ContentEditor
        editor={editor}
        courseId={typeof courseId === 'string' ? courseId : ''}
        onClose={() => setEditor(null)}
        onSaved={(message) => {
          setEditor(null)
          load()
          toast({ title: 'Enregistré', description: message, tone: 'success' })
        }}
        onError={(message) =>
          toast({ title: 'Échec', description: message, tone: 'error' })
        }
      />
    </AppShell>
  )
}

function ContentEditor({
  editor,
  courseId,
  onClose,
  onSaved,
  onError,
}: {
  editor: Editor | null
  courseId: string
  onClose: () => void
  onSaved: (message: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Réinitialise le formulaire chaque fois qu'on ouvre un autre objet.
  const signature = editor
    ? `${editor.kind}:${editor.mode}:${
        editor.mode === 'edit'
          ? editor.kind === 'module'
            ? editor.module.id
            : editor.lesson.id
          : editor.kind === 'lesson'
          ? editor.moduleId
          : 'new'
      }`
    : ''

  useEffect(() => {
    setError('')
    if (!editor) return

    if (editor.kind === 'module') {
      setForm(
        editor.mode === 'edit'
          ? {
              title: editor.module.title,
              description: editor.module.description ?? '',
              status: editor.module.status,
              order: String(editor.module.order),
            }
          : { title: '', description: '', status: 'DRAFT' }
      )
    } else {
      setForm(
        editor.mode === 'edit'
          ? {
              title: editor.lesson.title,
              content: editor.lesson.content ?? '',
              estimatedMinutes:
                editor.lesson.estimatedMinutes?.toString() ?? '',
              status: editor.lesson.status,
              order: String(editor.lesson.order),
            }
          : { title: '', content: '', estimatedMinutes: '', status: 'DRAFT' }
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  if (!editor) return null

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const endpoint = () => {
    if (editor.kind === 'module') {
      return editor.mode === 'create'
        ? { url: `/api/teacher/courses/${courseId}/modules`, method: 'POST' }
        : { url: `/api/teacher/modules/${editor.module.id}`, method: 'PATCH' }
    }
    return editor.mode === 'create'
      ? {
          url: `/api/teacher/modules/${editor.moduleId}/lessons`,
          method: 'POST',
        }
      : { url: `/api/teacher/lessons/${editor.lesson.id}`, method: 'PATCH' }
  }

  const submit = async () => {
    setLoading(true)
    setError('')

    try {
      const { url, method } = endpoint()
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.message || 'Enregistrement impossible')

      onSaved(data.title ?? '')
    } catch (err: any) {
      setError(err.message || 'Enregistrement impossible')
      onError(err.message || 'Enregistrement impossible')
    } finally {
      setLoading(false)
    }
  }

  const isModule = editor.kind === 'module'
  const title = isModule
    ? editor.mode === 'create'
      ? 'Nouveau module'
      : 'Modifier le module'
    : editor.mode === 'create'
    ? 'Nouvelle leçon'
    : 'Modifier la leçon'

  return (
    <Drawer
      open
      onClose={onClose}
      title={title}
      description={
        isModule ? 'Une étape du cours' : `Dans « ${editor.moduleTitle} »`
      }
      icon={isModule ? <LayersIcon size={20} /> : <BookIcon size={20} />}
      footer={
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className={buttonClasses('secondary', 'md')}
          >
            Annuler
          </button>
          <Button onClick={submit} loading={loading}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Input
          label="Titre"
          value={form.title ?? ''}
          onChange={(e) => set('title', e.target.value)}
        />

        {isModule ? (
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink/70">
              Description
            </span>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              className="placeholder:text-ink/35 focus:ring-apple/15 w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] text-ink transition-all duration-200 hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4"
            />
          </label>
        ) : (
          <>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Contenu
              </span>
              <textarea
                value={form.content ?? ''}
                onChange={(e) => set('content', e.target.value)}
                rows={8}
                placeholder="Texte simple pour le moment."
                className="placeholder:text-ink/35 focus:ring-apple/15 w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] text-ink transition-all duration-200 hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4"
              />
            </label>
            <Input
              label="Durée estimée (minutes)"
              type="number"
              value={form.estimatedMinutes ?? ''}
              onChange={(e) => set('estimatedMinutes', e.target.value)}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <StatusSelect
            value={form.status ?? 'DRAFT'}
            onChange={(v) => set('status', v)}
          />
          {editor.mode === 'edit' && (
            <Input
              label="Ordre"
              type="number"
              value={form.order ?? ''}
              onChange={(e) => set('order', e.target.value)}
            />
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}
      </div>
    </Drawer>
  )
}

// Protection côté serveur : enseignant *et* affecté à ce cours précis.
export const getServerSideProps = requireAssignedCoursePage()
