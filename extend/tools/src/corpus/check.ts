/**
 * One plugin's files against our schemas, and the comparison with the oracle's errors for each
 * file: a file we refuse where the oracle has no error is a false reject; an oracle error that
 * one of ours on the same file reaches (one path a prefix of the other) is matched; the rest is
 * the remainder.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readFrontmatter } from './frontmatter.ts'
import type { PluginFile } from './files.ts'
import type { OracleError } from './oracle.ts'
import type { Kind, SchemaError, Schemas } from './schemas.ts'

export interface FileVerdict {
  readonly file: string
  readonly kind: Kind
  readonly ours: readonly SchemaError[]
  readonly oracle: readonly OracleError[]
  readonly matched: readonly OracleError[]
  readonly unmatched: readonly OracleError[]
  /** Our errors that reach no oracle error of the file: a refusal the oracle does not confirm. */
  readonly unconfirmed: readonly SchemaError[]
  /** Values Claude Code drops without refusing the file ($defs/effective), when the kind has such a schema. */
  readonly ignored: readonly SchemaError[]
}

const FRONTMATTER = new Set<Kind>([
  'skill-frontmatter',
  'agent-frontmatter',
  'command-frontmatter',
  'output-style-frontmatter',
])

/** What the schema of `kind` is given, or the error that keeps it from being read at all. */
function readValue(text: string, kind: Kind): { value?: unknown; error?: SchemaError; skip?: true } {
  if (FRONTMATTER.has(kind)) {
    const read = readFrontmatter(text)
    if (read.state === 'none') return { skip: true }
    if (read.state === 'invalid') return { error: { path: 'frontmatter', message: `YAML: ${read.problem}`, composite: false } }
    return { value: read.value }
  }
  // Claude Code reads plugin.json past a byte order mark and refuses one in any other JSON file
  // (Judgment J2.3).
  try {
    return { value: JSON.parse(kind === 'plugin' ? text.replace(/^\uFEFF/, '') : text) }
  } catch (thrown) {
    return { error: { path: 'json', message: `JSON: ${(thrown as Error).message}`, composite: false } }
  }
}

const segments = (path: string): string[] => (path === '' || path === 'root' ? [] : path.split('.'))

/** One path names a part of the other, or one names the whole file. */
function reaches(ours: string, theirs: string): boolean {
  const a = segments(ours)
  const b = segments(theirs)
  const n = Math.min(a.length, b.length)
  return a.slice(0, n).join('.') === b.slice(0, n).join('.')
}

/** Oracle paths that name the whole file rather than a field of it. */
const WHOLE = /^(root|directory|file)$/
/** A file that does not parse: matched only by our own parse failure. */
const SYNTAX = /^(json|frontmatter)$/

function oracleReach(error: OracleError, kind: Kind): string {
  if (WHOLE.test(error.path)) return ''
  // A hooks file's errors are all reported at `hooks`, the event path is in the message.
  if (kind === 'hooks' && error.path === 'hooks') return ''
  return error.path
}

export function checkFiles(
  root: string,
  files: readonly PluginFile[],
  oracle: readonly OracleError[],
  schemas: Schemas,
): FileVerdict[] {
  return files.map(({ file, kind }) => {
    const read = readValue(readFileSync(join(root, file), 'utf8'), kind)
    const validate = schemas.accepts.get(kind)
    const parsed = !read.skip && !read.error
    const ours: SchemaError[] = read.error ? [read.error] : parsed ? [...(validate?.(read.value) ?? [])] : []
    const ignored = parsed ? (schemas.effective.get(kind)?.(read.value) ?? []) : []
    const theirs = oracle.filter((error) => error.file === file)
    const leaves = ours.some((mine) => !mine.composite) ? ours.filter((mine) => !mine.composite) : ours
    const matched = theirs.filter((error) =>
      leaves.some((mine) =>
        SYNTAX.test(error.path) || SYNTAX.test(mine.path)
          ? mine.path === error.path
          : reaches(mine.path, oracleReach(error, kind)) ||
            (Boolean(mine.object) && reaches(mine.object ?? '', oracleReach(error, kind))),
      ),
    )
    const unmatched = theirs.filter((error) => !matched.includes(error))
    const unconfirmed = leaves.filter(
      (mine) =>
        !theirs.some((error) =>
          SYNTAX.test(error.path) || SYNTAX.test(mine.path)
            ? mine.path === error.path
            : reaches(mine.path, oracleReach(error, kind)) ||
              (Boolean(mine.object) && reaches(mine.object ?? '', oracleReach(error, kind))),
        ),
    )
    return { file, kind, ours, oracle: theirs, matched, unmatched, unconfirmed, ignored }
  })
}
