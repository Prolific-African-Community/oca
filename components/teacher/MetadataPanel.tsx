import { useEffect, useState } from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'

/**
 * Informations du module et de la leçon sélectionnés.
 *
 * Le RUN 33 a fait du Course Studio le seul lieu d'édition, mais le titre, la
 * description, la durée et l'ordre n'y étaient éditables nulle part : cette
 * carte comble ce manque sans réintroduire un tiroir.
 *
 * Le **statut est volontairement absent**. Il est déjà géré par les actions
 * Publier / Dépublier, qui portent leurs garde-fous — confirmation d'une leçon
 * trop légère, refus d'un module sans leçon publiée. Un champ « Statut » ici
 * contournerait ces protections en silence.
 */

export interface MetadataModule {
  id: string
  title: string
  description: string | null
  order: number
}

export interface MetadataLesson {
  id: string
  title: string
  estimatedMinutes: number | null
  order: number
}

type Scope = 'module' | 'lesson'

export function MetadataPanel({
  module,
  lesson,
  onSaved,
  onToast,
}: {
  module: MetadataModule
  lesson: MetadataLesson | null
  onSaved: () => Promise<void> | void
  onToast: (title: string, description?: string, error?: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState<Scope | null>(null)
  const [error, setError] = useState<{ scope: Scope; message: string } | null>(
    null
  )

  const [moduleForm, setModuleForm] = useState({
    title: module.title,
    description: module.description ?? '',
    order: String(module.order),
  })

  const [lessonForm, setLessonForm] = useState({
    title: lesson?.title ?? '',
    estimatedMinutes: lesson?.estimatedMinutes?.toString() ?? '',
    order: lesson ? String(lesson.order) : '',
  })

  // Le contenu du serveur reprend la main dès qu'on change de module ou de
  // leçon, ou après un rechargement : le formulaire ne doit jamais afficher
  // une valeur périmée.
  useEffect(() => {
    setModuleForm({
      title: module.title,
      description: module.description ?? '',
      order: String(module.order),
    })
    setError(null)
  }, [module.id, module.title, module.description, module.order])

  useEffect(() => {
    setLessonForm({
      title: lesson?.title ?? '',
      estimatedMinutes: lesson?.estimatedMinutes?.toString() ?? '',
      order: lesson ? String(lesson.order) : '',
    })
    setError(null)
  }, [lesson?.id, lesson?.title, lesson?.estimatedMinutes, lesson?.order])

  const save = async (scope: Scope) => {
    setSaving(scope)
    setError(null)

    // On n'envoie jamais `content` : le PATCH d'une leçon efface le contenu
    // structuré dès que du texte simple est fourni.
    const url =
      scope === 'module'
        ? `/api/teacher/modules/${module.id}`
        : `/api/teacher/lessons/${lesson!.id}`

    const payload =
      scope === 'module'
        ? {
            title: moduleForm.title,
            description: moduleForm.description,
            order: moduleForm.order,
          }
        : {
            title: lessonForm.title,
            estimatedMinutes: lessonForm.estimatedMinutes,
            order: lessonForm.order,
          }

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Enregistrement impossible')

      await onSaved()
      onToast(scope === 'module' ? 'Module mis à jour' : 'Leçon mise à jour')
    } catch (err: any) {
      const message = err.message || 'Enregistrement impossible'
      setError({ scope, message })
      onToast('Enregistrement impossible', message, true)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <CardHeader
        title="Informations"
        action={
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-sm font-medium text-apple hover:underline"
          >
            {open ? 'Masquer' : 'Modifier'}
          </button>
        }
      />

      {!open ? (
        <p className="text-ink/45 text-sm">
          Titre, description, durée et ordre du module et de la leçon
          sélectionnés.
        </p>
      ) : (
        <div className="space-y-6">
          <section>
            <p className="mb-3 text-[15px] font-medium text-ink">Module</p>
            <div className="space-y-3">
              <Input
                label="Titre du module"
                value={moduleForm.title}
                onChange={(e) =>
                  setModuleForm((p) => ({ ...p, title: e.target.value }))
                }
              />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink/70">
                  Description
                </span>
                <textarea
                  value={moduleForm.description}
                  rows={3}
                  onChange={(e) =>
                    setModuleForm((p) => ({
                      ...p,
                      description: e.target.value,
                    }))
                  }
                  className="w-full rounded-card border border-hairline bg-white px-4 py-3 text-[15px] leading-relaxed text-ink transition-all duration-200 hover:border-ink/20 focus:border-apple focus:outline-none focus:ring-4 focus:ring-apple/15"
                />
              </label>
              <Input
                label="Ordre"
                type="number"
                value={moduleForm.order}
                onChange={(e) =>
                  setModuleForm((p) => ({ ...p, order: e.target.value }))
                }
              />
            </div>

            {error?.scope === 'module' && (
              <div
                role="alert"
                className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
              >
                {error.message}
              </div>
            )}

            <Button
              size="md"
              className="mt-3"
              loading={saving === 'module'}
              onClick={() => save('module')}
            >
              Enregistrer le module
            </Button>
          </section>

          {lesson && (
            <section className="border-t border-hairline pt-5">
              <p className="mb-3 text-[15px] font-medium text-ink">Leçon</p>
              <div className="space-y-3">
                <Input
                  label="Titre de la leçon"
                  value={lessonForm.title}
                  onChange={(e) =>
                    setLessonForm((p) => ({ ...p, title: e.target.value }))
                  }
                />
                <Input
                  label="Durée estimée (minutes)"
                  type="number"
                  value={lessonForm.estimatedMinutes}
                  onChange={(e) =>
                    setLessonForm((p) => ({
                      ...p,
                      estimatedMinutes: e.target.value,
                    }))
                  }
                />
                <Input
                  label="Ordre"
                  type="number"
                  value={lessonForm.order}
                  onChange={(e) =>
                    setLessonForm((p) => ({ ...p, order: e.target.value }))
                  }
                />
              </div>

              {error?.scope === 'lesson' && (
                <div
                  role="alert"
                  className="mt-3 rounded-card border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error.message}
                </div>
              )}

              <Button
                size="md"
                className="mt-3"
                loading={saving === 'lesson'}
                onClick={() => save('lesson')}
              >
                Enregistrer la leçon
              </Button>
            </section>
          )}

          <p className="text-ink/40 text-xs">
            Le statut se règle avec les actions Publier et Dépublier, qui
            vérifient la maturité du contenu avant de le rendre visible.
          </p>
        </div>
      )}
    </Card>
  )
}
