/**
 * How `corpus:fetch` gets each entry of a marketplace, read from the entry's `source` by §15.6 of
 * `extend/spec/1.1.0/15-marketplaces.md`: a relative path (§15.6.1, §15.6.2) is used in place; a
 * `github`, `url` or `git-subdir` source (§15.6.3) is a git checkout; `npm`, `archive` and `command`
 * are not fetched. Only what fetching needs is read: an entry the client would refuse is recorded
 * with the reason, never guessed into a path.
 */

/** A git checkout: the repository, the commit or ref it ends on, and the subdirectory it keeps. */
export interface GitPlan {
  readonly kind: 'git'
  readonly url: string
  readonly ref?: string | undefined
  readonly sha?: string | undefined
  readonly subdir?: string | undefined
}

/** A directory of the marketplace itself, relative to its root. */
export interface LocalPlan {
  readonly kind: 'local'
  readonly fromMarketplaceRoot: string
}

/** A source type the corpus does not fetch (`npm`, `archive`, `command`, or one it does not know). */
export interface OtherPlan {
  readonly kind: string
}

export type FetchPlan = GitPlan | LocalPlan | OtherPlan

export interface PlannedEntry {
  readonly name: string
  readonly plan: FetchPlan | undefined
  /** Why there is no plan. */
  readonly refusal: string
}

type Json = Record<string, unknown>

const isRecord = (value: unknown): value is Json => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const SHORTHAND = /^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9._-]+$/
const GIT_URL = /^(https?:\/\/|file:\/\/|git@)/

/** A relative path (§15.6.1) or a bare name under `metadata.pluginRoot` (§15.6.2). */
function planRelative(raw: string, pluginRoot: string | undefined): FetchPlan | string {
  if (raw.includes('..')) return `Path contains "..": ${raw}`
  if (raw.includes('\\')) return `${raw} contains a backslash; it does not stay inside the marketplace`
  if (raw === '.' || raw.startsWith('./')) return { kind: 'local', fromMarketplaceRoot: raw }
  const root = pluginRoot?.replace(/^\.\//, '').replace(/\/+$/, '')
  if (root === undefined || raw.includes('/') || raw === '' || root.includes('..') || root.startsWith('/')) {
    return 'Invalid string: must start with "./"'
  }
  return { kind: 'local', fromMarketplaceRoot: root === '' || root === '.' ? `./${raw}` : `./${root}/${raw}` }
}

/** A git address (§15.6.3): `github` takes `owner/repo`, `git-subdir` either form, `url` a full URL. */
function gitUrl(value: unknown, shorthand: boolean): string | undefined {
  const raw = text(value)
  if (raw === undefined) return undefined
  if (SHORTHAND.test(raw)) return shorthand ? `https://github.com/${raw}.git` : undefined
  return GIT_URL.test(raw) ? raw : undefined
}

function planObject(source: Json): FetchPlan | string {
  const kind = text(source['source']) ?? ''
  const pin = { ref: text(source['ref']), sha: text(source['sha']) }
  if (kind === 'github') {
    const repo = text(source['repo'])
    return repo !== undefined && SHORTHAND.test(repo)
      ? { kind: 'git', url: `https://github.com/${repo}.git`, ...pin }
      : `"${repo}" is not a GitHub repository in owner/repo form`
  }
  if (kind === 'url') {
    const url = gitUrl(source['url'], false)
    return url === undefined ? `"${text(source['url'])}" is not a git URL` : { kind: 'git', url, ...pin }
  }
  if (kind === 'git-subdir') {
    const url = gitUrl(source['url'], true)
    const subdir = text(source['path'])
    if (url === undefined) return `"${text(source['url'])}" is not a git URL`
    if (subdir === undefined || subdir.includes('..')) return `"${subdir}" is not a repository path`
    return { kind: 'git', url, ...pin, subdir: subdir.replace(/^\.\//, '').replace(/\/+$/, '') }
  }
  return { kind: kind === '' ? 'unknown' : kind }
}

/** Every entry of a parsed `marketplace.json`, with its plan or the reason it has none. */
export function planEntries(catalog: unknown): PlannedEntry[] {
  if (!isRecord(catalog) || !Array.isArray(catalog['plugins'])) throw new Error('marketplace.json has no plugins array')
  const metadata = isRecord(catalog['metadata']) ? catalog['metadata'] : {}
  const pluginRoot = text(metadata['pluginRoot'])
  return catalog['plugins'].flatMap((entry: unknown): PlannedEntry[] => {
    if (!isRecord(entry) || text(entry['name']) === undefined) return []
    const name = text(entry['name']) ?? ''
    const source = entry['source']
    const planned =
      typeof source === 'string'
        ? planRelative(source, pluginRoot)
        : isRecord(source)
          ? planObject(source)
          : 'source is neither a path nor an object'
    return typeof planned === 'string'
      ? [{ name, plan: undefined, refusal: planned }]
      : [{ name, plan: planned, refusal: '' }]
  })
}
