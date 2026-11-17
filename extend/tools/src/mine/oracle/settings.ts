/**
 * `oracle:record settings`: how Claude Code merges settings and which permission mode a session
 * starts in, for the cases of `settings-cases.ts`. Two answers per case: the Agent SDK's own resolver
 * (`resolveSettings` and `filterEscalatingDefaultMode`, both `@alpha`, pure JS that spawns nothing)
 * for every key, and for the starting mode also `claude -p` itself, run as a black box isolated like
 * the session oracle and ended at `init`. HOME and the config folder point at a private folder, so no
 * person's settings play a part.
 *
 * The machine's managed settings cannot be moved: the SDK and Claude Code always read them. Their
 * values are never recorded (they are the recording machine's); `managed` records only whether there
 * are any and the top-level keys they set, and an implementation compares no key of that list.
 *
 * Records `conformance/oracle/settings.json`: `{ claudeCodeVersion, sdkVersion, managed, cases }`,
 * each case its files, its keys, `sdk` (each key's merged value with object keys sorted and every
 * list as a sorted set, since the order carries no behaviour; a key that resolves to nothing is
 * absent) and `cli` (the mode `init` reports, `manual` and an unknown mode read as `default`).
 */
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { initOf, isolatedEnv } from './isolated.ts'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'
import { SETTINGS_CASES, type SettingsCase } from './settings-cases.ts'

const FILE = join(ORACLE_DIR, 'settings.json')
const MACHINE_DIR = process.platform === 'darwin' ? '/Library/Application Support/ClaudeCode' : '/etc/claude-code'
const TIERS = ['user', 'project', 'local'] as const

/** Whether the machine has managed settings, and the top-level keys they set (never their values). */
async function machineManaged(): Promise<{ present: boolean; keys: string[] }> {
  const base = join(MACHINE_DIR, 'managed-settings.json')
  const folder = join(MACHINE_DIR, 'managed-settings.d')
  const files = [...(existsSync(base) ? [base] : []), ...(existsSync(folder) ? (await readdir(folder)).toSorted().map((name) => join(folder, name)) : [])]
  const keys = new Set<string>()
  for (const file of files) {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (typeof value === 'object' && value !== null) for (const key of Object.keys(value)) keys.add(key)
  }
  return { present: files.length > 0, keys: [...keys].toSorted() }
}

/** A value with object keys sorted and every list as a sorted set. */
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const items = value.map(canonical).map((item) => JSON.stringify(item))
    return [...new Set(items)].toSorted().map((item) => JSON.parse(item) as unknown)
  }
  if (value === null || typeof value !== 'object') return value
  const entries = Object.entries(value).map(([key, inner]) => [key, canonical(inner)] as const)
  return Object.fromEntries(entries.toSorted(([a], [b]) => a.localeCompare(b)))
}
const text = (file: unknown): string => (typeof file === 'string' ? file : JSON.stringify(file))
const modeOf = (value: unknown): string => (value === 'manual' || typeof value !== 'string' || value === '' ? 'default' : value)

/** The case's files on disk: user in the config folder, project and local in a project folder. */
async function writeCase(one: SettingsCase, dir: string): Promise<void> {
  await mkdir(join(dir, 'config'), { recursive: true })
  await mkdir(join(dir, 'project', '.claude'), { recursive: true })
  const paths = {
    user: join(dir, 'config', 'settings.json'),
    project: join(dir, 'project', '.claude', 'settings.json'),
    local: join(dir, 'project', '.claude', 'settings.local.json'),
  }
  for (const tier of TIERS) if (one[tier] !== undefined) await writeFile(paths[tier], text(one[tier]))
}

type Sdk = typeof import('@anthropic-ai/claude-agent-sdk')

/** The SDK resolver's value of each key, and the mode it would start in. */
async function sdkSide(sdk: Sdk, one: SettingsCase, dir: string): Promise<Record<string, unknown>> {
  process.env['CLAUDE_CONFIG_DIR'] = join(dir, 'config')
  const resolved = await sdk.resolveSettings({
    cwd: join(dir, 'project'),
    settingSources: ['user', 'project', 'local'],
    ...(one.parent !== undefined && { managedSettings: one.parent as never }),
  })
  const effective: Record<string, unknown> = resolved.effective
  const mode = modeOf(sdk.filterEscalatingDefaultMode(resolved).permissions?.defaultMode)
  return Object.fromEntries(one.keys.flatMap((key) => (key === 'defaultMode' ? [[key, mode]] : effective[key] === undefined ? [] : [[key, canonical(effective[key])]])))
}

/** The mode `claude -p` starts in for the case's files, read from `init`. */
async function cliMode(dir: string, home: string): Promise<string | undefined> {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '1', '--setting-sources', 'user,project,local', 'hi']
  const init = await initOf([CLAUDE_BIN, ...args], { cwd: join(dir, 'project'), env: isolatedEnv({ home, config: join(dir, 'config') }) })
  return init === undefined ? undefined : modeOf(init.permissionMode)
}

/** The part of the record that carries behaviour: the managed keys and the cases. */
const behaviourOf = (value: { managed?: unknown; cases?: unknown } | undefined): string => JSON.stringify([value?.managed, value?.cases])

export async function recordSettings({ release, check }: RecordContext): Promise<Recorded> {
  const scratch = await mkdtemp(join(tmpdir(), 'settings-oracle-'))
  const home = join(scratch, 'home')
  process.env['HOME'] = home
  process.env['CLAUDE_CONFIG_DIR'] = join(scratch, 'config')
  try {
    // Imported after HOME moves, so the resolver never reads the person's user settings.
    const sdk: Sdk = await import('@anthropic-ai/claude-agent-sdk')
    const sdkVersion = ((await Bun.file(join(import.meta.dir, '..', '..', '..', 'node_modules', '@anthropic-ai', 'claude-agent-sdk', 'package.json')).json()) as { version: string }).version
    const cases = []
    for (const [index, one] of SETTINGS_CASES.entries()) {
      const dir = join(scratch, `case-${index}`)
      await writeCase(one, dir)
      const cli = one.keys.includes('defaultMode') ? await cliMode(dir, home) : undefined
      cases.push({ ...one, sdk: await sdkSide(sdk, one, dir), ...(cli !== undefined && { cli }) })
    }
    const fresh = { claudeCodeVersion: release, sdkVersion, managed: await machineManaged(), cases }
    const changed = await record(FILE, fresh, check, (previous) => previous !== '' && behaviourOf(JSON.parse(previous) as typeof fresh) === behaviourOf(fresh))
    return { changed: changed ? 1 : 0, summary: `${cases.length} cases` }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
