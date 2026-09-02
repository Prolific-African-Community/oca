/**
 * Sélection initiale du Course Studio à partir d'un lien profond.
 *
 * Extrait de la page pour être vérifiable isolément : c'est la règle qui
 * décide ce que l'enseignant voit en arrivant depuis la vue d'ensemble.
 */

export interface SelectableModule {
  id: string
  lessons: { id: string }[]
}

export interface InitialSelection {
  lessonId: string | null
  moduleId: string | null
}

/**
 * Priorité : la leçon visée, puis le module visé, puis la première leçon
 * disponible. Un identifiant étranger au cours est ignoré sans erreur — un
 * lien périmé ne doit pas laisser l'enseignant devant un écran vide.
 */
export function resolveInitialSelection(
  modules: SelectableModule[],
  query: { lessonId?: string | null; moduleId?: string | null }
): InitialSelection {
  if (query.lessonId) {
    const owner = modules.find((m) =>
      m.lessons.some((l) => l.id === query.lessonId)
    )
    if (owner) return { lessonId: query.lessonId, moduleId: owner.id }
  }

  if (query.moduleId) {
    const target = modules.find((m) => m.id === query.moduleId)
    // Un module sans leçon reste ciblé : le Studio affiche son état vide.
    if (target) {
      return { lessonId: target.lessons[0]?.id ?? null, moduleId: target.id }
    }
  }

  const first = modules.flatMap((m) => m.lessons)[0]
  return { lessonId: first?.id ?? null, moduleId: null }
}
