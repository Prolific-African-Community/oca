import { Button } from '../ui/Button'

/**
 * Échec de chargement d'une page d'administration.
 *
 * Jusqu'ici, une coupure réseau était avalée silencieusement : la page se
 * rendait vide et affichait « Aucun étudiant ». Un administrateur ne pouvait
 * pas distinguer une base injoignable d'un établissement réellement vide —
 * c'est la pire confusion possible, puisque l'une invite à recommencer et
 * l'autre à créer des données qui existent déjà.
 *
 * Les suspensions de l'hébergeur de base de données sont brèves : le message
 * invite donc à réessayer, et le bouton relance le chargement sans recharger
 * la page. Aucune tentative automatique en arrière-plan — un écran qui
 * clignote tout seul est plus inquiétant qu'utile.
 */
export function LoadError({
  onRetry,
  retrying,
  className,
}: {
  onRetry: () => void
  retrying?: boolean
  className?: string
}) {
  return (
    <div
      role="alert"
      className={
        'rounded-hero border border-amber-200 bg-amber-50 px-5 py-6 text-center ' +
        (className ?? '')
      }
    >
      <p className="text-[15px] font-medium text-amber-900">
        Connexion temporairement indisponible.
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
        Réessayez dans quelques secondes. Aucune donnée n’a été modifiée.
      </p>
      <div className="mt-4">
        <Button variant="secondary" size="md" loading={retrying} onClick={onRetry}>
          Réessayer
        </Button>
      </div>
    </div>
  )
}

/**
 * Vrai ou faux : la réponse indique-t-elle une indisponibilité passagère
 * plutôt qu'une erreur de saisie ? Les erreurs de validation doivent rester
 * visibles telles quelles ; seules les pannes méritent le message d'attente.
 */
export function isTransient(status: number) {
  return status === 0 || status >= 500 || status === 429
}
