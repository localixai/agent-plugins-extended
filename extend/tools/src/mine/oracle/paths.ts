/**
 * Where the oracle runs keep what Claude Code did. The small outcomes of the fixtures written for
 * them are committed in `conformance/oracle/<oracle>/`, beside the fixtures, so that an
 * implementation syncs them and its tests read them; the large ones (every corpus plugin) are cached
 * per release in `extend/.cache/oracle/<release>/` (or `ORACLE_CACHE_DIR`) and never committed
 * (conformance/README.md, "Oracle runs").
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { CONFORMANCE } from '../../paths.ts'
import { CACHE } from '../paths.ts'

export const ORACLE_DIR = join(CONFORMANCE, 'oracle')
export const ORACLE_CACHE = process.env['ORACLE_CACHE_DIR'] ?? join(CACHE, 'oracle')

/** The cache of one release's outcomes. */
export const cacheOf = (release: string): string => join(ORACLE_CACHE, release)

/** A JSON file as the recorders write it: two spaces, a final newline. */
export const jsonText = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`

export async function writeText(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, text)
}

/** The text of a file, or '' when there is none. */
export const textOf = async (path: string): Promise<string> => Bun.file(path).text().catch(() => '')

/**
 * What one recorder did: how many outcomes it wrote or, under `--check`, how many differ from the
 * recorded ones.
 */
export interface Recorded {
  readonly changed: number
  readonly summary: string
}

/** The options every recorder takes. */
export interface RecordContext {
  /** The release of the program that answers (`claude --version`). */
  readonly release: string
  /** Compare with the recorded outcomes and write nothing. */
  readonly check: boolean
}

/** Whether a recorded file holds this value, whatever its layout. */
const holds = (previous: string, fresh: unknown): boolean => previous !== '' && JSON.stringify(JSON.parse(previous)) === JSON.stringify(fresh)

/**
 * Writes an outcome unless `--check`; whether it differs from the one recorded. `same` compares the
 * part that carries behaviour (a release field alone is not a change); by default the whole value.
 */
export async function record(
  path: string,
  fresh: unknown,
  check: boolean,
  same: (previous: string) => boolean = (previous) => holds(previous, fresh),
): Promise<boolean> {
  const changed = !same(await textOf(path))
  if (changed && !check) await writeText(path, jsonText(fresh))
  return changed
}
