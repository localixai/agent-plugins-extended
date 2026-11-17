/**
 * The files of one plugin directory that a schema covers, found as Claude Code finds them: the
 * default locations of section 1.4 and the paths the manifest declares (chapter 2), and for a
 * marketplace the plugin.json of each relative-path entry (section 15.10). Symbolic links are not
 * followed, as the validator does not follow them.
 */
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, normalize, relative } from 'node:path'
import type { Kind } from './schemas.ts'

export interface PluginFile {
  /** Relative to the plugin directory, with `/` separators. */
  readonly file: string
  readonly kind: Kind
}

const isFile = (path: string): boolean => {
  try {
    return lstatSync(path).isFile()
  } catch {
    return false
  }
}
const isDirectory = (path: string): boolean => {
  try {
    return lstatSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Every regular file under `dir` whose name ends in `suffix`, symbolic links left out. */
function walk(dir: string, suffix: string, out: string[] = []): string[] {
  if (!isDirectory(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) walk(path, suffix, out)
    else if (entry.isFile() && entry.name.endsWith(suffix)) out.push(path)
  }
  return out
}

const strings = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter((v) => typeof v === 'string') : []

const readJson = (path: string): unknown => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

/** A declared path inside the plugin, or undefined for one that leaves it or is not relative. */
function inside(root: string, path: string): string | undefined {
  if (!path.startsWith('./') && path !== '.') return undefined
  const full = normalize(join(root, path))
  return relative(root, full).startsWith('..') ? undefined : full
}

export function pluginFiles(root: string): PluginFile[] {
  const found = new Map<string, Kind>()
  const add = (path: string, kind: Kind): void => {
    if (isFile(path)) found.set(relative(root, path).split('\\').join('/'), kind)
  }
  const manifestPath = join(root, '.claude-plugin', 'plugin.json')
  add(manifestPath, 'plugin')
  const marketplacePath = join(root, '.claude-plugin', 'marketplace.json')
  add(marketplacePath, 'marketplace')
  const marketplace = record(readJson(marketplacePath))
  if (marketplace && Array.isArray(marketplace.plugins)) {
    for (const entry of marketplace.plugins) {
      const source = record(entry)?.source
      if (typeof source !== 'string') continue
      const dir = inside(root, source)
      if (dir) add(join(dir, '.claude-plugin', 'plugin.json'), 'plugin')
    }
  }
  const hasManifest = isFile(manifestPath)
  // A marketplace root without a plugin.json is validated as a marketplace only (section 2.11).
  if (!hasManifest && isFile(marketplacePath)) return listed(root, found)
  const manifest = record(readJson(manifestPath)) ?? {}
  const experimental = record(manifest.experimental) ?? {}
  const declared = (key: unknown): string[] =>
    strings(key).flatMap((path) => inside(root, path) ?? [])

  markdownComponents(root, add)
  // Without a manifest the validator reads the Markdown components only (Judgment J2.3).
  if (!hasManifest) return listed(root, found)
  add(join(root, 'hooks', 'hooks.json'), 'hooks')
  for (const path of declared(manifest.hooks)) add(path, 'hooks')
  add(join(root, '.mcp.json'), 'mcp')
  for (const path of declared(manifest.mcpServers)) if (path.endsWith('.json')) add(path, 'mcp')
  add(join(root, '.lsp.json'), 'lsp')
  for (const path of declared(manifest.lspServers)) add(path, 'lsp')
  const monitors = experimental.monitors ?? manifest.monitors
  if (monitors === undefined) add(join(root, 'monitors', 'monitors.json'), 'monitors')
  for (const path of declared(monitors)) add(path, 'monitors')
  add(join(root, 'settings.json'), 'plugin-settings')

  const located = (key: unknown, fallback: string): string[] =>
    key === undefined ? [join(root, fallback)] : declared(key)
  for (const path of located(manifest.outputStyles, 'output-styles')) {
    for (const file of isDirectory(path) ? walk(path, '.md') : [path]) add(file, 'output-style-frontmatter')
  }
  for (const path of located(experimental.themes ?? manifest.themes, 'themes')) {
    for (const file of isDirectory(path) ? walk(path, '.json') : [path]) add(file, 'theme')
  }
  return listed(root, found)
}

const listed = (root: string, found: ReadonlyMap<string, Kind>): PluginFile[] =>
  [...found].map(([file, kind]) => ({ file, kind })).filter(({ file }) => existsSync(join(root, file)))

/**
 * Skills, agents and commands in their default folders, the files whose frontmatter the
 * validator reads (section 2.11); a folder the manifest declares instead is not read by it.
 */
function markdownComponents(root: string, add: (path: string, kind: Kind) => void): void {
  const skills = join(root, 'skills')
  if (isDirectory(skills)) {
    for (const entry of readdirSync(skills, { withFileTypes: true })) {
      if (entry.isDirectory()) add(join(skills, entry.name, 'SKILL.md'), 'skill-frontmatter')
    }
  }
  for (const file of walk(join(root, 'agents'), '.md')) add(file, 'agent-frontmatter')
  for (const file of walk(join(root, 'commands'), '.md')) {
    add(file, file.endsWith('/SKILL.md') ? 'skill-frontmatter' : 'command-frontmatter')
  }
}
