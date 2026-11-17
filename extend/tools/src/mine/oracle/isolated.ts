/**
 * How every oracle run keeps the person's machine out of Claude Code: a private home, config folder
 * and working folder, no inherited variable but `PATH`, an invalid key and an API address nothing
 * listens on unless the oracle serves one itself. And the reader of a `stream-json` transcript's
 * `init` event, where a session lists what it registered.
 */
import { z } from 'zod'

export const NOBODY = 'http://127.0.0.1:9'
export const TIMEOUT_MS = 120_000

export const isolatedEnv = (dirs: { home: string; config: string }): Record<string, string> => ({
  PATH: process.env['PATH'] ?? '',
  HOME: dirs.home,
  CLAUDE_CONFIG_DIR: dirs.config,
  ANTHROPIC_API_KEY: 'sk-ant-invalid-for-oracle',
  ANTHROPIC_BASE_URL: NOBODY,
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_TELEMETRY: '1',
  DISABLE_AUTOUPDATER: '1',
})

/** The fields of `init` the oracles read; the event has more, which a release may change. */
export const initSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  claude_code_version: z.string(),
  agents: z.array(z.string()),
  slash_commands: z.array(z.string()),
  skills: z.array(z.string()),
  mcp_servers: z.array(z.object({ name: z.string(), status: z.string() }).loose()),
  plugins: z.array(z.object({ name: z.string() }).loose()),
  output_style: z.string(),
  permissionMode: z.string().optional(),
})
export type RuntimeInit = z.infer<typeof initSchema>

/** The first `init` event of some stream-json lines, if there is one. */
export function parseInit(stdout: string): RuntimeInit | undefined {
  for (const line of stdout.split('\n')) {
    if (!line.includes('"init"')) continue
    try {
      const parsed = initSchema.safeParse(JSON.parse(line))
      if (parsed.success) return parsed.data
    } catch {
      // not a JSON line
    }
  }
  return undefined
}

/** The first `init` of a stream-json stdout, read line by line; the reader stops there. */
export async function firstInit(stdout: ReadableStream<Uint8Array>): Promise<RuntimeInit | undefined> {
  const decoder = new TextDecoder()
  let pending = ''
  for await (const chunk of stdout) {
    pending += decoder.decode(chunk, { stream: true })
    const lines = pending.split('\n')
    pending = lines.pop() ?? ''
    const init = parseInit(lines.join('\n'))
    if (init !== undefined) return init
  }
  return parseInit(pending)
}

/** Runs `claude` with these arguments and environment until its first `init`, then stops it. */
export async function initOf(command: readonly string[], options: { cwd: string; env: Record<string, string> }): Promise<RuntimeInit | undefined> {
  const run = Bun.spawn([...command], { ...options, stdout: 'pipe', stderr: 'ignore', stdin: 'ignore' })
  const timer = setTimeout(() => run.kill(), TIMEOUT_MS)
  try {
    return await firstInit(run.stdout)
  } finally {
    run.kill()
    await run.exited
    clearTimeout(timer)
  }
}
