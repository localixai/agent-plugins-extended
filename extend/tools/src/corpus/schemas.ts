/**
 * The Claude Code schemas of `extend/schemas/1.1.0/claude-code/`, compiled once with a JSON Schema
 * 2020-12 validator. Each file kind the corpus check reads has one schema.
 */
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { EXTEND } from '../paths.ts'

export const SCHEMAS = join(EXTEND, 'schemas', '1.1.0', 'claude-code')

/** The file kinds the check validates, each named after its schema file. */
export const KINDS = [
  'plugin',
  'marketplace',
  'hooks',
  'mcp',
  'lsp',
  'monitors',
  'plugin-settings',
  'skill-frontmatter',
  'agent-frontmatter',
  'command-frontmatter',
  'output-style-frontmatter',
  'theme',
] as const
export type Kind = (typeof KINDS)[number]

export interface SchemaError {
  /** Dotted instance path, `plugins.0.name`; empty for the root. */
  readonly path: string
  readonly message: string
  /** A keyword that only gathers the errors of its subschemas (`anyOf`, `if`, ...). */
  readonly composite: boolean
  /** For a missing property, the object that lacks it: the oracle may name another field of it. */
  readonly object?: string
}

const COMPOSITE = new Set(['anyOf', 'oneOf', 'allOf', 'if'])

const dotted = (pointer: string): string =>
  pointer
    .split('/')
    .slice(1)
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .join('.')

const describe = (error: ErrorObject): SchemaError => ({
  // A missing property is reported where the oracle reports it: at the property.
  path: [dotted(error.instancePath), error.keyword === 'required' ? String(error.params.missingProperty) : '']
    .filter(Boolean)
    .join('.'),
  composite: COMPOSITE.has(error.keyword),
  ...(error.keyword === 'required' ? { object: dotted(error.instancePath) } : {}),
  message: `${error.keyword}: ${error.message ?? ''}${
    error.keyword === 'additionalProperties' ? ` (${String(error.params.additionalProperty)})` : ''
  }`,
})

export type Validate = (value: unknown) => readonly SchemaError[]

/** Every schema of the folder, added under its `$id` so the files can refer to one another. */
export interface Schemas {
  /** The verdict: what Claude Code accepts. */
  readonly accepts: ReadonlyMap<Kind, Validate>
  /** For a file whose bad values Claude Code drops rather than refuses, the values that take effect. */
  readonly effective: ReadonlyMap<Kind, Validate>
}

const asValidate =
  (validate: ValidateFunction): Validate =>
  (value) =>
    validate(value) ? [] : (validate.errors ?? []).map(describe)

export async function loadSchemas(): Promise<Schemas> {
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false, strictRequired: false })
  const files = (await readdir(SCHEMAS)).filter((name) => name.endsWith('.schema.json'))
  for (const file of files) ajv.addSchema(await Bun.file(join(SCHEMAS, file)).json())
  const accepts = new Map<Kind, Validate>()
  const effective = new Map<Kind, Validate>()
  for (const kind of KINDS) {
    const id = `https://localix.ai/schemas/agent-plugins-extended/1.1.0/claude-code/${kind}.schema.json`
    const validate = ajv.getSchema(id)
    if (!validate) throw new Error(`no schema ${kind}.schema.json in ${SCHEMAS}`)
    accepts.set(kind, asValidate(validate))
    const schema = validate.schema as { $defs?: Record<string, unknown> }
    if (schema.$defs?.effective !== undefined) {
      const values = ajv.getSchema(`${id}#/$defs/effective`)
      if (values) effective.set(kind, asValidate(values))
    }
  }
  return { accepts, effective }
}
