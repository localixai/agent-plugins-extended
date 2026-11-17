/**
 * `oracle:record subprocess-scrub`: what Claude Code leaves of each variable in a hook's environment
 * under `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` (env-vars.md, "What the subprocess environment scrub
 * removes", gives the rule by example). Every candidate of
 * `conformance/oracle/subprocess-scrub/candidates.json` is set in a bare environment with a private
 * config folder whose user settings hold one SessionStart hook that prints its environment; the API
 * address is one nobody listens on, so no model is called and no person's credential is set. The run
 * stops once the hook has written. Records `expected.json` beside the candidates:
 * `{ claudeCodeVersion, left }`, `left[name]` the value the hook received or `null` when removed.
 */
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { NOBODY } from './isolated.ts'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'

const DIR = join(ORACLE_DIR, 'subprocess-scrub')
const WAIT_MS = 60_000

const candidatesSchema = z.array(z.object({ name: z.string(), value: z.string() }))
type Candidate = z.infer<typeof candidatesSchema>[number]

/** `env` output as variables; a value runs to the end of its line. */
const parseEnv = (text: string): Map<string, string> =>
  new Map(
    text
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )

async function waitForFile(path: string): Promise<string | undefined> {
  for (let waited = 0; waited < WAIT_MS; waited += 250) {
    const text = await readFile(path, 'utf8').catch(() => undefined)
    if (text !== undefined && text.endsWith('\n')) return text
    await Bun.sleep(250)
  }
  return undefined
}

/** What the hook received. */
async function probe(candidates: readonly Candidate[]): Promise<Map<string, string>> {
  const work = await realpath(await mkdtemp(join(tmpdir(), 'oracle-scrub-')))
  const config = join(work, 'config')
  const out = join(work, 'out.txt')
  await mkdir(join(work, 'cwd'), { recursive: true })
  await mkdir(config, { recursive: true })
  const hook = { type: 'command', command: `env > ${out}.tmp && mv ${out}.tmp ${out}` }
  await writeFile(join(config, 'settings.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [hook] }] } }))
  const env = Object.fromEntries(candidates.map(({ name, value }) => [name, value]))
  const run = Bun.spawn([CLAUDE_BIN, '-p', '--setting-sources', 'user', '--max-turns', '1', 'hi'], {
    cwd: join(work, 'cwd'),
    env: {
      ...env,
      PATH: process.env['PATH'] ?? '',
      HOME: work,
      CLAUDE_CONFIG_DIR: config,
      ANTHROPIC_BASE_URL: NOBODY,
      CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: '1',
    },
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  })
  try {
    const text = await waitForFile(out)
    if (text === undefined) throw new Error('the SessionStart hook never wrote its environment')
    return parseEnv(text)
  } finally {
    run.kill()
    await run.exited
    await rm(work, { recursive: true, force: true })
  }
}

const leftOf = (text: string): string => JSON.stringify(text === '' ? undefined : (JSON.parse(text) as { left?: unknown }).left)

export async function recordScrub({ release, check }: RecordContext): Promise<Recorded> {
  const candidates = candidatesSchema.parse(JSON.parse(await readFile(join(DIR, 'candidates.json'), 'utf8')))
  const got = await probe(candidates)
  const fresh = { claudeCodeVersion: release, left: Object.fromEntries(candidates.map(({ name }) => [name, got.get(name) ?? null])) }
  const removed = Object.values(fresh.left).filter((value) => value === null).length
  const changed = await record(join(DIR, 'expected.json'), fresh, check, (previous) => leftOf(previous) === JSON.stringify(fresh.left))
  return { changed: changed ? 1 : 0, summary: `${candidates.length} variables, ${removed} removed` }
}
