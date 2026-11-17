/**
 * The session oracle: what a Claude Code SESSION registers from a plugin folder, read from the
 * `init` event of `claude -p --plugin-dir <dir> --output-format stream-json --verbose` run as a black
 * box. The run ends at `init`, before the model is asked; the run is isolated (`isolated.ts`), so no
 * person's settings, plugins or project play a part. A fixture's `oracle-settings.json`, when it has
 * one, is the private config folder's `settings.json`.
 *
 * This RUNS the plugin's hooks and MCP servers: point it only at fixtures written for this purpose,
 * or at a corpus plugin that runs nothing at session start (`session-start.ts`).
 */
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { initOf, initSchema, isolatedEnv, type RuntimeInit } from './isolated.ts'
import { cacheOf, jsonText, writeText } from './paths.ts'

/** Where a fixture's outcome is recorded, beside it; never part of its content. */
export const EXPECTED_FILE = 'expected.json'
/** Settings the fixture runs under: copied to the private config folder as `settings.json`. */
export const SETTINGS_FILE = 'oracle-settings.json'

async function filesOf(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name !== EXPECTED_FILE)
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
    .toSorted()
}

/** The hash of a folder's content: every file's relative path and bytes, in path order. */
export async function folderHash(dir: string): Promise<string> {
  const hash = createHash('sha256')
  for (const file of await filesOf(dir)) {
    hash.update(`${file}\0`)
    hash.update(await readFile(join(dir, file)))
    hash.update('\0')
  }
  return hash.digest('hex').slice(0, 16)
}

/** One run of `claude -p` over the folder, ended at its `init`; `undefined` when none came. */
async function runClaude(dir: string): Promise<RuntimeInit | undefined> {
  const scratch = await mkdtemp(join(tmpdir(), 'session-oracle-'))
  try {
    const [home, config] = [join(scratch, 'home'), join(scratch, 'config')]
    await mkdir(config, { recursive: true })
    await mkdir(home, { recursive: true })
    const settings = await readFile(join(dir, SETTINGS_FILE), 'utf8').catch(() => undefined)
    if (settings !== undefined) await writeFile(join(config, 'settings.json'), settings)
    const args = ['-p', '--plugin-dir', dir, '--output-format', 'stream-json', '--verbose', '--max-turns', '1', 'hi']
    return await initOf([CLAUDE_BIN, ...args], { cwd: scratch, env: isolatedEnv({ home, config }) })
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

/**
 * The `init` event for a folder, cached under `extend/.cache/oracle/<release>/init/` by the folder's
 * content hash, so a run asks only what changed. `undefined` when Claude Code printed no `init`.
 */
export async function sessionInit(release: string, dir: string): Promise<RuntimeInit | undefined> {
  const cached = join(cacheOf(release), 'init', `${await folderHash(dir)}.json`)
  try {
    return initSchema.parse(JSON.parse(await readFile(cached, 'utf8')))
  } catch {
    // not cached yet
  }
  const init = await runClaude(dir)
  if (init !== undefined) await writeText(cached, jsonText(init))
  return init
}

/**
 * What plugins registered, ids only: the names that belong to them, sorted. `outputStyle` is the
 * session's: `init` echoes the `outputStyle` setting, whether or not the style exists.
 */
export interface Registry {
  /** Whether every one of the plugins is among the session's plugins. */
  readonly loaded: boolean
  readonly agents: readonly string[]
  readonly slashCommands: readonly string[]
  readonly skills: readonly string[]
  readonly mcpServers: readonly string[]
  readonly outputStyle: string
}

const own = (plugin: string) => (name: string) => name === plugin || name.startsWith(`${plugin}:`)

/** The registry of several plugins of one session: the `init` names any of them owns. */
export function registryOf(init: RuntimeInit, plugins: readonly string[]): Registry {
  const owners = plugins.map(own)
  const mine = (name: string) => owners.some((owns) => owns(name))
  return {
    loaded: plugins.every((plugin) => init.plugins.some((one) => one.name === plugin)),
    agents: init.agents.filter(mine).toSorted(),
    slashCommands: init.slash_commands.filter(mine).toSorted(),
    skills: init.skills.filter(mine).toSorted(),
    mcpServers: init.mcp_servers
      .map((server) => server.name)
      .filter((name) => plugins.some((plugin) => name.startsWith(`plugin:${plugin}:`)))
      .toSorted(),
    outputStyle: init.output_style,
  }
}
