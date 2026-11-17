/**
 * `oracle:record remote-mcp-env`: which `${VAR}` names Claude Code reads as empty in a remote MCP
 * server's `url` and `headers` (mcp.md, "Credential variables that read as empty", lists them only
 * "such as"). A project `.mcp.json` names one header per candidate of
 * `conformance/oracle/remote-mcp-env/candidates.txt`, `claude mcp get` connects to a local HTTP
 * server, and the header values it receives say which names were emptied. A covered name reads as
 * empty whether or not it is set, so no variable is set: the run gets a bare environment and a
 * private config folder. No model is called. Records `expected.json`: `{ claudeCodeVersion, empty,
 * kept }`, both sorted.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLAUDE_BIN } from '../claude-bin.ts'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'

const DIR = join(ORACLE_DIR, 'remote-mcp-env')
/** Headers per run: a request with several hundred headers is not sent at all. */
const CHUNK = 150

/** The header values one `claude mcp get` sends for these names, by name. */
async function probe(names: readonly string[]): Promise<Map<string, string>> {
  const work = await mkdtemp(join(tmpdir(), 'oracle-remote-mcp-env-'))
  const received = new Map<string, string>()
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    fetch(request) {
      names.forEach((name, index) => {
        const value = request.headers.get(`x-probe-${index}`)
        if (value !== null) received.set(name, value)
      })
      return new Response('not an MCP server', { status: 404 })
    },
  })
  try {
    const project = join(work, 'project')
    const config = join(work, 'config')
    await mkdir(project, { recursive: true })
    await mkdir(config, { recursive: true })
    await writeFile(join(config, 'settings.json'), JSON.stringify({ enableAllProjectMcpServers: true }))
    const headers = Object.fromEntries(names.map((name, index) => [`x-probe-${index}`, `<\${${name}}>`]))
    const url = `http://127.0.0.1:${server.port}/mcp`
    await writeFile(join(project, '.mcp.json'), JSON.stringify({ mcpServers: { probe: { type: 'http', url, headers } } }))
    const run = Bun.spawn([CLAUDE_BIN, 'mcp', 'get', 'probe'], {
      cwd: project,
      env: { PATH: process.env['PATH'] ?? '', HOME: work, CLAUDE_CONFIG_DIR: config },
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await run.exited
  } finally {
    await server.stop(true)
    await rm(work, { recursive: true, force: true })
  }
  if (received.size !== names.length) throw new Error(`claude sent ${received.size} of ${names.length} probe headers`)
  return received
}

const emptyOf = (text: string): string => JSON.stringify(text === '' ? undefined : (JSON.parse(text) as { empty?: unknown }).empty)

export async function recordRemoteMcpEnv({ release, check }: RecordContext): Promise<Recorded> {
  const candidates = (await readFile(join(DIR, 'candidates.txt'), 'utf8')).split('\n').filter((line) => line.trim() !== '')
  const empty: string[] = []
  const kept: string[] = []
  for (let start = 0; start < candidates.length; start += CHUNK) {
    const names = candidates.slice(start, start + CHUNK)
    const received = await probe(names)
    for (const name of names) (received.get(name) === '<>' ? empty : kept).push(name)
  }
  const fresh = { claudeCodeVersion: release, empty: empty.toSorted(), kept: kept.toSorted() }
  const changed = await record(join(DIR, 'expected.json'), fresh, check, (previous) => emptyOf(previous) === JSON.stringify(fresh.empty))
  return { changed: changed ? 1 : 0, summary: `${candidates.length} names, ${empty.length} empty` }
}
