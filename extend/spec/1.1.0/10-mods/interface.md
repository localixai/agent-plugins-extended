# 10. Mods: the interface

This part of §10 states how a mod draws: the render sites a client offers, the `ui.render` event
that asks a mod what to draw at one, the element tree a hook returns, how the client redraws, the
panes, band, placed rows and backdrop a mod opens, the keyboard, and the three places a mod keeps
state. The events themselves, their order and their failure rules are in `events.md`; each site's
props, each element's full prop list and the numeric limits are in `reference.md`; the methods a
mod calls are in `api.md`.

Evidence: `plugins/mods/interface.md` unless a section names another page. Shapes follow the
declarations Claude Code 2.1.330 writes beside a mod (`claude-code/index.d.ts`: `RenderInputOf`,
`RenderPropsOf`, `PaneOpenArgs`, `UiOpenResult`, `UiPlaceResult`, `ThemeSetArgs`, `ThemeResult`,
`UiPane`), which win over the prose where the two differ (E2).

## 10.20 The interface protocol

A mod's hooks module runs apart from the interface it draws: in a hooks worker shared by the
installed mods, while the terminal, the Desktop app, the mobile app and the VS Code extension each
draw on their own side. Everything that crosses between them is plain data.

1. The client fires `ui.render` each time it is about to draw a render site. The event carries
   `component` (the site's name, the key a matcher narrows on), `surface` (`terminal`, `desktop`,
   `mobile` or `vscode`: the app drawing), `requestId` (the instance: a pane's id, a message id, a
   tool call's id, an agent id, a placed row's request id, `backdrop` for the backdrop), `props`
   (the site's plain-data props, `reference.md`) and, where a surface has measured itself,
   `viewport` (its size in character cells and whether it docks a pane).
2. The hook answers with an element tree, with the result of `next(e)`, or with a tree that holds
   that result. The client validates the tree for the site and the surface before drawing it
   (§10.24).
3. Function props, the `onPress`, `onSubmit`, `onInput`, `onSelect` and `onLinkPress` callbacks,
   never leave the module. The client draws the tree without them and keeps each control's
   callbacks under the control's key; a user action on the surface returns as `ui.press`,
   `ui.input` or `ui.select` naming that key in `e.element`, and only after those events' hooks
   pass it on does the control's own callback run, in the module (Judgment J10.100).
4. A `Client` element is the one exception to "no code on the surface": it names a second file of
   the mod's that runs on the surface with no mods API, posts data that arrives as `ui.message`, and
   reports a failure as `ui.fault` (§10.24 item 4).
5. A mod never reads the keyboard. The client decides which control a key is for (§10.27).

## 10.21 Choosing a render site

1. A mod chooses the render site a `ui.render` hook draws at with a matcher on `component`, as in
   `{ component: 'Pane' }`. A hook without one runs at every site the client draws itself and at the
   mod's own panes and band row; from 2.1.323 it MUST NOT run at another mod's pane or row unless its
   matcher names `plugin` (§10.13.3). In the hook, `e.component` names the site, `e.surface` the
   app, and `e.props` the site's own data; for a pane `e.requestId` is the `id` the pane was opened
   with. <!-- req: mods.interface.Pick where to draw -->
2. **Pane.** A pane is a region the mod opens with `$.ui.open` (§10.25) and fills at
   `{ component: 'Pane' }`, recognising its own pane by `e.requestId`. In a wide fullscreen
   terminal it is a sidebar beside the transcript; otherwise it is a framed region above the
   prompt. With several panes open each has a tab that shows its title. A pane is empty until a mod
   fills it.
3. **The band above the prompt** (`AbovePrompt`) is a strip directly above the prompt input. From
   2.1.323 each mod that draws there gets its own row, and the client MUST stack the rows from the
   top in the order mods run in (§10.14; `AbovePromptList`, `reference.md` §10.9 item 4). A hook
   matched `{ component: 'AbovePrompt' }` returns a tree to draw its mod's row, or `next(e)` to draw
   nothing; one mod's tree no longer replaces another's. Before 2.1.323 every mod shared one drawing,
   and a tree replaced what the mods after it drew unless it put the result of `await next(e)` among
   the children of a `Box`; a mod that supports those releases still does so, and on 2.1.323 or
   later that child draws no other mod's row. Such a `Box`, and every `Box` around it, MUST NOT carry
   `width`, `height`, `minWidth`, `minHeight`, `position`, `top`, `left`, `right`, `bottom`,
   `display` or `overflow`; a tree that does is refused like any other invalid tree
   (troubleshoot.md, "Another mod's band shows and yours doesn't"; Judgment J10.101).
4. **Placed rows** (`Placed`, §10.25.5) and **the backdrop** (`Backdrop`, §10.25.6) are sites a mod
   asks for with a call and then fills.

### 10.21.1 Sites Claude Code already draws

Every part of the interface the client draws itself is a render site too. At each of them the
hook's `next(e)` resolves to a reference to the client's own drawing, `{ type: 'engine', ref }`,
unless a mod later in the chain returned a tree of its own.

| Site | What it is |
| --- | --- |
| `UserMessage` | A user message in the transcript. <!-- req: mods.interface.Change what Claude Code already draws.UserMessage --> |
| `AssistantMessage` | An assistant message in the transcript. <!-- req: mods.interface.Change what Claude Code already draws.AssistantMessage --> |
| `ToolUse` | A tool call's row. <!-- req: mods.interface.Change what Claude Code already draws.ToolUse --> |
| `ToolResult` | A tool call's result. <!-- req: mods.interface.Change what Claude Code already draws.ToolResult --> |
| `ToolGroup` | A collapsed group of tool calls. <!-- req: mods.interface.Change what Claude Code already draws.ToolGroup --> |
| `CommandOutput` | The row a command printed. <!-- req: mods.interface.Change what Claude Code already draws.CommandOutput --> |
| `AskUserQuestion` | The dialog Claude opens to ask the user a question (item 5). <!-- req: mods.interface.Change what Claude Code already draws.AskUserQuestion --> |
| `Spinner` | The status line that animates while Claude works. <!-- req: mods.interface.Change what Claude Code already draws.Spinner --> |
| `ToolProgress` | A running tool's live progress line. <!-- req: mods.interface.Change what Claude Code already draws.ToolProgress --> |
| `TurnDuration` | The line that closes a turn. <!-- req: mods.interface.Change what Claude Code already draws.TurnDuration --> |
| `InfoNotice` | The status lines under the logo. <!-- req: mods.interface.Change what Claude Code already draws.InfoNotice --> |
| `SessionMode` | The mode labels in the footer. <!-- req: mods.interface.Change what Claude Code already draws.SessionMode --> |
| `PromptHint` | The hint line under the prompt. <!-- req: mods.interface.Change what Claude Code already draws.PromptHint --> |
| `AgentRow` | A subagent's or teammate's row in the agent panel (`reference.md` §10.9 item 5; 2.1.326 or later). <!-- req: mods.interface.Change what Claude Code already draws.AgentRow --> |

`Pane`, `AskUserQuestion`, `Spinner`, `UserMessage`, `AssistantMessage` and the three tool call
sites MUST be raised in the terminal, the Desktop app and the VS Code extension; where each other
site is raised is in `reference.md`.

At such a site a hook does one of three things, and the client MUST honour each:

1. **Change a detail**: it calls `next` with a copy of the event whose `props` differ. The client
   draws its own drawing from those props (its spinner keeps its animation and word, with the new
   `suffix` after it). A rewrite of the props that the site does not accept draws the original.
2. **Replace the drawing**: it returns a tree and does not call `next`. The tree is drawn in the
   site's place and the client's own drawing is not.
3. **Leave it alone**: it returns `next(e)`. The site is drawn as without the mod.

4. A hook MAY return the reference itself, or place it in a `Box` beside its own elements; the
   client draws its own drawing at that spot. The reference keeps its animation and behaviour.
5. **The question dialog.** A tree for `AskUserQuestion` MUST hold the reference exactly once, with
   the mod's elements above it and nothing below it. A tree that holds it zero times or more than
   once is not drawn, and the client draws its own dialog (Judgment J10.102).
6. **The permission prompt is not a render site.** A client MUST NOT offer a mod a way to change
   what it shows.

## 10.22 Redrawing

A drawing is a snapshot of what the hook returned the last time it ran.

1. The client MUST run a site's `ui.render` hooks again, unasked, when the site's props change or
   the terminal's width changes, and once more after the `ui.fault` hooks return when a `Client` in
   the site failed and the mod handles `ui.fault`, so the hook can leave the `Client` out. It MUST
   NOT run them on a timer of its own, and it cannot see a module variable change. <!-- req: mods.interface.When Claude Code redraws without being asked -->
2. `$.ui.invalidate('ui.render')` asks the client to draw again every site the calling mod may draw.
   It is the way a mod shows a change of its own data, typically from a control's callback after
   it changed a variable. <!-- req: mods.interface.Redraw when your data changes -->
3. A mod that needs a periodic redraw starts a timer in `session.start` with `$.clock.every(ms, fn)`
   whose callback calls `$.ui.invalidate('ui.render')`. Its timers stop when the module reloads;
   the new instance starts its own in its own `session.start`. <!-- req: mods.interface.Redraw on a timer -->
4. The client MUST throttle redraws of each site to the rates in `reference.md`, "Limits" (ten a
   second; thirty in the terminal for the visible pane, the expanded band and the prompt hint).
   Calls that come faster are coalesced into one redraw, which runs the hooks once and reads the
   mod's data as it is when the redraw runs, so the latest value shows and the values in between do
   not. A mod MAY call `$.ui.invalidate` as often as its data changes (Judgment J10.103). <!-- req: mods.interface.How often a site can redraw -->
5. A value in `$.state` needs no call: writing it redraws the sites that read it (§10.28.2).

## 10.23 Elements

A hook gets the elements with `$.ui.resolve(e)`, passing its own event: the call returns the frozen
table of element constructors for `e.surface`, read at load and not dispatched per call. Each
element is a function of its props; the elements and strings inside it go in `children`. A module
that is a `.tsx` or `.jsx` file MAY write the tree as JSX with the destructured elements.

| Element | What it draws, and the rules a client enforces | Surfaces |
| --- | --- | --- |
| `Box` | A flex container: layout props such as `flexDirection` (`row`, `column`, `row-reverse`, `column-reverse`), `borderStyle`, `width`, `overflowX` (2.1.326 or later); spacing props such as `columnGap` and `padding` take a number or a step name from `'xs'` to `'xl'`. <!-- req: mods.interface.Build a tree from elements.Box --> | all |
| `Text` | Styled text: `color` (a theme key or a colour such as `'red'`), `bold`, `dimColor`, `italic`, `weight`, `maxLines` (2.1.326 or later) and the others in `reference.md`; `wrap` is a value such as `'wrap'`, `'truncate'`, `'truncate-start'`, `'truncate-middle'`, `'truncate-end'` or `'clip'` (2.1.326 or later). <!-- req: mods.interface.Build a tree from elements.Text --> | all |
| `Button` | A control that runs `onPress(e)`, `e.surface` being the app the press came from. Bracketed by default (`[ Add one ]`); with `plain: true` no brackets and its hotkey shown before the label (`1: One`). <!-- req: mods.interface.Build a tree from elements.Button --> | all |
| `Link` | A link with `href` and an optional `label` (§10.23.1). <!-- req: mods.interface.Build a tree from elements.Link --> | all |
| `Code` | A code block. <!-- req: mods.interface.Build a tree from elements.Code --> | all |
| `Markdown` | Text formatted as Claude's replies are. Its content is the `text` prop, not `children`, and it needs a `key` when it has `onLinkPress`. <!-- req: mods.interface.Build a tree from elements.Markdown --> | all |
| `Input` | A text field: `onSubmit(value)` on Enter, `onInput(value)` on every change; `label`, `placeholder`, `value`, `submitLabel`, `rows` (2 or more for several lines), `autoFocus` (§10.26). <!-- req: mods.interface.Build a tree from elements.Input --> | terminal, desktop, mobile, VS Code |
| `Select` | A dropdown: `onSelect(value)`, `options` a non-empty list of `{ value, label }` with unique values. <!-- req: mods.interface.Build a tree from elements.Select --> | terminal, desktop, mobile, VS Code |
| `Svg` | An SVG document. <!-- req: mods.interface.Build a tree from elements.Svg --> | desktop, mobile, VS Code |
| `Client` | A region drawn by a second file of the mod's (§10.20 item 4, §10.24 item 4). <!-- req: mods.interface.Build a tree from elements.Client --> | terminal, desktop |
| `Raster` | A grid of coloured cells (§10.23.2). <!-- req: mods.interface.Build a tree from elements.Raster --> | terminal |
| `Image` | A picture. <!-- req: mods.interface.Build a tree from elements.Image --> | terminal |
| `Progress` | How far along a task is (`reference.md` §10.10; declarations only). | all |
| `Shader` | A scene the Desktop app plays on the GPU, in a `Backdrop` only (`reference.md` §10.10; declarations only). | desktop, mobile |

The surfaces column follows the per-surface `Elements` tables of the declarations: the mobile
app's table has `Svg` and not `Client`, though the interface page names only the Desktop app and
VS Code for `Svg` (Judgment J10.104).

### 10.23.1 `Link` in the Desktop app and VS Code

In the Desktop app and the VS Code extension a `Link` MUST be drawn as plain text unless its `href`
meets all three rules; the terminal applies none of them:

1. its scheme and host are `https:`, or `http://localhost` with any port; <!-- req: mods.interface.Link in the Desktop app and VS Code.Scheme and host -->
2. it holds no `@` (one in a path or query is written `%40`); <!-- req: mods.interface.Link in the Desktop app and VS Code.No @ -->
3. it is spelled as `new URL(href).href` returns it, a missing `/` after the host aside, so an
   uppercase host, a space, or `:443` on an `https:` URL fails. <!-- req: mods.interface.Link in the Desktop app and VS Code.Spelling -->

### 10.23.2 `Raster`

A `Raster` draws a grid in the terminal in one element instead of a `Box` per cell. It takes `key`,
`columns`, `rows` and `cells`, a base64 string packing every cell as three unsigned 32-bit numbers:
the character's code point, its colour and its background colour. A colour is a 24-bit RGB value
(`0xc62828`); `0x01000000` means the terminal's default. Each character MUST be one cell wide. The
numbers are little-endian and `cells` MUST decode to exactly `columns × rows × 3` numbers, or the
tree does not validate (Judgment J10.105). Apps other than the terminal have no `Raster`, so a mod
checks `e.surface` and draws something else there.

`$.ui.blit({ requestId, key, cells })` repaints a `Raster` already on screen with new cells of the
same size without running `ui.render`. `requestId` names the site the `Raster` is drawn in (for a
pane, the pane's id); `columns` and `rows`, when given, MUST be the mounted size. It resolves `{}`
once the cells are in the surface's next frame, or `{ deny }` when the element is not mounted, not
the mod's own, of another size, or the cells do not decode (declarations, `ui.blit`). <!-- req: mods.interface.Draw a grid of colored cells -->

## 10.24 Validating a tree

1. A tree that holds a prop an element does not take, a child where none goes, an element the
   surface does not draw, or a control without a valid key (§10.26.1) does not validate. The hook
   that returned it has failed with a result of the wrong shape (§10.15): the client skips it as
   §10.41.1 says and writes the `hook skipped` line, naming the mod and the rule the tree broke:

   ```text
   my-mod: ui.render hook skipped: returned the wrong shape (a tree Pane refuses: Text prop "bogusProp" is not allowed)
   ```

2. A tree that validates but exceeds a size limit of `reference.md` is refused at its site
   (§10.44.3).
3. A failure while drawing a valid tree, or while drawing the site from props passed to `next`, is
   `threw while drawn` (§10.44.4).
4. **When a `Client` fails.** In the terminal, when the file a `Client` runs fails to load, draw or
   run, the client MUST put one dimmed line in the `Client`'s place, `<mod>: Client <module>:
   <message>` (as in `my-mod: Client client/spinner.js: boom`), and draw the rest of the tree. It
   then fires `ui.fault` (phase `load`, `render` or `run`), and when the mod handles it, redraws
   the site once after those hooks return (§10.22 item 1). An error with no message reads `the
   module failed without a message` (§10.44.5). <!-- req: mods.interface.When a Client fails -->

## 10.25 Panes, placed rows and the backdrop

### 10.25.1 Opening and closing a pane

`$.ui.open({ id, ... })` opens a pane; `id` is its name (1 to 64 letters, digits, `_` or `-`),
which the `ui.render` hook checks and `$.ui.close({ id })` closes. Opening draws nothing by itself:
the client then fires `ui.render` for the pane. One pane exists per id; opening an id the mod has
open retitles it, and opening an id another mod has open MUST reject (2.1.330). Closing an id that
is not open does nothing. The optional fields:

| Field | Meaning |
| --- | --- |
| `title` | The pane's tab label when more than one pane is open; the id when absent. <!-- req: mods.interface.Open a pane at the right time.title --> |
| `focus` | Requests keyboard focus (§10.27.1). <!-- req: mods.interface.Open a pane at the right time.focus --> |
| `closeOnEscape` | Esc closes the pane as well as returning focus to the prompt. <!-- req: mods.interface.Open a pane at the right time.closeOnEscape --> |
| `holdToasts` | In the terminal, holds toasts while this pane is the one showing (§10.25.2). <!-- req: mods.interface.Open a pane at the right time.holdToasts --> |
| `rows` | The height asked for when the pane sits above the prompt; default a third of the space. <!-- req: mods.interface.Open a pane at the right time.rows --> |
| `columns` | The width asked for when the pane sits beside the transcript, at most 45% of the terminal's width. Once the user has resized a pane beside the transcript, in this session or an earlier one, panes open there at the user's width instead, under the same 45% limit. <!-- req: mods.interface.Open a pane at the right time.columns --> |
| `backgroundColor` | What is painted under the pane's body: a theme key or a colour. Declared, not in the interface page. |
| `placement` | `'widget'` asks the Desktop app to draw the pane as a widget (`Pane` props then say `placement: 'widget'`); a surface without widgets opens it as without the field, and any other value is ignored. Declared from 2.1.330 (`claude-code/index.d.ts:9478`), not in the interface page. |

1. `focus`, `closeOnEscape` and `holdToasts` accept only `true`. Any other value, `false` included,
   MUST make the call throw `ui.open: <field> is true or left out` (`ui.open: focus is true or left
   out`). Another malformed request throws an error that starts `ui.open:` (Judgment J10.106).
2. The VS Code extension ignores `rows` and `columns` and sizes the pane itself.
3. The call resolves `{ isPlaced: true }` when the pane is drawn, or `{ isPlaced: false, reason }`
   while it waits (§10.25.3). `$.ui.panes()` lists the mod's own open panes from the client's
   record (`id`, `title`, `isShown`, `isFocused`, `isPlaced`), so a reloaded module finds a pane
   that stayed up.
4. A command registered with `immediate: true` runs, and so may open its pane, while Claude is
   working; without it a command typed during a turn waits for the turn to end (`api.md`, §10.30).

### 10.25.2 Holding toasts behind a dialog

While a pane opened with `holdToasts: true` is the pane showing in the terminal, the client MUST
draw no toast: not the opening mod's, not another mod's, and not its own short-lived notifications.
A toast raised during the hold waits undrawn and is shown when the hold ends; its time does not run
while it waits (Judgment J10.107). The hold is for a dialog the user answers and leaves; a pane that
stays open SHOULD NOT ask for it. <!-- req: mods.interface.Hold toasts behind a dialog -->

### 10.25.3 When a pane waits for a wider terminal

1. A pane opened by something the user did, a command they ran or a button they pressed, MUST be
   placed at any width.
2. A pane the mod opens by itself, from a timer or a hook such as `turn.start`, MUST be placed in
   the terminal only when it is at least 144 columns wide, or 110 once the user has opened that
   pane themselves. Below that the call resolves `{ isPlaced: false, reason }`, `reason` a string
   saying why, and the pane waits undrawn; it is placed when the user opens it or the terminal is
   widened to its floor.
3. The rule is the terminal's: the other apps place the pane. A terminal not yet measured places no
   pane a mod opens by itself (Judgment J10.108). <!-- req: mods.interface.When a pane waits for a wider terminal -->

### 10.25.4 The VS Code extension

The VS Code extension draws what a mod draws in its chat panel from extension 2.1.299, or 2.1.304 in
a session that does not fetch feature flags; `e.surface` there is `vscode`. A client that serves the
panel MUST follow these differences from the terminal:

| Area | Rule |
| --- | --- |
| Panes | In a panel 800 pixels or wider, panes dock beside the conversation, `e.props.placement` is `'dock'` and `e.viewport.isFullscreen` is `true`. Narrower, panes draw above the prompt box, `placement` is `'inline'`, and a pane shows 12 rows before it scrolls. <!-- req: mods.interface.Draw in the VS Code extension.Panes --> |
| Toasts and status lines | One stack directly above the prompt box, with the panes when the panel is narrow, one status line per mod. The stack is hidden while a permission request or a dialog shows. <!-- req: mods.interface.Draw in the VS Code extension.Toasts and status lines --> |
| Labels | What a mod draws is framed and labelled `From the <plugin> plugin`; what it rewrites, `Edited by the <plugin> plugin`. <!-- req: mods.interface.Draw in the VS Code extension.Labels --> |
| Keyboard | Buttons have no hotkeys: the user clicks a button, or presses Enter on it once it has focus. <!-- req: mods.interface.Draw in the VS Code extension.Keyboard --> |
| Keyboard focus | A pane's `focus: true` is granted only when the panel has focus, Claude is idle with no question waiting, and the prompt box is empty. <!-- req: mods.interface.Draw in the VS Code extension.Keyboard focus --> |
| The question dialog | At `AskUserQuestion` the panel keeps its own question card and draws the mod's elements above it; props passed to `next` do not change the card. <!-- req: mods.interface.Draw in the VS Code extension.The question dialog --> |
| Prompt suggestions | `$.prompt.suggest` resolves `{ isShown: false }` and shows nothing. <!-- req: mods.interface.Draw in the VS Code extension.Prompt suggestions --> |
| Text limits | A status line is cut at 200 characters or two rows, a toast at 500 characters. <!-- req: mods.interface.Draw in the VS Code extension.Text limits --> |

### 10.25.5 Placing a row in the transcript

`$.ui.place({ id })` (Claude Code 2.1.314 or later) adds a row of the mod's at the end of the
transcript in the terminal, after the latest message. It stays at that spot as the conversation
goes on; the model and the transcript file never read it. `id` is 1 to 64 letters, digits, `_` or
`-`; a malformed one throws an error that starts `ui.place:`. The mod draws the row at the `Placed`
site, where `e.props.plugin` and `e.props.id` identify it: another mod MAY use the same id, so a
hook MUST check both.

1. **The result.** `{ isPlaced: true, requestId }` when the terminal draws the row. Otherwise
   `{ isPlaced: false, reason }`: `no attached surface draws placed rows yet` when no attached
   surface draws placed rows, and `a plugin holds at most 500 placed rows` when the mod holds the
   limit of `reference.md` (Judgment J10.109). <!-- req: mods.interface.Place a row in the transcript.The result -->
2. **The same id again.** While the mod's row with that id is in the transcript, a second call adds
   no row and resolves `{ isPlaced: true, requestId }` with that row's `requestId`. The mod changes
   what the row shows by redrawing (§10.22). <!-- req: mods.interface.Place a row in the transcript.A second call with the same id -->
3. **When the row goes.** A row is removed when the conversation ends, when the user rewinds past
   it, and, outside fullscreen rendering, when the conversation is compacted. `--resume` MUST NOT
   bring it back. A new `$.ui.place` places it again, with a new `requestId`. <!-- req: mods.interface.Place a row in the transcript.When the row goes away -->

### 10.25.6 The backdrop

`$.theme.set({ backdrop })` and `$.theme.clear()` (Claude Code 2.1.319 or later) replace
`$.ui.backdrop`, which 2.1.319 removed; a client MUST NOT offer `$.ui.backdrop`. A backdrop is drawn
behind the conversation by the Desktop app and the mobile app, from what `ui.render` answers at the
`Backdrop` site (`e.requestId` is `backdrop`; `e.props` holds `plugin`, `scene`, `glass` with its
defaults filled in or `false`, and `overrideColorScheme` when the mod gave one). The terminal draws
none.

1. **The fields** (2.1.323 or later; `ThemeSetArgs`, `claude-code/index.d.ts:17320`). A backdrop is
   a scene or a ground (`ThemeBackdrop`, `16859`). A scene is `{ scene, glass? }`: `scene`, a name
   under the rule of `reference.md`, names a backdrop the mod's `Backdrop` hook draws, and `glass`
   (`blur` 0 to 64, `tint` a raw colour, `opacity` 0 to 1, or `false`) is how a surface frosts its
   panels over it. A still ground, which no hook draws, is `{ color }`, `{ gradient }` or `{ vector
   }` (2.1.330 declarations, `ThemeGround`, `17128`). `overrideColorScheme` (`'light'` or `'dark'`)
   is a field of the call beside `backdrop`, not of the backdrop: it overrides the user's mode so a
   surface draws its own text to suit. Before 2.1.323 `scene` was `id` and `overrideColorScheme`
   was `backdrop.colorScheme`; a client that serves mods written for those releases MAY accept both
   spellings (Judgment J10.113). <!-- req: mods.interface.Put a backdrop behind the conversation.The backdrop fields -->
2. **Whether it is drawn.** `$.theme.set` resolves `{ isDrawn: true, requestId }` when a Desktop or
   mobile app connected to the session says it draws backdrops, else `{ isDrawn: false, reason }`. <!-- req: mods.interface.Put a backdrop behind the conversation.Whether the backdrop is drawn -->
3. **One theme for each session.** The session has one theme: its backdrop, its colours (§10.25.7)
   and, in the declarations, its sound and style. A `$.theme.set` replaces all of it, whichever mod
   set the one before, and what the call leaves out is gone; it names at least one attribute, and an
   attribute the build does not know is refused by name. `$.theme.clear()` removes it, whichever
   mod set it, and resolves with a `reason` such as `the theme is cleared`. Neither a reload of the
   setting mod nor `--resume` keeps it, so a mod sets it in `session.start`; a mod that unloads
   takes its own theme with it. A mod SHOULD call `$.theme.clear()` only when the user asks, and
   SHOULD pass `colors` and `backdrop` in one call. <!-- req: mods.interface.Put a backdrop behind the conversation.One theme for each session -->
4. **A click on the backdrop.** Where the user clicks or taps the backdrop where no part of the app
   covers it, the client fires `ui.pointer` to the hooks of the mod that set the theme alone
   (`events.md` §10.19.4).

### 10.25.7 The colours of the Desktop app

From 2.1.324, in the Desktop app's Code tab, `$.theme.set({ colors })` sets the colours the app
paints; the terminal keeps its own. `colors` is a `ThemeColors` (`claude-code/index.d.ts:16980`):
`{ v: 1, label, id?, inputs: { light?, dark? } }`, each mode a map from the design system's token
names (such as `surface-0`, `text-primary`, `text-muted`) to six-digit hex colours. The client
does not read it and passes it to the surface; a surface keeps its own colour for a token left out,
and given one mode alone acts as if `overrideColorScheme` named it. The 2.1.330 declarations add
`sound` (an ambience and cues the Desktop app plays once the user turns the theme's sound on) and
`style` (how the Desktop app draws the conversation's own rows: `Text`, `Heading`, `UserMessage`,
`AssistantMessage`, `ToolUse`), both passed to the surface like `colors` (`ThemeSound`, `17375`;
`ThemeStyle`, `17443`; Judgment J10.113).

1. **Ask Claude for a colors mod.** In a local Code tab session the user describes the colours and
   Claude writes a mod under the rules of `reference.md` §10.8.4; the Code tab changes colour when
   it loads. <!-- req: mods.interface.Ask Claude for a colors mod -->
2. **Write a colors mod yourself.** The built-in `plugin-authoring` skill carries `make-colors.js`
   and `make-colors.d.ts`, whose `makeColors({ label, light, dark })` builds `{ theme, problems }`
   from a few hex anchors per mode; a mod under `~/.claude/skills/<name>/` (§4, loaded at session
   start) calls `await $.theme.set({ colors: theme })` in `session.start`. A client that offers the
   skill MUST ship those two files in it. <!-- req: mods.interface.Write a colors mod yourself -->
3. **When the colours do not appear.** The Code tab keeps its own colours with a third-party
   provider in Claude Desktop 5.11492.5 or earlier. Otherwise the documented causes, which a client
   MUST keep observable:
   - **an old version**: the Desktop app or its Claude Code is older than 2.1.324; <!-- req: mods.interface.Fix missing mod colors in the Desktop app.Old version -->
   - **the mod is not loaded**; <!-- req: mods.interface.Fix missing mod colors in the Desktop app.Mod not loaded -->
   - **a refused theme**: `makeColors` threw, or its `problems` list has an entry that starts
     `Desktop won't paint this theme`, and the Desktop app does not paint it; <!-- req: mods.interface.Fix missing mod colors in the Desktop app.Refused theme -->
   - **another `$.theme` call**: any mod's later `$.theme.set` or `$.theme.clear()` removes the
     colours and backdrop an earlier call set (item 3 of §10.25.6). <!-- req: mods.interface.Fix missing mod colors in the Desktop app.Another $.theme call -->
4. **Removing the colours.** A mod that is still on sets its colours again, so the user turns it off
   first, then starts a new local session; colours that stay are removed from the Desktop app's
   **Settings**, `code appearance`, **Remove colors**. Turning a mod off is:
   - for a mod Claude wrote, moving its directory out of the session's mods folder; <!-- req: mods.interface.Remove mod colors from the Desktop app.Claude wrote the mod -->
   - for a mod under `~/.claude/skills/`, moving its directory out of that folder; <!-- req: mods.interface.Remove mod colors from the Desktop app.You put the mod under ~/.claude/skills/ -->
   - for an installed mod, disabling or uninstalling its plugin, in the Desktop app's **Manage
     plugins** or from the shell (§16). <!-- req: mods.interface.Remove mod colors from the Desktop app.You installed the mod -->

## 10.26 Controls

### 10.26.1 Which controls need a key

1. Every `Input` and `Select` MUST have a `key` prop, a non-empty string. A `Button` MAY go without
   one when it has a `label` or a single string child: its key is then that label or string.
2. Two `Input`s, or two `Select`s, with the same key in one tree make it invalid (`<Kind> "<key>"
   is drawn twice; each takes its own key`, §10.44.6). Buttons MAY share a key, as buttons with
   one label and no `key` do; the tree is drawn, and a test's `press` by that key fails with
   `key each once` (Judgment J10.176).
3. Tests and other mods identify a control by its key. Before running a control's callback the
   client fires `ui.press`, `ui.input` or `ui.select` with the key in `e.element`; another mod's
   hook there, which from 2.1.323 runs only when its matcher names `plugin` (§10.13.3), sees what
   the user typed into an `Input` and MAY change that text or keep the callback from running. The
   mods API gives no method to press another mod's button. <!-- req: mods.interface.Which controls need a key -->

### 10.26.2 Input

Submitting an `Input` starts no turn unless its callback calls `$.prompt.submit`. While the hook
draws the field again with the same `value`, the field keeps the user's typing; a different
`value` replaces it.

## 10.27 Keyboard

Apart from a digit hotkey on the band and an `action` binding (`reference.md`, "Elements"), a key
reaches a mod's controls only while its pane or band has keyboard focus; every other key goes to
the prompt. In the VS Code extension buttons have no hotkeys.

### 10.27.1 How a pane gets keyboard focus

1. A pane gets keyboard focus when the mod opens it with `focus: true` from a command or a press,
   when the user presses Ctrl+X then Tab, or when the user clicks it, which in the terminal needs
   fullscreen rendering.
2. The client MUST grant `focus: true` only while the prompt is empty and nothing else has keyboard
   focus, so a pane that opens while the user types takes none of their keystrokes. The VS Code
   extension adds its own conditions (§10.25.4). The Desktop app follows the terminal's rule
   (Judgment J10.110). <!-- req: mods.interface.How a pane gets keyboard focus -->

### 10.27.2 What each key does

While the pane or band has keyboard focus:

| Key | Effect |
| --- | --- |
| Tab | Moves to the next control; from the last it wraps to the first (Judgment J10.111). <!-- req: mods.interface.What each key does.Tab --> |
| Up and Down | Move between controls while the drawing fits, stopping at the first and last. When the pane or band has more rows than it shows, they scroll it. In a several-row `Input` in the terminal they move between the field's rows, and from its first or last row to the control before or after it. <!-- req: mods.interface.What each key does.Up and Down --> |
| Enter | Presses the focused `Button`, submits the focused `Input`, picks in the focused `Select`; with no control focused it does nothing. <!-- req: mods.interface.What each key does.Enter --> |
| A button's hotkey | Presses that button. While an `Input` has the focus every printable key goes to the field instead. <!-- req: mods.interface.What each key does.A button's hotkey --> |
| Page Up, Page Down, Home, End | Scroll the pane or band when it has more rows than it shows; otherwise nothing. <!-- req: mods.interface.What each key does.Page Up, Page Down, Home, and End --> |
| Ctrl+X then an arrow key | Resizes the pane: Left or Up gives it more room, Right or Down gives room back. A pane beside the transcript stops widening at 45% of the terminal's width. <!-- req: mods.interface.What each key does.Ctrl+X then an arrow key --> |
| Ctrl+X then X | Closes the pane, even while one of its fields has the focus; `x` or `X`. <!-- req: mods.interface.What each key does.Ctrl+X then X --> |
| Ctrl+X then Ctrl+A | Collapses the band to one row while a mod draws there, or expands it (§10.27.4). It works while the prompt has the focus too. <!-- req: mods.interface.What each key does.Ctrl+X then Ctrl+A --> |
| Esc | Returns keyboard focus to the prompt; with `closeOnEscape: true` it also closes the pane. <!-- req: mods.interface.What each key does.Esc --> |

A mod MUST NOT be able to bind Tab or the arrow keys.

### 10.27.3 Hotkeys and the first focus

1. `hotkey` is one digit or one lowercase letter; pressing it presses the button.
2. `autoFocus: true` on a control gives it the focus when the pane opens; the first such control
   wins. It accepts only `true`. In the VS Code extension it does nothing and the control is drawn
   as without it.
3. A hotkey shows as follows:

   | Button | Terminal | Desktop app | VS Code extension |
   | --- | --- | --- | --- |
   | bracketed (default) | `[ Add one ]`, no hotkey shown | the label with a small key beside it | the label; the hotkey does nothing |
   | `plain: true` | `1: One` | the label with a small key beside it | the label; the hotkey does nothing |

   A mod SHOULD name the key in a bracketed button's label in the terminal, or use `plain: true`. <!-- req: mods.interface.Set a hotkey and the first focus -->

### 10.27.4 When the user collapses the band

1. In the terminal, while a mod draws in the band, the client draws `[-]` at the right end of the
   band's first row; in fullscreen rendering a click on it collapses the band. Ctrl+X then Ctrl+A,
   or the user's binding for the `abovePrompt:toggle` action, collapses or expands it whichever of
   the prompt, the band or a pane has focus.
2. A collapsed band hides everything mods draw there and shows one dim row naming the keys as the
   user has them bound:

   ```text
   ▸ plugin panel hidden · ctrl+x ctrl+a or click to show
   ```

   The same keys, or in fullscreen rendering a click on the row, expand it.
3. While collapsed, nothing presses a button in the band: no hotkey, no digit typed into an empty
   prompt, no `action` binding. If the band had keyboard focus it returns to the prompt, and Ctrl+X
   then Tab skips the band.
4. The band stays collapsed until the user expands it, through `/clear`, and is expanded when the
   client next starts: the state belongs to the process. A mod cannot expand it. Its `ui.render`
   hook keeps running, and `e.props.isCollapsed` (2.1.321 or later) is `true` while the band is
   collapsed, so a mod MAY show elsewhere, while it is collapsed, what the user must answer; a mod
   SHOULD NOT make the band the only place for it. <!-- req: mods.interface.When the user collapses the band -->

### 10.27.5 Keybinding contexts and default actions

The keys of §10.27.2 are the defaults of keybinding actions the user can rebind or unbind in
`~/.claude/keybindings.json`; the client MUST route a key to a mod's band or pane through these
actions and contexts, so a user's binding, not the key, decides what reaches the mod.

1. **Contexts.** `AbovePrompt` is active while the band, or a button in it, has keyboard focus;
   `AbovePromptInput` and `AbovePromptSelect` while an input field or a select in the band or in a
   pane has it; `Pane` while a mod's pane has it; `PaneField` while an input field or a select in a
   pane has it.
2. **Above-prompt actions.** `abovePrompt:toggle` (Ctrl+X Ctrl+A) and `abovePrompt:focus` (Ctrl+X
   Tab: into the band, then each open pane, and from the last pane back to the prompt) apply in the
   `Chat` context. The others apply in the context of what has focus: `abovePrompt:next` (Tab),
   `abovePrompt:previous` (Shift+Tab), `abovePrompt:press` (Enter), `abovePrompt:leave` (Escape),
   `abovePrompt:highlightNext` (Down) and `abovePrompt:highlightPrevious` (Up) in a focused select.
   In `AbovePrompt`, Right and Left also run `next` and `previous`, and Space runs `press`; Up,
   Down, PageUp, PageDown, Home and End there run the pane scroll actions.
3. **Pane actions**, in the `Pane` context: `pane:scrollUp` (Up), `pane:scrollDown` (Down),
   `pane:pageUp` (PageUp), `pane:pageDown` (PageDown), `pane:top` (Home), `pane:bottom` (End),
   `pane:grow` (Ctrl+X Left, Ctrl+X Up), `pane:shrink` (Ctrl+X Right, Ctrl+X Down) and `pane:close`
   (Ctrl+X X), which also applies in `PaneField`. `pane:next` and `pane:previous`, unbound by
   default, apply in `Global` while more than one pane is open. `Pane` also binds Tab, Shift+Tab,
   Enter and Escape to the above-prompt actions, and a pane's fields and selects use the
   `AbovePromptInput` and `AbovePromptSelect` contexts.
4. **Chords.** The `Pane` context holds the chords `ctrl+x left`, `ctrl+x right`, `ctrl+x up`,
   `ctrl+x down` and `ctrl+x x`, and `PaneField` holds `ctrl+x x`; a chord in any active context
   keeps the `ctrl+x` prefix reserved, so the user frees it only by unbinding each chord (set to
   `null`) in the context that defines it.
5. **Fields.** While a field has focus, a printable key pressed without Ctrl, Alt or Cmd goes to
   the field and is not matched against bindings; keys that type no character (Enter, Escape, Tab,
   the arrows), keys with a modifier, and the second key of a chord in progress still run their
   bindings. <!-- docs: keybindings.md | Contexts --> <!-- docs: keybindings.md | Above-prompt actions --> <!-- docs: keybindings.md | Pane actions --> <!-- docs: keybindings.md | Unbind default shortcuts --> <!-- docs: keybindings.md | Text fields -->

The contexts, the actions above, their defaults, chords and unbinding are the presenting client's
keymap: the host reads `keybindings.json`, tracks which context is active and which chord is in
progress, and decides which action a key runs. A library that runs mods holds no keymap and reads
no `keybindings.json`. It takes from its host the facts that decide a press (the surface, whether
the tree is the band, whether the band is collapsed, whether the pane or band has keyboard focus,
whether an input field has it) and returns, for a drawing, the button each `hotkey` presses now,
the button a digit typed alone into an empty prompt presses, and, given an action name and the
user's binding of it, the buttons whose `action` (§10.10.5) that binding presses. The host runs the
`abovePrompt:*` and `pane:*` actions itself (moving focus, scrolling, resizing, closing) and calls
the button's handler for a press the library named (Judgment J10.175).

## 10.28 State

| Kept in | Lasts until | For |
| --- | --- | --- |
| a module-level variable | the module reloads (each save during development) | values the mod can lose |
| `$.state` | the session ends, or the user runs `/clear`, `/resume` or `/branch` | values a drawing depends on that survive a reload |
| `$.store` | the mod deletes it, or no session reads or writes the store for `cleanupPeriodDays` | what the user expects next time |

`$.store` is a JSON key-value store of the plugin's own under `~/.claude/plugins/store/`;
`get(key)` resolves to the value or `undefined`, `set(key, value)` takes any JSON value,
`delete(key)` removes it (`api.md`, §10.35).

### 10.28.1 Declaring `$.state` values

1. A mod declares its values in a type declaration file: `declare module 'claude-code'`, interface
   `PluginState`, one entry under the plugin's name, each member a value and its type. <!-- req: mods.interface.Declare the values -->
2. The manifest names that file in `types` (§2.2), so `claude plugin validate` checks the module
   against it. <!-- req: mods.interface.Point the manifest at the declaration -->

### 10.28.2 Defining, reading and writing a value

1. `atom({ plugin, key }, default)`, imported from `claude-code`, names a value and its default;
   `read($, atom)` returns it; `update($, atom, fn)` writes `fn(old)`. They call `$.state.get` and
   `$.state.set`.
2. A `ui.render` hook that reads a value subscribes its site to it: each write of the value redraws
   that site through the throttle of §10.22, with no `$.ui.invalidate`. A value in `$.state`
   survives a reload of the module.
3. A validator MUST refuse, as errors: an atom whose `plugin` or `key` is not a string literal or
   whose result is not held in a `const` (`... takes a source the scan can read ...`), and a value
   the declaration does not name (`<plugin>.<key> is not declared ...`).
4. A `ui.render` hook reads state and does not write it; writes come from a callback or another
   event's hook. A client MUST refuse a `$.state.set` made while a `ui.render` hook draws: the
   value is not written and nothing is redrawn (declarations, `state.set`; §10.7.2). A validator
   lists such a write under `state writes` and does not refuse the module for it (Judgment
   J10.112). <!-- req: mods.interface.Define, read, and write a value -->

### 10.28.3 Loading a saved value again after `/clear`

`/clear`, `/resume` and `/branch` reset every `$.state` value to its default, and `session.start`
does not fire again; `classic.SessionStart` fires after each with `e.source` `clear`, `resume` or
`fork` (and also at startup and after compaction, which do not reset `$.state`). A mod that copies
a saved value from `$.store` into `$.state` at `session.start` MUST copy it again in a
`classic.SessionStart` hook matched to those three sources; otherwise the drawing shows the default
and a callback that saves the `$.state` value writes the default over the stored one. <!-- req: mods.interface.Load a saved value again after /clear -->

### 10.28.4 Saving from more than one session

Every session on the machine that runs the mod shares one `$.store`, and a `get` followed by a
`set` is not atomic: the client MUST NOT promise more than last-write-wins per key. A mod that more
than one session changes SHOULD give each item its own key, and SHOULD `get` the key again in the
callback right before it `set`s, rather than build on a copy loaded at `session.start`. <!-- req: mods.interface.Save from more than one session -->

## Design decisions

### Why callbacks stay in the module

A surface is another process or another device; a function cannot cross to it, and code that ran
there would escape every hook that guards the mods API. Keeping callbacks by key also gives tests
and other mods one stable handle, the key, and lets `ui.press` and `ui.input` hooks see and change
an action before the mod's own code runs.

### Why an invalid tree skips the hook instead of drawing part of it

A partly drawn tree would hide the rule it broke and look like a layout bug on one surface. Skipping
the hook leaves the site to the rest of the chain, the client's own drawing included, and the
`hook skipped` line names the rule exactly once.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.100 | A drawn tree crosses to the surface as plain data: function props are removed and kept by the control's key, and a callback of an element with no key is dropped. | interface.md says a control's callback "runs in your module" after `ui.press`/`ui.input`/`ui.select` fire with the key; it does not say how the tree is carried. Lead: the reference implementation's `ui/elements/plain.ts`. |
| J10.101 | The band rule refuses a forbidden prop on any `Box` that encloses the result of `next(e)` at any depth, with the client's own wording (`Box prop "<p>" is not allowed around the result of next(e) in the band`). | troubleshoot.md names the props and "that `Box`, or any `Box` around it", not a message. Lead: the reference implementation's `ui/sites/band.ts`. |
| J10.102 | An `AskUserQuestion` tree that does not hold the reference exactly once is not reported as a skipped hook: the client draws its own dialog. | interface.md says "Otherwise, Claude Code draws its own dialog" and names no line. The declarations add "nothing below it". |
| J10.103 | The throttle keeps redraws of a site at least `ceil(1000 / rate)` ms apart, the first at once, the coalesced one at the end of the wait. | The docs give the rates and the coalescing, not the window. Lead: the reference implementation's `ui/redraw/gate.ts`. |
| J10.104 | The surfaces of each element follow the declarations' per-surface `Elements` tables: the mobile app draws `Svg` and no `Client`. | E2: the declarations win on the mods surface; interface.md lists no mobile column. |
| J10.105 | `Raster` cells are little-endian 32-bit numbers and must decode to exactly `columns × rows × 3` of them. | The docs' own example packs `Uint32Array` through its buffer, which is little-endian on every platform Claude Code ships on; the size rule follows from "each cell is three numbers". The declarations say a blit with cells that do not decode is denied. |
| J10.106 | Malformed `$.ui.open` arguments other than a non-`true` flag throw messages that start `ui.open:` in the client's own words (`ui.open: takes an object with an id`, `ui.open: <field> does not fit`); `rows` and `columns` are positive integers. | interface.md quotes only `ui.open: focus is true or left out`. Lead: the reference implementation's `ui/panes/open.ts`. |
| J10.107 | A toast held behind a `holdToasts` pane does not spend its time while held; past 50 waiting, the oldest leaves. | interface.md says it "waits until the hold ends"; the declarations (`ui.toast`) say its timer is not started and that past 50 waiting an older one leaves. |
| J10.108 | The width rule for a pane a mod opens by itself is the terminal's; other apps place it; a terminal that has not measured itself places none and answers a reason (`the terminal has not been measured yet`). | interface.md speaks of "a terminal at least 144 columns wide" and gives no reason text. Lead: the reference implementation's `ui/panes/placement.ts`. |
| J10.109 | The reason for a mod with no surface that draws placed rows is `no attached surface draws placed rows yet`; at the limit, `a plugin holds at most 500 placed rows`; the `requestId` of a row placed again after one went is new. A row stays when its mod reloads. | interface.md gives the first as an example, reference.md "Limits" quotes the second; neither names a `requestId` format or a reload. |
| J10.110 | The Desktop app grants `focus: true` by the terminal's rule; a click focuses a pane on every surface but a terminal outside fullscreen rendering. | interface.md states the rule for the terminal and the VS Code extension only. |
| J10.111 | Tab wraps from the last control to the first; Up and Down stop at the ends; Enter with nothing focused and a page key on a drawing that fits do nothing; Ctrl+X then X reads `x` or `X`. | "What each key does" names each key's effect, not the ends or the empty case. Lead: the reference implementation's `ui/keyboard/keys.ts`. |
| J10.112 | A `$.state` write inside a `ui.render` hook is refused at run time and listed by the validator under `state writes` without an error. | interface.md says a render hook "can't write" state and gives no message; the declarations' `state.set` say it is "Refused while a `ui.render` hook draws", and they win (E2). The reference implementation lets the write take effect without a redraw, which this chapter does not follow. Oracle 2.1.325: `claude plugin validate` on such a module prints `state writes: <plugin>.<key>` and no error. |
| J10.175 | The keymap of §10.27.5 (contexts, actions, defaults, chords, unbinding, `keybindings.json`) is the presenting client's; a library that runs mods takes the focus and surface facts and an action's binding from its host and returns which button a hotkey, a digit or an `action` binding presses, and the host runs the above-prompt and pane actions. | `keybindings.md` describes one keymap the user edits for the whole terminal interface ("Contexts", "Unbind default shortcuts"); a mod declares only a button's `hotkey` and `action` (`reference.md`, "Elements"), so the part a mod can observe is which button a key presses, and that is all a library without a terminal can decide. |
| J10.176 | Buttons that share a key, written or taken from one label, leave the tree valid; only `press` by that key in a test fails, `key each once`. `is drawn twice` is for `Input` and `Select`. | interface.md, "Which controls need a `key`", requires a key of `Input` and `Select` only; troubleshoot.md gives `key each once` for a drawing with more than one button with the key passed, so such a drawing is drawn, and its `is drawn twice` example is an `Input`. Lead: the reference implementation's row for `src/mods/ui/elements/button.ts`. |
| J10.113 | The theme's newer attributes (`colors`, and the declarations' `sound` and `style`) and a ground backdrop are passed to the surface as given; the client checks their shape against the declarations and reads none of them. A client MAY also accept the pre-2.1.323 spellings `backdrop.id` and `backdrop.colorScheme`. | interface.md of 2.1.330 says `$.theme.set` takes `colors` and points to the types for the rest; the 2.1.330 declarations (`ThemeSetArgs`, `claude-code/index.d.ts:17320`) say the engine "doesn't read" `colors` and that `sound` and `style` are the Desktop app's to play and draw. Whether 2.1.330 still accepts `id` is not documented; the note "Before v2.1.323, write `id`" implies it does not. |
