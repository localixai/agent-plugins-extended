/**
 * `oracle:record corpus-runtime`: what a Claude Code session registers from each corpus plugin
 * (`session.ts`), for an implementation to compare its own session with. Only the plugins a session
 * runs nothing of on its way to `init` are asked (`session-start.ts`); the rest are recorded as
 * skipped, never run. A session with no plugin of the corpus lists the built-in skills and commands
 * (a bare `code-review` is Claude Code's own), so those names are taken out of every registry.
 *
 * Writes `extend/.cache/oracle/<release>/corpus-runtime/<marketplace>/<name>.json` per plugin:
 * `{ status: 'skipped' | 'no-init' }` or `{ status: 'recorded', plugins, registry }`, `plugins` the
 * names Claude Code loaded from the folder (a folder of plugins loads several).
 */
import { mkdir, realpath } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { readCorpusTargets } from '../corpus/location.ts'
import { lookupName } from '../corpus/plugin-name.ts'
import { pool } from '../corpus/pool.ts'
import type { RuntimeInit } from './isolated.ts'
import { cacheOf, record, type RecordContext, type Recorded } from './paths.ts'
import { registryOf, sessionInit, type Registry } from './session.ts'
import { runsAtSessionStart } from './session-start.ts'

type Outcome =
  | { readonly status: 'skipped' | 'no-init' }
  | { readonly status: 'recorded'; readonly plugins: readonly string[]; readonly registry: Registry }

/** The plugins Claude Code itself loaded from `dir` (its `init` gives each one's path); none loaded falls back to the manifest name. */
async function loadedNames(init: RuntimeInit, dir: string): Promise<string[]> {
  const root = await realpath(dir)
  const under = (path: unknown) => typeof path === 'string' && (path === root || path.startsWith(root + sep))
  const names = init.plugins.filter((plugin) => under(plugin['path'])).map((plugin) => plugin.name)
  return names.length > 0 ? names : [await lookupName(dir)]
}

async function baselineNames(release: string): Promise<ReadonlySet<string>> {
  const empty = join(cacheOf(release), 'baseline-empty')
  await mkdir(empty, { recursive: true })
  const init = await sessionInit(release, empty)
  if (init === undefined) throw new Error('Claude Code printed no init for an empty --plugin-dir')
  return new Set([...init.agents, ...init.slash_commands, ...init.skills])
}

export async function recordCorpusRuntime({ release, check }: RecordContext): Promise<Recorded> {
  const baseline = await baselineNames(release)
  const notBaseline = (names: readonly string[]) => names.filter((name) => !baseline.has(name))
  const outcomeOf = async (dir: string): Promise<Outcome> => {
    if (await runsAtSessionStart(dir)) return { status: 'skipped' }
    const init = await sessionInit(release, dir)
    if (init === undefined) return { status: 'no-init' }
    const plugins = await loadedNames(init, dir)
    const registry = registryOf(init, plugins)
    return {
      status: 'recorded',
      plugins,
      registry: { ...registry, agents: notBaseline(registry.agents), slashCommands: notBaseline(registry.slashCommands), skills: notBaseline(registry.skills) },
    }
  }
  const targets = await readCorpusTargets()
  let done = 0
  const changes = await pool(targets, 6, async (target) => {
    const outcome = await outcomeOf(target.dir).catch((): Outcome => ({ status: 'no-init' }))
    done += 1
    if (done % 100 === 0) console.log(`  ${done}/${targets.length}`)
    return record(join(cacheOf(release), 'corpus-runtime', `${target.key}.json`), outcome, check)
  })
  return { changed: changes.filter(Boolean).length, summary: `${targets.length} corpus plugins` }
}
