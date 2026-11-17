/**
 * The Claude Code program every oracle runs, as a black box: `CLAUDE_ORACLE_BIN` when it is set (the
 * path of one installed release, such as `~/.local/share/claude/versions/2.1.319`), else `claude` on
 * `PATH`. Its release is read from the program's own `--version`, so a cache names the program that
 * answered, never the release the requirements were extracted from.
 */
export const CLAUDE_BIN = process.env['CLAUDE_ORACLE_BIN'] ?? 'claude'

/** `x.y.z` from `<bin> --version`, or undefined when the program does not run. */
export async function claudeVersion(): Promise<string | undefined> {
  try {
    const run = Bun.spawn([CLAUDE_BIN, '--version'], { stdout: 'pipe', stderr: 'ignore' })
    const text = await new Response(run.stdout).text()
    await run.exited
    return /^(\d+\.\d+\.\d+)/.exec(text.trim())?.[1]
  } catch {
    return undefined
  }
}
