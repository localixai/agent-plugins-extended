# 6. Output styles and themes

A plugin can change how Claude responds (an *output style*) and how the client's interface is
coloured (a *theme*). Both are files the user can also write, and a plugin's appear in the same
pickers as the user's own. Evidence: `output-styles.md` for §6.1, `terminal-config.md` ("Create a
custom theme") for §6.2, and `plugins/components.md` ("Themes and output styles") for what a
plugin adds to both, unless a paragraph names another page.

## 6.1 Output styles

An output style is a set of instructions the client sends to the model with every request of a
session, to set Claude's role, tone and response format. It is an instruction the model follows,
not a rule the client enforces.

### 6.1.1 The file

1. An output style is a Markdown file: an optional YAML frontmatter block between `---` lines at the
   top, then a body. The body is the style's instructions. A file without frontmatter is a style
   whose fields are all unset.
2. Every frontmatter field is optional:

   | Field | Type | Default | Meaning |
   | --- | --- | --- | --- |
   | `name` | string | the file name without `.md` | The style's name, shown in the `/config` picker and used to select it (§6.1.3). <!-- req: outputStyles.frontmatter.name --> |
   | `description` | string | none | Text shown beside the name in the `/config` picker and the `/output-style` list. <!-- req: outputStyles.frontmatter.description --> |
   | `keep-coding-instructions` | boolean | `false` | When `true`, the client keeps its own section of software engineering instructions in the system prompt alongside the style (§6.1.5). <!-- req: outputStyles.frontmatter.keep-coding-instructions --> |
   | `force-for-plugin` | boolean | `false` | Plugin styles only. When `true`, the style is applied whenever its plugin is enabled, without the user selecting it (§6.1.4). <!-- req: outputStyles.frontmatter.force-for-plugin --> |

3. A field the client does not know, including a misspelt one, MUST be ignored without an error.
4. A frontmatter block that is not valid YAML MUST NOT stop the style from loading: the style loads
   under its file name with no fields set, and the client records the parse error where its debug
   output (`claude --debug`) shows it (`output-styles.md`, "Frontmatter reference"; Judgment
   J6.12).
   <!-- req: outputStyles.frontmatter.name -->
5. A `name` that is not a string is read as its text the way a JavaScript program converts it to
   a string: `42`, `1.5` for `1.50`, `true`, `a,b` for the list `[a, b]`, `[object Object]` for a
   map; an empty `name` gives the file name. A `description` that is a number or a boolean is read
   as its text (`7`, `false`); a list there is treated as absent. A flag accepts the spellings the
   skill flags accept (§4) and any other value is treated as absent; a validator MAY warn about it
   (Judgment J6.2).
6. `force-for-plugin` on a user, project or managed style has no effect.
7. When `description` is unset, a client SHOULD show the first non-empty line of the body in its
   place (Judgment J6.3).
   <!-- req: outputStyles.behavior.Create a custom output style -->

Example, a plugin's `output-styles/diagrams.md`:

```markdown
---
name: Diagrams first
description: Lead every explanation with a diagram
keep-coding-instructions: true
---

When explaining code, architecture or data flow, start with a Mermaid diagram, then explain in
prose.
```

### 6.1.2 Where output styles load from

A client MUST load custom output styles from each of these places:

| Level | Location |
| --- | --- |
| User | `~/.claude/output-styles/` |
| Project | `.claude/output-styles/` in the working directory and in every directory between it and the repository root |
| Managed policy | `.claude/output-styles/` inside the managed settings directory (§14) |
| Plugin | `output-styles/` under the plugin root, or the paths of the manifest's `outputStyles` key (§2.2) |

1. Only files ending in `.md` are styles. In a scanned directory, a client MUST also read the `.md`
   files of its subdirectories; the subdirectory is not part of the style's name
   (Judgment J6.4). A path the manifest lists as a file is a style whatever its extension.
2. `outputStyles` replaces the default `output-styles/` directory; it does not add to it (§2.6).
   A listed path that does not exist fails validation (§2.5). <!-- req: themes.components.Themes and output styles -->
3. In the terminal, a client reads style files when it starts. A style created or edited during a
   session takes effect after a restart; a plugin's styles also reload when the plugin does (§16).

### 6.1.3 Names and namespacing

