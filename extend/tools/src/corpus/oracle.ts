/**
 * Claude Code's own verdict on one plugin: the findings `claude plugin validate` printed for it
 * (`<corpus>/oracle/<release>/<marketplace>/<name>.json`), with each error placed on the file it
 * is about. A marketplace finding prefixed `plugins[<i>] plugin.json →` is about the plugin.json of
 * entry `<i>` (section 15.10), so it is placed on that file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join, normalize, relative } from 'node:path'

export interface OracleError {
  /** Relative to the plugin directory; empty when the finding names no file of it. */
  readonly file: string
  /** Dotted path, `[i]` written `.i`. */
  readonly path: string
  readonly message: string
}

export interface Oracle {
  readonly ran: boolean
  readonly errors: readonly OracleError[]
}

interface Finding {
  readonly severity: string
  readonly file?: string
  readonly path?: string
  readonly message: string
}

const ENTRY = /^plugins\[(\d+)\] plugin\.json → (.*)$/

export const dottedPath = (path: string): string => path.replace(/\[(\d+)\]/g, '.$1')

function entryManifest(root: string, index: number): string {
  try {
    const catalog = JSON.parse(readFileSync(join(root, '.claude-plugin', 'marketplace.json'), 'utf8'))
    const source: unknown = catalog?.plugins?.[index]?.source
    if (typeof source !== 'string') return ''
    return relative(root, normalize(join(root, source, '.claude-plugin', 'plugin.json')))
  } catch {
    return ''
  }
}

export function readOracle(path: string, root: string): Oracle | undefined {
  if (!existsSync(path)) return undefined
  const raw = JSON.parse(readFileSync(path, 'utf8')) as { ran?: boolean; findings?: Finding[] }
  const errors: OracleError[] = []
  for (const finding of raw.findings ?? []) {
    if (finding.severity !== 'error') continue
    let file = finding.file ?? ''
    if (file.startsWith('/')) file = ''
    let at = finding.path ?? ''
    const entry = ENTRY.exec(at)
    if (entry && file.endsWith('marketplace.json')) {
      file = entryManifest(root, Number(entry[1]))
      at = entry[2] ?? ''
    }
    errors.push({ file, path: dottedPath(at), message: finding.message })
  }
  return { ran: raw.ran === true, errors }
}
