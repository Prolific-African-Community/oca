/**
 * Nettoyage du texte produit par l'assistant.
 *
 * Les pages étudiantes affichent le contenu structuré en texte simple : tout
 * marqueur Markdown y apparaît littéralement (« ### Exercice 1 », « **Consigne** »).
 * Plutôt que d'ajouter un moteur de rendu Markdown, on retire les marqueurs
 * à la source.
 *
 * Règle de prudence : on ne touche qu'à des motifs typographiques sans
 * ambiguïté. Les symboles porteurs de sens — mathématiques, juridiques,
 * monétaires, pourcentages — sont préservés tels quels.
 */

/** Classe « lettre » explicite : la cible TypeScript du projet exclut \p{L}. */
const LETTER = 'A-Za-zÀ-ÖØ-öø-ÿ'

/** Titres Markdown en début de ligne : « ### Titre » → « Titre ». */
const HEADING = /^[ \t]{0,3}#{1,6}[ \t]+/gm

/** Dièses de fermeture parfois ajoutés en fin de titre. */
const TRAILING_HASHES = /[ \t]+#{1,6}[ \t]*$/gm

/**
 * Gras et italique. On exige au moins une lettre dans le contenu balisé :
 * cela laisse intacts les usages arithmétiques du type « 3 * 4 ».
 */
const BOLD = new RegExp('\\*\\*(?=[^*]*[' + LETTER + '])([^*\\n]+?)\\*\\*', 'g')
const BOLD_UNDERSCORE = new RegExp(
  '__(?=[^_]*[' + LETTER + '])([^_\\n]+?)__',
  'g'
)
/**
 * L'italique n'est retiré que si les astérisques collent au texte, comme en
 * Markdown : « *mot* » est de l'emphase, « 3 * 4 » est une multiplication.
 */
const ITALIC_STAR = new RegExp(
  '(^|[\\s(])\\*(?=[^\\s*][^*\\n]*[' +
    LETTER +
    '])([^\\s*][^*\\n]*[^\\s*]|[^\\s*])\\*(?=[\\s).,;:!?]|$)',
  'gm'
)

/** Blocs de code et accents inverses : le contenu est conservé, pas la clôture. */
const CODE_FENCE = /^[ \t]*```[^\n]*$/gm
const INLINE_CODE = /`([^`\n]+)`/g

/** Puces Markdown en début de ligne, remplacées par un tiret typographique. */
const BULLET = /^[ \t]{0,3}[*+][ \t]+/gm

/** Séparateurs horizontaux (---, ***) sur une ligne isolée. */
const RULE = /^[ \t]{0,3}([-*_])\1{2,}[ \t]*$/gm

export function cleanPedagogicalText(value: string): string {
  if (!value) return ''

  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(CODE_FENCE, '')
    .replace(RULE, '')
    .replace(HEADING, '')
    .replace(TRAILING_HASHES, '')
    .replace(BOLD, '$1')
    .replace(BOLD_UNDERSCORE, '$1')
    .replace(ITALIC_STAR, '$1$2')
    .replace(INLINE_CODE, '$1')
    .replace(BULLET, '– ')

  return (
    text
      // Espaces en fin de ligne, puis limitation des lignes vides consécutives.
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Nettoyage d'un élément de liste : mêmes règles, plus le retrait d'une puce
 * ou d'une numérotation en tête, que le rendu ajoute déjà de son côté.
 */
export function cleanPedagogicalListItem(value: string): string {
  return cleanPedagogicalText(value)
    .replace(/^[–\-•*+][ \t]+/, '')
    .replace(/^\d+[.)][ \t]+/, '')
    .trim()
}

export function cleanPedagogicalList(values: string[]): string[] {
  return values.map(cleanPedagogicalListItem).filter(Boolean)
}