1. A style's name is its `name` field, else its file name without `.md`.
2. A plugin style is identified as `<plugin>:<name>`, where `<plugin>` is the plugin's `name` (§2.3)
   and `<name>` is the style's name of item 1: a file `output-styles/terse.md` with `name: Terse`
   in plugin `writing-kit` is `writing-kit:Terse` (Judgment J6.5). The prefix is how a plugin style
   appears in `/output-style` and how the `outputStyle` setting names it. A user, project or managed
   style has no prefix.
3. When several project directories define a style with the same name, the one closest to the
   working directory MUST win. Across levels, a managed style wins over a project style and a
   project style over a user style of the same name; no custom style replaces a built-in one
   (Judgment J6.6).
4. When two files of one plugin give the same name, the client MUST keep exactly one, the file
   whose path relative to the plugin root sorts last by UTF-16 code unit (Judgment J6.7).

### 6.1.4 Selecting a style

1. The built-in styles are `default` (no style: the client adds no style instructions), `Proactive`,
   `Concise`, `Explanatory` and `Learning`. Each built-in style keeps the client's software
   engineering instructions.
2. The `outputStyle` setting (§12) names the active style. The match is exact and case-sensitive: a
   value that names no style, such as `explanatory`, gives Default. A plugin style is named with its
   prefix (`writing-kit:Terse`).
3. `/output-style <style>` selects a style, matching the name without regard to case, and writes
   `outputStyle` to the project's `.claude/settings.local.json`. With no argument it lists the
   styles that can be selected, Default and the built-ins first, then every custom style with its
   description, and marks the active one. The command works in non-interactive mode and SDK
   sessions too. The `/config` picker offers the same list with each style's `name` and
   `description` and writes the same file.
4. A style selected during a session applies from the next message the user sends.
   Two refusals keep a selection from being made:
   - Over Remote Control, or in a message relayed into the session, `/output-style` lists and
     selects only the built-in styles, since such a turn may not come from the account owner. A
     custom style's name, a plugin style's included, gets the reply of an unknown name, and
     whenever the command lists styles or does not recognise the name it adds `Custom output
     styles can't be selected over Remote Control or from a relayed message. Select one in the
     session itself, or pick a built-in style here.` <!-- docs: errors.md | Custom output styles can't be selected over Remote Control -->
   - In a session whose setting sources leave out `local` (`--setting-sources`, an SDK
     `settingSources`), `/output-style <style>` and `/config outputStyle=<style>` refuse instead of
     writing a setting the session never reads back: `Output styles are saved to local settings
     (.claude/settings.local.json), which this session doesn't load, so the style can't be changed
     here.` The style can still be set through `outputStyle` in a settings file the session loads.
     <!-- docs: errors.md | Output styles are saved to local settings which this session doesn't load -->
5. A plugin style with `force-for-plugin: true` MUST be active whenever its plugin is enabled,
   whatever `outputStyle` says. When several enabled plugins force a style, the first plugin
   loaded wins (`output-styles.md`, "Frontmatter reference"). (Claude Code 2.1.319 and 2.1.325
   still report `default` as the current style in `init.output_style` and `/output-style` with a
   forced style enabled; whether its instructions reach the prompt was not observed.)
   <!-- req: outputStyles.frontmatter.force-for-plugin -->

### 6.1.5 What a style changes

1. The client MUST send the active style's instructions with every request of the main
   conversation.
2. On the full system prompt, a custom style replaces the client's section of built-in software
   engineering instructions (how to scope changes, write comments, verify work) unless
   `keep-coding-instructions` is `true`. The shorter system prompt has no such section, so the
   field changes nothing there. `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` selects the full prompt on any
   model (§3).
3. A style applies to the main conversation and to a fork, which inherits the parent's system
   prompt. Every other subagent runs its own system prompt (§5), and the style does not reach it.
   <!-- req: outputStyles.behavior.How output styles work -->

## 6.2 Themes

A theme recolours the client's terminal interface. It never changes the terminal's own colour
scheme. A plugin theme is a file in the same format as the user's own custom themes; it is not a
mod's backdrop (`$.theme`, §10), which is a different mechanism.

### 6.2.1 The file

A theme is a JSON object with three optional fields. Its *slug* is the file name without `.json`.

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `name` | string | the slug | The label shown in `/theme`. <!-- req: themes.config.Create a custom theme.name --> |
| `base` | string | `dark` | The built-in preset the theme starts from: `dark`, `light`, `dark-daltonized`, `light-daltonized`, `dark-ansi` or `light-ansi`. <!-- req: themes.config.Create a custom theme.base --> |
| `overrides` | object | `{}` | Colour token name to colour value. A token not listed takes the base preset's colour. <!-- req: themes.config.Create a custom theme.overrides --> |

