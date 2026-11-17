/**
 * `bun run corpus:fetch`: clones the official and community marketplaces, plans every entry of each
 * `marketplace.json` by §15.6 (plan.ts), and runs the plan as a client would: a local path is used
 * in place, a git plan is a shallow clone (sparse for a subdirectory, pinned to the entry's `sha` or
 * `ref`). npm, archive and command sources are recorded as skipped. Writes `index.json` in the
 * corpus folder (`extend/.cache/corpus/`, or `CORPUS_DIR`). `--refresh` pulls the marketplaces and
 * fetches every plugin again.
 *
 *   bun run corpus:fetch [--refresh]
 */
import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { git } from './git.ts'
import { CORPUS_DIR, INDEX_FILE, MARKETPLACES, PLUGINS_DIR, type CorpusPlugin, indexedDir } from './location.ts'
import { planEntries, type FetchPlan, type GitPlan, type LocalPlan, type PlannedEntry } from './plan.ts'
import { pool } from './pool.ts'

const refresh = process.argv.includes('--refresh')

async function cloneMarketplace(name: string, repo: string): Promise<string> {
  const dir = join(CORPUS_DIR, name)
  if (!existsSync(dir)) await git(['clone', '-q', '--depth', '1', repo, dir])
  else if (refresh) await git(['-C', dir, 'pull', '-q', '--ff-only'])
  return dir
}

/** A shallow fetch of exactly the commit the plan ends on, sparse when it names a subdirectory. */
async function cloneGit(plan: GitPlan, dir: string): Promise<string> {
  if (existsSync(join(dir, '.git')) && !refresh) return plan.subdir ? join(dir, plan.subdir) : dir
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  await git(['-C', dir, 'init', '-q'])
  await git(['-C', dir, 'remote', 'add', 'origin', plan.url])
  if (plan.subdir) {
    await git(['-C', dir, 'sparse-checkout', 'set', '--no-cone', `/${plan.subdir}/`])
  }
  const target = plan.sha ?? plan.ref ?? 'HEAD'
  await git(['-C', dir, 'fetch', '-q', '--depth', '1', '--filter=blob:limit=2m', 'origin', target])
  await git(['-C', dir, 'checkout', '-q', 'FETCH_HEAD'])
  return plan.subdir ? join(dir, plan.subdir) : dir
}

async function fetchPlugin(marketplace: string, root: string, entry: PlannedEntry): Promise<CorpusPlugin> {
  const base = { marketplace, name: entry.name, planKind: entry.plan?.kind ?? 'refused' }
  const { plan } = entry
  if (!plan) return { ...base, skipped: entry.refusal }
  if (isLocal(plan)) return { ...base, dir: indexedDir(join(root, plan.fromMarketplaceRoot)) }
  if (!isGit(plan)) return { ...base, skipped: `${plan.kind} sources are not fetched` }
  try {
    const dir = await cloneGit(plan, join(PLUGINS_DIR, marketplace, entry.name))
    return existsSync(dir) ? { ...base, dir: indexedDir(dir) } : { ...base, skipped: 'subdirectory not found' }
  } catch (cause) {
    return { ...base, skipped: `fetch failed: ${String(cause).slice(0, 300)}` }
  }
}

const isLocal = (plan: FetchPlan): plan is LocalPlan => plan.kind === 'local'
const isGit = (plan: FetchPlan): plan is GitPlan => plan.kind === 'git'

/** The entries of a marketplace added from its GitHub repository, so every relative path resolves. */
async function entriesOf(root: string): Promise<PlannedEntry[]> {
  return planEntries(await Bun.file(join(root, '.claude-plugin', 'marketplace.json')).json())
}

const index: CorpusPlugin[] = []
for (const { name, repo } of MARKETPLACES) {
  const root = await cloneMarketplace(name, repo)
  const entries = await entriesOf(root)
  let done = 0
  const fetched = await pool(entries, 12, async (entry) => {
    const result = await fetchPlugin(name, root, entry)
    done += 1
    if (done % 100 === 0) console.log(`${name}: ${done}/${entries.length}`)
    return result
  })
  index.push(...fetched)
}
await Bun.write(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`)
const ok = index.filter((plugin) => plugin.dir !== undefined).length
console.log(`Corpus: ${ok} of ${index.length} plugins fetched (${INDEX_FILE})`)
