/**
 * `oracle:record validate-timings`: how long one `claude plugin validate <dir>` process takes, start
 * to exit, on the first 30 corpus plugins by `marketplace/name`, the median of 5 runs each, and on an
 * empty folder (the floor: the cost of starting the process with nothing to read). An
 * implementation's benchmark sets its own validator beside these on the same machine; timings belong
 * to the machine, so they are cached per release in `extend/.cache/oracle/<release>/` and never
 * committed. `--check` does not apply: timings always differ.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { readCorpusTargets } from '../corpus/location.ts'
import { cacheOf, jsonText, writeText, type RecordContext, type Recorded } from './paths.ts'

export const PLUGINS = 30
const REPS = 5

const median = (samples: readonly number[]): number => {
  const sorted = samples.toSorted((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value = sorted.length % 2 === 1 ? (sorted[middle] ?? 0) : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  return Math.round(value * 10) / 10
}

async function validateMs(dir: string): Promise<number> {
  const samples: number[] = []
  for (let rep = 0; rep < REPS; rep += 1) {
    const start = performance.now()
    await Bun.spawn([CLAUDE_BIN, 'plugin', 'validate', dir], { stdout: 'ignore', stderr: 'ignore' }).exited
    samples.push(performance.now() - start)
  }
  return median(samples)
}

export async function recordValidateTimings({ release, check }: RecordContext): Promise<Recorded> {
  if (check) return { changed: 0, summary: 'timings are not checked' }
  const targets = (await readCorpusTargets()).toSorted((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).slice(0, PLUGINS)
  const empty = await mkdtemp(join(tmpdir(), 'oracle-validate-'))
  let floor: number
  try {
    floor = await validateMs(empty)
  } finally {
    await rm(empty, { recursive: true })
  }
  const plugins: Record<string, number> = {}
  for (const target of targets) plugins[target.key] = await validateMs(target.dir)
  await writeText(join(cacheOf(release), 'validate-timings.json'), jsonText({ claudeCodeVersion: release, reps: REPS, floor, plugins }))
  return { changed: 0, summary: `${targets.length} plugins timed` }
}
