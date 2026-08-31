import 'dotenv/config'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'

/**
 * Sauvegarde complète de la base, au format personnalisé de PostgreSQL.
 *
 * Le contenu pédagogique réel — cours, modules, leçons, journal d'audit,
 * enregistrements AIGeneration — n'existe que dans la base : le dépôt Git ne
 * protège que le code. Cette sauvegarde est la seule chose qui rende
 * réversibles les suppressions à venir.
 *
 *   npm run db:backup
 *
 * Deux précautions structurelles :
 *  - la chaîne de connexion n'est jamais affichée, jamais journalisée, et
 *    n'apparaît pas dans les arguments du processus : elle est décomposée en
 *    variables d'environnement liblpq (PGHOST, PGPASSWORD…) ;
 *  - l'archive produite contient toutes les données de production. Elle est
 *    ignorée par Git, et doit être traitée comme un secret.
 */

const OUTPUT_DIR = resolve(process.cwd(), 'backups')

function fail(message: string, detail?: string): never {
  console.error(`\n${message}`)
  if (detail) console.error(detail)
  process.exit(1)
}

/** Connexion directe de préférence : une sauvegarde n'a rien à faire dans le pool. */
const rawUrl = process.env.DIRECT_URL || process.env.DATABASE_URL

if (!rawUrl) {
  fail(
    'Aucune connexion configurée.',
    'Renseignez DIRECT_URL (de préférence) ou DATABASE_URL dans .env.'
  )
}

let url: URL
try {
  url = new URL(rawUrl)
} catch {
  // On ne réaffiche surtout pas la valeur lue.
  fail('La chaîne de connexion est illisible.', 'Vérifiez DIRECT_URL dans .env.')
}

const pgDump = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' })

if (pgDump.error || pgDump.status !== 0) {
  fail(
    'pg_dump est introuvable sur cette machine.',
    [
      '',
      'Trois options, par ordre de simplicité :',
      '',
      '  1. Console Neon : Project > Backups, ou créez une branche de la base.',
      '     C\'est instantané et sans installation.',
      '',
      '  2. Installez les outils client PostgreSQL, puis relancez cette commande.',
      '     Windows : https://www.postgresql.org/download/windows/',
      '     (l\'installateur permet de ne cocher que « Command Line Tools »)',
      '',
      '  3. Docker :',
      '     docker run --rm -e PGPASSWORD=... postgres:18 pg_dump ...',
      '',
      'La version de pg_dump doit être supérieure ou égale à celle du serveur.',
      'Serveur actuel : PostgreSQL 18.',
    ].join('\n')
  )
}

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, '')
  .replace('T', '-')
  .slice(0, 15)

const outFile = resolve(OUTPUT_DIR, `oca-${stamp}.dump`)

/**
 * Connexion passée par l'environnement plutôt que par la ligne de commande :
 * le mot de passe n'apparaît ainsi dans aucune liste de processus.
 */
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.replace(/^\//, ''),
  PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
}

console.log(`Sauvegarde vers ${outFile}`)
console.log(`Version de pg_dump : ${(pgDump.stdout || '').trim()}`)

const result = spawnSync(
  'pg_dump',
  ['--format=custom', '--no-owner', '--no-privileges', '--file', outFile],
  { env, stdio: ['ignore', 'inherit', 'inherit'] }
)

if (result.status !== 0) {
  fail(
    'La sauvegarde a échoué.',
    'Aucun fichier exploitable n\'a été produit ; supprimez l\'archive partielle.'
  )
}

console.log('\nSauvegarde terminée.')
console.log('Cette archive contient des données de production : ne la partagez pas,')
console.log('ne la committez pas, conservez-la dans un emplacement chiffré.')
