/**
 * What kind of check an oracle error is, by its message: the kinds a JSON Schema cannot state
 * (a path on disk, a reference across files, a validator policy) and, for one our schemas could
 * state but did not match, `expressible`.
 */
const KINDS: ReadonlyArray<readonly [kind: string, pattern: RegExp]> = [
  ['reserved name (validator policy; the client still loads it)', /is reserved: it passes as one of Anthropic's own|impersonates an official/],
  ['path existence on disk', /^Path not found|Path is a file|does not exist|is not a directory/],
  ['no manifest or file at the validated path', /^No manifest found in directory|^File not found/],
  ['undeclared ${user_config.*} reference (cross-file)', /references \$\{user_config\./],
  ['duplicate names across entries', /^Duplicate plugin name|names must be unique/],
  ['options cross-field rule (default among options, case-folded repeats)', /default must be one of the options|cannot repeat a value/],
  ['renames chain', /^renames\.|chain does not resolve/],
  ['file system (symbolic link, not a regular file)', /symlink|not a regular file/],
  ['hooks module code (mods, section 10)', /hooks module|not named like code/],
]

export function classify(message: string): string {
  for (const [kind, pattern] of KINDS) if (pattern.test(message)) return kind
  return 'expressible'
}

/** The message with names and numbers taken out, so like errors group together. */
export const shape = (message: string): string =>
  message
    .replace(/"[^"]*"/g, '"…"')
    .replace(/'[^']*'/g, "'…'")
    .replace(/(^|\s)\.?\.?\/\S*/g, '$1<path>')
    .replace(/\d+/g, 'N')
    .slice(0, 160)
