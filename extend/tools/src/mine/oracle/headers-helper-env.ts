/**
 * `oracle:record headers-helper-env`: which variables Claude Code removes from the environment of a
 * `headersHelper` a project `.mcp.json` supplies (mcp.md, "Which variables a helper can read", gives
 * the rule by example). Every candidate of `conformance/oracle/headers-helper-env/candidates.txt` is
 * set to a dummy value (a proxy to an address `NO_PROXY` bypasses), a trusted private project names
 * one server whose helper prints the names it received as a header, `claude mcp get` connects to a
 * local HTTP server, and the names that did not arrive were removed. The run gets a bare environment
 * and a private config folder; no model is called. Records `expected.json`: `{ claudeCodeVersion,
 * removed, kept }`, both sorted.
 */
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'

const DIR = join(ORACLE_DIR, 'headers-helper-env')
const PROXY = /proxy$/i
const UNUSED_PROXY = 'http://127.0.0.1:9'

/** A candidate's dummy value: a proxy must parse as a URL or Claude Code refuses to start. */
const valueOf = (name: string): string => {
  if (/^no_proxy$/i.test(name)) return '127.0.0.1,localhost'
  return PROXY.test(name) && !/^goproxy$/i.test(name) ? UNUSED_PROXY : 'v'
}

/** The names the helper received. */
async function probe(names: readonly string[]): Promise<Set<string>> {
  const work = await realpath(await mkdtemp(join(tmpdir(), 'oracle-helper-env-')))
  let received: string | undefined
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request) {
      received ??= request.headers.get('x-names') ?? undefined
      return new Response('not an MCP server', { status: 404 })
    },
  })
  try {
    const project = join(work, 'project')
    const config = join(work, 'config')
    await mkdir(project, { recursive: true })
    await mkdir(config, { recursive: true })
    const helper = join(project, 'helper.sh')
    await writeFile(helper, `#!/bin/sh\nprintf '{"x-names":"%s"}' "$(env | cut -d= -f1 | tr '\\n' ',')"\n`)
    await chmod(helper, 0o755)
    const url = `http://127.0.0.1:${server.port}/mcp`
    await writeFile(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { probe: { type: 'http', url, headersHelper: helper } } }))
    await writeFile(join(config, 'settings.json'), JSON.stringify({ enableAllProjectMcpServers: true }))
    await writeFile(join(config, '.claude.json'), JSON.stringify({ projects: { [project]: { hasTrustDialogAccepted: true } } }))
    const env: Record<string, string> = Object.fromEntries(names.map((name) => [name, valueOf(name)]))
    const run = Bun.spawn([CLAUDE_BIN, 'mcp', 'get', 'probe'], {
      cwd: project,
      env: { ...env, PATH: process.env['PATH'] ?? '', HOME: work, CLAUDE_CONFIG_DIR: config },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await run.exited
  } finally {
    await server.stop(true)
    await rm(work, { recursive: true, force: true })
  }
  if (received === undefined) throw new Error('the headersHelper never reached the local server')
  return new Set(received.split(','))
}

const removedOf = (text: string): string => JSON.stringify(text === '' ? undefined : (JSON.parse(text) as { removed?: unknown }).removed)

export async function recordHeadersHelperEnv({ release, check }: RecordContext): Promise<Recorded> {
  const candidates = (await readFile(join(DIR, 'candidates.txt'), 'utf8')).split('\n').filter((line) => line.trim() !== '')
  const got = await probe(candidates)
  const fresh = {
    claudeCodeVersion: release,
    removed: candidates.filter((name) => !got.has(name)).toSorted(),
    kept: candidates.filter((name) => got.has(name)).toSorted(),
  }
  const changed = await record(join(DIR, 'expected.json'), fresh, check, (previous) => removedOf(previous) === JSON.stringify(fresh.removed))
  return { changed: changed ? 1 : 0, summary: `${candidates.length} names, ${fresh.removed.length} removed` }
}
