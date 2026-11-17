/**
 * `bun run mine <release>`: everything the specification takes from one Claude Code release, in
 * order (conformance/SOURCE.md, "Updating to a new Claude Code release"):
 *
 * 1. `docs:pull` when the docs of the release are not cached. The docs site serves only the current
 *    release, so an older one must already be in `extend/.cache/claude-docs/<release>/`.
 * 2. `types:pull` when its declarations are not cached, with `CLAUDE_ORACLE_BIN` defaulting to
 *    `~/.local/share/claude/versions/<release>`.
 * 3. `types:extract` and `spec:extract`: the snapshots in `conformance/`.
 * 4. `oracle:record`: what the release does on the fixtures of `conformance/oracle/`.
 * 5. `corpus:fetch`, `corpus:oracle` and `oracle:record corpus-runtime`: the corpus and Claude Code's
 *    verdicts and sessions on it.
 *
 * Stops at the first step that fails.
 *
 *   bun run mine <release> [--refresh] [--skip-corpus]
 *     --refresh       pull docs and declarations again, and fetch the corpus again
 *     --skip-corpus   stop after the snapshots and the fixture oracles
 */
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { docsDir, typesDir } from './paths.ts'

const TOOLS = join(import.meta.dir, '..', '..')
const args = process.argv.slice(2)
const release = args.find((arg) => /^\d+\.\d+\.\d+$/.test(arg))
if (release === undefined) {
  console.error('usage: bun run mine <release> [--refresh] [--skip-corpus]')
  process.exit(2)
}
const refresh = args.includes('--refresh')

const installed = join(homedir(), '.local', 'share', 'claude', 'versions', release)
const env = {
  ...process.env,
  ...(process.env['CLAUDE_ORACLE_BIN'] === undefined && existsSync(installed) && { CLAUDE_ORACLE_BIN: installed }),
}

async function step(script: string, ...rest: string[]): Promise<void> {
  console.log(`\n== bun run ${[script, ...rest].join(' ')}`)
  const run = Bun.spawn(['bun', 'run', script, ...rest], { cwd: TOOLS, env, stdio: ['inherit', 'inherit', 'inherit'] })
  const code = await run.exited
  if (code !== 0) {
    console.error(`mine: ${script} failed (exit ${code})`)
    process.exit(code)
  }
}

const cached = (dir: string): boolean => existsSync(join(dir, 'VERSION'))

if (refresh || !cached(docsDir(release))) await step('docs:pull')
if (!cached(docsDir(release))) {
  console.error(`mine: the docs site no longer serves ${release}, and its docs are not cached`)
  process.exit(1)
}
if (refresh || !cached(typesDir(release))) await step('types:pull')
if (!cached(typesDir(release))) {
  console.error(`mine: the declarations pulled are not ${release}'s: set CLAUDE_ORACLE_BIN to that program`)
  process.exit(1)
}
await step('types:extract', release)
await step('spec:extract', release)
await step('oracle:record')
if (!args.includes('--skip-corpus')) {
  await step('corpus:fetch', ...(refresh ? ['--refresh'] : []))
  await step('corpus:oracle', release)
  await step('oracle:record', 'corpus-runtime')
}
console.log(`\nmine: Claude Code ${release} done; update conformance/SOURCE.md and run \`bun run coverage\``)
