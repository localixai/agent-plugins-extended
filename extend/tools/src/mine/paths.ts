/**
 * Where the mining tools keep what they pull from Claude Code, and which release a run reads. Every
 * cache is under `extend/.cache/` (git-ignored) and keyed by the release it describes, so the docs and
 * declarations of two releases sit side by side: `claude-docs/<release>/`, `claude-types/<release>/`.
 */
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { EXTEND } from '../paths.ts'

export const CACHE = join(EXTEND, '.cache')
export const DOCS_CACHE = join(CACHE, 'claude-docs')
export const TYPES_CACHE = join(CACHE, 'claude-types')

/** The docs of one release, as `docs:pull` wrote them. */
export const docsDir = (release: string): string => join(DOCS_CACHE, release)

/** The mods declarations of one release, as `types:pull` wrote them. */
export const typesDir = (release: string): string => join(TYPES_CACHE, release)

/** The docs site's index of every page, and the prefix each page's URL starts with. */
export const DOCS_INDEX = 'https://code.claude.com/docs/llms.txt'
export const DOCS_PREFIX = 'https://code.claude.com/docs/en/'

/** A page's public address, for citations: `hooks.md` → its URL. */
export const pageUrl = (page: string): string => `${DOCS_PREFIX}${page}`

/** The declaration files Claude Code writes beside a mod, under `.claude-plugin/types/`. */
export const TYPES_FILES = [
  'claude-code/index.d.ts',
  'claude-code-tools/index.d.ts',
  'claude-code-mcp/index.d.ts',
  'tsconfig.json',
] as const

const RELEASE = /^\d+\.\d+\.\d+$/

const byVersion = (a: string, b: string): number => {
  const [x, y] = [a.split('.').map(Number), b.split('.').map(Number)]
  for (let i = 0; i < 3; i += 1) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0)
  return 0
}

/** The releases a cache holds, oldest first. */
export function cachedReleases(cache: string): string[] {
  if (!existsSync(cache)) return []
  return readdirSync(cache)
    .filter((name) => RELEASE.test(name))
    .toSorted(byVersion)
}

/**
 * The release a run reads: the first `x.y.z` argument, else the newest one the cache holds. Fails
 * when there is neither, naming the command that fills the cache.
 */
export function releaseOf(argv: readonly string[], cache: string, fill: string): string {
  const named = argv.find((arg) => RELEASE.test(arg))
  if (named !== undefined) return named
  const newest = cachedReleases(cache).at(-1)
  if (newest === undefined) throw new Error(`${cache} holds no release: run \`${fill}\``)
  return newest
}