1. A colour value is one of `#rrggbb`, `#rgb`, `rgb(r,g,b)`, `ansi256(n)`, or `ansi:<name>` where
   `<name>` is one of the 16 standard ANSI colour names (`black`, `red`, `green`, `yellow`, `blue`,
   `magenta`, `cyan`, `white`, and each with `Bright` appended, such as `cyanBright`).
2. An unknown token and an invalid colour value MUST be ignored, the rest of the theme still
   applies: a typo cannot break rendering.
3. A `base` that is not one of the six presets is read as `dark`; a `name` that is not a non-empty
   string is read as the slug; a file that is not a JSON object is not a theme and is not listed
   (Judgment J6.9).
4. The tokens are those of the "Color token reference" in `terminal-config.md`, in these groups:

   | Group | Tokens |
   | --- | --- |
   | Text and accents | `claude`, `text`, `inverseText`, `inactive`, `subtle`, `suggestion`, `permission`, `remember` |
   | Status | `success`, `error`, `warning`, `merged` |
   | Input box and modes | `promptBorder`, `planMode`, `autoAccept`, `bashBorder`, `ide`, `fastMode`, `effortUltra` |
   | Diffs | `diffAdded`, `diffRemoved`, `diffAddedDimmed`, `diffRemovedDimmed`, `diffAddedWord`, `diffRemovedWord` |
   | Backgrounds | `userMessageBackground`, `userMessageBackgroundHover`, `bashMessageBackgroundColor`, `memoryBackgroundColor`, `selectionBg`, `composerSidebarBackground` |
   | Usage meter and labels | `rate_limit_fill`, `rate_limit_empty`, `briefLabelYou`, `briefLabelClaude` |
   | Shimmer variants | `claudeShimmer`, `warningShimmer`, `permissionShimmer`, `promptBorderShimmer`, `inactiveShimmer`, `fastModeShimmer` |
   | Subagent colours | `<color>_FOR_SUBAGENTS_ONLY` for `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
   | `ultrathink` rainbow | `rainbow_<color>` and `rainbow_<color>_shimmer` for `red`, `orange`, `yellow`, `green`, `blue`, `indigo`, `violet` |

   The docs say the interactive editor also offers a few single-purpose accents not listed there.
   A client that does not draw a token MUST still keep it when it copies or rewrites a theme file
   (§6.2.3), so a theme loses nothing in a client that draws less.

Example, a plugin's `themes/dracula.json`:

```json
{
  "name": "Dracula",
  "base": "dark",
  "overrides": { "claude": "#bd93f9", "error": "#ff5555" }
}
```

### 6.2.2 Where themes load from

1. The user's themes are the `*.json` files of `~/.claude/themes/`. The client SHOULD watch that
   directory and apply an added or changed file to a running session; when the directory did not
   exist at start, a restart once is enough.
2. A plugin's themes are the `themes/<slug>.json` files under its root, or the paths of the
   manifest's `experimental.themes` key, which replaces the `themes/` directory (§2.6). A top-level
   `themes` key still loads, and a validator warns that it belongs under `experimental`; when both
   are set, `experimental.themes` is read (Judgment J6.10). A plugin's themes reload when the plugin
   does (§16).
3. Themes, like output styles, are a declared component for marketplace entries: with `strict`
   unset or `true` the entry's `themes` add to the manifest's, and with `strict: false` an entry
   that declares them conflicts with a `plugin.json` (§15).
   <!-- req: themes.components.Themes and output styles -->

### 6.2.3 Selecting a theme

1. `/theme`, and the theme picker in `/config`, list the built-in presets, the `auto` option, the
   user's custom themes and every theme of an enabled plugin, each under its `name`. A plugin theme
   is not shown with a prefix.
2. Selecting a theme writes the `theme` setting (§12): `custom:<slug>` for a user theme and
   `custom:<plugin-name>:<slug>` for a plugin's (`settings-reference.md`, `theme`).
3. A plugin theme is read-only. When the user edits one in `/theme`, the client MUST save the edit
   as a new file in the user's own themes directory and leave the plugin's file unchanged. The copy
   takes the plugin theme's slug, or `<slug>-copy`, `<slug>-copy-2` and so on when the user already
   has a theme of that slug (Judgment J6.11).
   <!-- req: themes.components.Themes and output styles -->

## Design decisions

### Why a plugin style is named by its `name` and a plugin theme by its file

The two id schemes are Claude Code's: an output style is selected by the name it shows, so the
plugin prefix goes on the declared `name`; a theme is selected by its slug, so its id is built from
the file. Following each keeps a settings file written by Claude Code valid in an Extended client.

### Why a broken style or theme still loads, or is ignored, but never fails the plugin

A style and a theme change presentation only. Claude Code loads a style whose YAML is broken and
ignores a bad colour, so a plugin with one bad file keeps its other components; an Extended client
that refused the plugin would break plugins Claude Code runs.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J6.2 | A non-string `name` is read as its JavaScript string conversion (an empty one gives the file name); a number or boolean `description` as its text, a list `description` as absent; flags take the skill flag spellings, any other value absent (§6.1.1). | The docs give `name` and `description` as strings and say only "Set to `true`" for the flags. Oracle 2.1.319 and 2.1.322, 2026-11-16 (`claude -p "/output-style" --plugin-dir`, private config folder): files whose `name` is `42`, `1.50`, `true`, `[a, b]` and `{a: 1}` list as `<plugin>:42`, `:1.5`, `:true`, `:a,b` and `:[object Object]`; an empty `name` lists under the file name; `description: 7` and `description: false` list as `7` and `false`, and `description: [x, y]` lists with the first body line instead (J6.3). The reference implementation also reads a number `name` as text. Flags were not observed (their effect is on the prompt); one boolean grammar for every frontmatter flag keeps a file meaning the same in each component. |
| J6.3 | Without `description`, the first non-empty body line stands in for it (§6.1.1). | Silent in the docs. Oracle 2.1.325: `/output-style` lists a style without `description` with its first body line (`plain.md` whose body is `No frontmatter.`). |
| J6.4 | A plugin's style directory is read with its subdirectories; the subdirectory is not part of the name (§6.1.2). | The docs name `output-styles/` and no nesting. Oracle 2.1.325: `output-styles/sub/deep.md` loaded as `<plugin>:deep`. The reference implementation reads one level only, which is a lead this oracle overrides. |
| J6.5 | A plugin style's id is `<plugin>:<name>` with the declared `name` (§6.1.3). | `plugins/components.md` says `<plugin>:<name>` and its example has a name equal to the file name. Oracle 2.1.325: `terse.md` with `name: Terse` is listed as `<plugin>:Terse`. |
| J6.6 | Managed over project over user for one name; a custom style never replaces a built-in one (§6.1.3). | The docs rank only nested project directories. Managed first follows policy's precedence everywhere (§14); project over user follows the workflows rule of the same release (`workflows.md`, "Save the workflow for reuse") and the closest-wins rule. A built-in kept is what the reference implementation does, so the built-in names stay stable. |
| J6.7 | Of two files of one plugin with one name, the last in UTF-16 code-unit order of the relative path is kept (§6.1.3). | Silent in the docs. Oracle 2.1.325: with `terse.md` and `terse2.md` both named `Terse`, the description listed was `terse2.md`'s. A fixed order keeps the result independent of the file system. |
| J6.9 | A bad `base` reads as `dark`, a bad `name` as the slug, and a file that is not a JSON object is not a theme (§6.2.1). | `terminal-config.md` gives the defaults and says unknown tokens and invalid colours are ignored; it does not say what a bad `base` or a non-object file does. Reading the defaults is the reading that "cannot break rendering". `/theme` is not available in `claude -p` (2.1.325), so the oracle cannot show it. |
| J6.10 | With both `experimental.themes` and a top-level `themes`, `experimental.themes` is read (§6.2.2). | The docs say the top-level key "still loads" and give no precedence. Oracle 2.1.325: `claude plugin validate` accepts both and warns about the top-level key only. |
| J6.11 | An edited plugin theme is saved under its slug, or `<slug>-copy`, `<slug>-copy-2` on a clash (§6.2.3). | `plugins/components.md` says the edit is saved as a copy in the user's themes directory and names no file. Keeping the slug keeps the label; the suffix never overwrites a theme the user has. |
| J6.12 | A frontmatter that is not valid YAML loads the style under its file name with no fields set, as the 2.1.321 docs say (§6.1.1 item 4). | Claude Code 2.1.325 salvages a `name` line from such a block (`name: [unclosed` lists as `<plugin>:[unclosed`), but no run of 2.1.321 or an earlier release shows it, so E4a's evidence is missing and the documented rule stands; re-checked at the move to a newer release (map APS-004). |
