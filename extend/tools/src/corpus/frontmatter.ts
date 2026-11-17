/**
 * The frontmatter of a skill, agent, command or output style file, read as section 4.4.1 says: the
 * YAML between a `---` first line and the next `---` line. Claude Code retries a block its parser
 * refuses with each top-level `key: value` line quoted when the value holds a character plain YAML
 * cannot (Judgment J4.25), so the same retry runs here before a block counts as unparsable.
 */
import { parseDocument } from 'yaml'

export type Frontmatter =
  | { readonly state: 'none' }
  | { readonly state: 'ok'; readonly value: unknown }
  | { readonly state: 'invalid'; readonly problem: string }

const MARKER = /^---[ \t]*\r?$/
const OPTIONS = { prettyErrors: false, uniqueKeys: false, logLevel: 'error' } as const
const TOP_LEVEL = /^([A-Za-z_][\w-]*:[ \t]+)(\S.*)$/
const SPECIAL = /[{}[\]*&#!|>%@`]|: /

const wrapped = (value: string): boolean =>
  value.length > 1 && (value.startsWith('"') || value.startsWith("'")) && value.endsWith(value.charAt(0))

function quoteRefused(line: string): string {
  const match = TOP_LEVEL.exec(line)
  const value = match?.[2]?.trimEnd()
  if (!match || value === undefined || wrapped(value) || !SPECIAL.test(value)) return line
  return `${match[1]}'${value.replaceAll("'", "''")}'`
}

function block(text: string): string | undefined {
  const lines = text.replace(/^﻿/, '').split('\n')
  if (!MARKER.test(lines[0] ?? '')) return undefined
  const end = lines.findIndex((line, index) => index > 0 && MARKER.test(line))
  if (end < 0) return undefined
  return lines
    .slice(1, end)
    .map((line) => line.replace(/\r$/, ''))
    .join('\n')
}

function parse(yaml: string): { value?: unknown; problem?: string } {
  const document = parseDocument(yaml, OPTIONS)
  const [first] = document.errors
  if (first) return { problem: first.message }
  try {
    return { value: document.toJS() ?? null }
  } catch (thrown) {
    return { problem: thrown instanceof Error ? thrown.message : String(thrown) }
  }
}

export function readFrontmatter(text: string): Frontmatter {
  const yaml = block(text)
  if (yaml === undefined) return { state: 'none' }
  let read = parse(yaml)
  if (read.problem !== undefined) {
    const quoted = yaml.split('\n').map(quoteRefused).join('\n')
    if (quoted !== yaml) {
      const retry = parse(quoted)
      if (retry.problem === undefined) read = retry
    }
  }
  return read.problem === undefined
    ? { state: 'ok', value: read.value }
    : { state: 'invalid', problem: read.problem }
}
