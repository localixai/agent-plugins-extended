# 16. Install, updates and dependencies — dependencies

Part of §16 ([16-install.md](16-install.md) is its start): plugins that need other plugins. A
plugin declares them in the `dependencies` array of its manifest (§2.4) or of its marketplace entry
(§15); this file says how a client resolves, installs, checks and removes them. The npm and Bun
packages a plugin's own code needs are §16.7. Evidence: `plugins/dependencies.md` unless a section
names another page.

## 16.23 Declaring a dependency

1. Each `dependencies` item is one of:
   - a string `"<name>"`: the plugin of that entry name in the declaring plugin's own marketplace, at
     whatever version that marketplace provides;
   - a string `"<name>@<marketplace>"`: the plugin in another marketplace (§16.27);
   - an object whose fields are strings:

     | Field | Required | Meaning |
     | --- | --- | --- |
     | `name` | yes | The dependency's entry name in its marketplace; looked up in the declaring plugin's marketplace unless `marketplace` is set. <!-- req: dependencies.field.name --> |
     | `version` | no | A node-semver range (`~2.1.0`, `^2.0`, `>=1.4`, `=2.1.0`). The dependency installs at the highest git tag that satisfies it (§16.25). <!-- req: dependencies.field.version --> |
     | `marketplace` | no | Another marketplace to resolve `name` in, under the allowlist of §16.27. <!-- req: dependencies.field.marketplace --> |

2. A range MUST NOT match a pre-release such as `2.0.0-beta.1` unless it opts in with a pre-release
   comparator such as `^2.0.0-0`, as node-semver does.
3. A string with more than one `@`, or an object without `name`, is invalid and fails the manifest
   (`dependencies.<i>: Invalid input`). An object key other than the three is ignored. An empty or
   blank `version` is no constraint. A `version` that is not a valid range is not a manifest error; it
   is reported when the dependency is resolved or checked, as `has an invalid version requirement`
   (§16.30) (Judgment J16.17).
4. Without a constraint, a dependency moves to each release its marketplace publishes at the user's
   next update; with `~2.1.0` on a git-backed dependency, users keep receiving `2.1.x` and never move
   to `2.2`.

### 16.23.1 Bundles

A manifest with only `name` and `dependencies` is a valid plugin, so a **bundle** — a plugin whose
install installs a curated set — needs nothing else. A new member is added by publishing a new
version of the bundle; users receive it through auto-update of the marketplace, or with
`claude plugin update <bundle>` and then `/reload-plugins`, which installs the added dependencies.
An admin deploys a bundle to everyone by enabling it in managed `enabledPlugins` (§14).
<!-- req: dependencies.guide.Bundle plugins for a team -->

## 16.24 Install, enable and disable

When the user installs, enables or disables a plugin from a marketplace, the client MUST act on its
dependencies too (`plugins/install.md`, "Plugins with dependencies"):

1. **Install** installs and enables every declared dependency, transitively, at the same scope, and
   the success message lists them (` (+ N dependencies: <ids>)`). A dependency is enabled whatever its
   own `defaultEnabled` (§2.4); a dependency installed only at another scope is installed again at the
   target scope. The walk has no depth limit: each plugin is planned once, dependencies first, and a
   cycle ends the walk (Judgment J16.18). <!-- req: install.guide.Plugins with dependencies.Install -->
2. **Enable** also enables declared dependencies that are installed but disabled. When a declared
   dependency is not installed, the enable fails and says to install it first.
   <!-- req: install.guide.Plugins with dependencies.Enable -->
3. **Disable** of a plugin another enabled plugin still needs MUST be refused, with a chained command
   that disables both in the right order (dependents first).
   <!-- req: install.guide.Plugins with dependencies.Disable -->
4. **Uninstall** leaves auto-installed dependencies in place until `claude plugin prune` (§16.29).
   <!-- req: install.guide.Plugins with dependencies.Uninstall -->

Besides `claude plugin install`, these also install any missing declared dependency, under the
same limits: `/reload-plugins` (§16.12), auto-update of the dependent's marketplace (§16.19),
running `claude plugin install` again on the dependent, and `claude plugin marketplace add`. A
client MUST NOT itself install a dependency with a `command` source, nor run a dependency entry's
`headersHelper`; the user installs such a dependency first, by itself. Until then the dependent fails
to install (`plugins/host-marketplace.md`, "Installs and updates that refuse a command instead of
asking"; §15.15.4); a dependency its marketplace does not list refuses the install too.
<!-- req: dependencies.guide.Constrain a dependency that has a non-git source -->

## 16.25 Resolution against tags

1. A constraint resolves against git tags of the repository that hosts the dependency, the one its
   plugin source points at (§15): the plugin's own repository for a `github`, `url` or `git-subdir`
   source; the marketplace repository for a relative path.
2. A release tag is `<plugin-name>--v<version>`, where `<version>` matches that commit's
   `plugin.json`. The prefix lets one repository host several plugins with their own histories. A tag
   whose version is not a strict semver (a `v` or `=` before it, fewer than three parts) is not a
   release tag; build metadata is ignored (Judgment J16.19).
3. `claude plugin tag` (§17) builds the name from the manifest; before tagging it validates the
   plugin, checks that `plugin.json` and the marketplace entry agree on the version when inside a
   marketplace checkout, requires a clean working tree under the plugin directory, and refuses an
   existing tag. It prints `Created tag <name>--v<version>`, and with `--push` `Pushed to origin`;
   without it, the `git push` command to run. `--dry-run` shows the plan. A plain `git tag` works when
   the author keeps the two versions in sync. <!-- req: dependencies.guide.Create a release tag -->
4. For `{ "name": "secrets-vault", "version": "~2.1.0" }`, the dependency installs from the highest
   `secrets-vault--v` tag satisfying `~2.1.0`. When none does:
   - a dependency with its own repository fails to install with a message containing `Dependency
     "secrets-vault@<marketplace>" has no git tag satisfying`;
   - a dependency referenced by a relative path installs from the marketplace's current copy, and the
     range is checked at load: outside it, the dependent stays disabled and `claude plugin list` shows
     `Requires "secrets-vault@<marketplace>" ~2.1.0, installed 3.0.0`.

   A marketplace added from a local folder that is a git repository resolves relative-path constraints
   against that folder's tags; one that is not a git repository has no tags, and the dependency
   installs from the folder's current contents. <!-- req: dependencies.guide.How a constraint resolves against tags -->
5. A tag-resolved dependency's version is the tag version with a 12-character commit suffix, such as
   `2.1.0-8713c5b11005`, shown by `claude plugin list`. Range checks use the tag's version, not the
   `version` in `plugin.json` at that commit. A tag force-moved to another commit fetches that commit's
   content at the next install instead of reusing the cached copy, because the version is the cache
   key (§16.16). <!-- req: dependencies.guide.Confirm the resolved version -->
6. **Non-git sources**: for an `npm`, `archive` or `command` dependency the constraint does not choose
   what is fetched, but it is still checked at load against the `version` in the dependency's
   `plugin.json`, and the dependent is disabled when it does not satisfy it. A `plugin.json` without
   `version` satisfies no constraint. <!-- req: dependencies.guide.Constrain a dependency that has a non-git source -->

## 16.26 Combining constraints

1. When several installed plugins constrain one dependency, it resolves to the highest version that
   satisfies every range. Every installed plugin's range counts, whatever its scope or enabled state,
   except that a plugin being installed or updated speaks with its current declaration, not with the
   ranges recorded for its earlier install (Judgment J16.20).

   | Plugin A | Plugin B | Result |
   | --- | --- | --- |
   | `^2.0` | `>=2.1` | One install at the highest `2.x` tag at or above `2.1.0`; both load. <!-- req: dependencies.guide.Combine constraints from several plugins.^2.0 --> |
   | `~2.1` | `~3.0` | Installing B fails with `has conflicting version requirements`; A and the dependency stay as they were. <!-- req: dependencies.guide.Combine constraints from several plugins.~2.1 --> |
   | `=2.1.0` | none | The dependency stays at `2.1.0`; auto-update skips newer versions while A is installed. <!-- req: dependencies.guide.Combine constraints from several plugins.=2.1.0 --> |

2. Ranges conflict when no version satisfies all of them. A client decides it by distributing each
   range's `||` alternatives and testing whether the chosen intervals meet; above 64 combinations it
   reports `has version requirements too complex to intersect` (Judgment J16.21). A conflict refuses
   the install even for a source whose version no tag chooses.
3. Auto-update fetches a constrained dependency at the highest tag satisfying every installed range,
   not at the marketplace's latest. When the ranges do not overlap, it leaves the dependency at its
   version and the **Errors** tab names the constraining plugin. When they overlap but no tag falls in
   them, it fetches the marketplace's current copy and skips the update when that copy's `version`
   is outside any range.
4. When the last plugin that constrains a dependency is uninstalled, the dependency follows its
   marketplace entry again at the next update.

## 16.27 Dependencies in another marketplace

1. By default a client MUST NOT install a dependency from a marketplace other than the declaring
   plugin's own, unless the user already has it installed and enabled at the same scope, in which case
   no allowlist check applies.
2. The **root marketplace** — the one hosting the plugin being installed — allows it by listing the
   target marketplace's name in `allowCrossMarketplaceDependenciesOn` in its `marketplace.json` (§15).
   Only the root's allowlist applies; a dependency in the root marketplace itself or in the declaring
   plugin's own marketplace needs no entry.
3. Without the allowlist entry, a dependency declared in the **marketplace entry** refuses the install
   with `Dependency "<dep>" (required by <plugin>) is in marketplace "<marketplace>", which is not in
   the allowlist`, continuing `; add it to "allowCrossMarketplaceDependenciesOn" in the
   marketplace.json of "<root>"` (Judgment J16.22). A dependency declared in **`plugin.json`** is left
   out: the install completes without it, and the plugin then fails to load (§16.30).
   <!-- req: dependencies.guide.Depend on a plugin from another marketplace -->

## 16.28 Local copies and claude.ai

### 16.28.1 Testing with `--plugin-dir`

An author developing a plugin and its dependency together loads both with `--plugin-dir` (§16.8), or
passes their parent folder once (2.1.265 or later). The local copy satisfies the dependency entry
without an install from the marketplace. The local copy meets the entry only until the dependency
is installed from its marketplace: from then on the entry is checked against the installed copy
(its enabled state and range), even though the local copy is the one that loads in that session
(§16.11). <!-- req: dependencies.guide.Test a plugin and its dependency locally -->

1. A version constraint MUST NOT be checked against a local copy, so the local `plugin.json` needs no
   `version` (oracle 2.1.325: `^5.0` against a local `1.0.0` loads).
   <!-- req: dependencies.guide.Test a plugin and its dependency locally.No version needed -->
2. An entry that names a marketplace also matches the local copy, by name (2.1.242 or later).
   <!-- req: dependencies.guide.Test a plugin and its dependency locally.Entries that name a marketplace -->
3. When the local copy is disabled, the dependent is disabled at the next plugin load with an error
   that ends `is disabled — enable it or remove the dependency`. The error names the dependency by
   the id its entry resolves to: `<name>@<marketplace>` when the entry names a marketplace or the
   dependent's own marketplace is implied (`Dependency "q2@m" is disabled — …` for a `q2` entry of
   an installed `p@m`), the bare declared name when no marketplace is implied, as for a
   `--plugin-dir` dependent (`Dependency "q2" is disabled — …`; Judgment J16.24);
   wherever a message names a plugin `<name>@inline`, that id means the `--plugin-dir` copy, never
   an installed one. When a session starts without the dependency's flag, the error reports it not
   installed. A local copy that itself fails to load for a dependency is no copy,
   so its dependents stop loading too.
   <!-- req: dependencies.guide.Test a plugin and its dependency locally.You disabled the local copy -->

### 16.28.2 A plugin loaded from claude.ai

For a dependent loaded as `<name>@synced` (§16.10), an entry that names a marketplace is met by
either the dependency installed from that marketplace and enabled, with its range checked against the
installed version, or an enabled claude.ai plugin of the same name, with its range checked against
that plugin's `version` (one without `version` passes). A claude.ai plugin meets an entry only for a
dependent that also loads from claude.ai; otherwise the `is not installed` message carries
`"<name>@synced" is loaded from your claude.ai account but meets a marketplace dependency only for
other claude.ai plugins`.

## 16.29 Uninstall and prune

1. Uninstalling a plugin other enabled plugins depend on is not refused, and there is no `--force`
   to ask for it: the uninstall succeeds (`claude plugin uninstall` exits `0`, §17.5) and the client
   SHOULD warn, naming the enabled dependents by name; the success line ends
   ` — warning: required by <names>`. The dependents then fail to load with `is not installed`
   (§16.30; Judgment J16.23).
2. `claude plugin prune` (alias `autoremove`, §17) removes, at one scope, the auto-installed
   dependencies no installed plugin at that scope needs any more, and never a plugin the user
   installed. Auto-installed plugins that need only each other are removed; a disabled plugin the user
   installed still needs its dependencies. `claude plugin uninstall --prune` does the same after the
   uninstall. The data retention rules of §16.13 apply to each removed plugin.

## 16.30 Dependency errors

A dependency that cannot be satisfied fails the install, or leaves the plugin installed and
**disabled** until it is resolved (`plugins/troubleshooting.md`, "Dependency errors"). At install the
refusal is the install's error; at load the problem is shown in `claude plugin list` and the **Errors**
tab, and the client MUST keep the affected plugin, and what depends on it, out of the session.

| Message | Meaning | `errorDetails.type` |
| --- | --- | --- |
| `Dependency "<dep>" is not installed` | A declared dependency is not installed. Adding its marketplace and running `/reload-plugins` installs what it can resolve. <!-- req: install.troubleshooting.Dependency errors.Dependency "<dep>" is not installed --> | `dependency-unsatisfied` |
| `Dependency "<dep>" is disabled — enable it or remove the dependency` | Installed but off. <!-- req: install.troubleshooting.Dependency errors.Dependency "<dep>" is disabled --> | `dependency-unsatisfied` |
| `Requires "<dep>" <range>, installed <version>` | The installed version is outside the range. | `dependency-version-unsatisfied` |
| `<Plugin or Dependency> "<name>" has conflicting version requirements` | No version satisfies every range; the message lists them (§16.26). | |
| `… has version requirements too complex to intersect` / `… has an invalid version requirement: "<range>"` | The combined ranges cannot be intersected, or a range is not valid semver. <!-- req: install.troubleshooting.Dependency errors.has an invalid version requirement --> | |
| `… has no git tag satisfying <range>` | The dependency's repository has no `<name>--v*` tag in the range (§16.25). <!-- req: install.troubleshooting.Dependency errors.... has no git tag satisfying <range> --> | |
| `Dependency "<dep>" (required by <plugin>) is in marketplace "<marketplace>", which is not in the allowlist` | §16.27; the user can install the dependency at the same scope and retry. | |

`claude plugin list --json` carries an `errors` array with the messages and an `errorDetails` array
whose items have `type`, `plugin` and `dependency` (§17). Claude Code 2.1.325 appends `` — run
`claude plugin install <dep>`, or check that its marketplace is added `` to the `is not installed`
line; a client MAY append its own guidance after the documented text (Judgment J16.24).

## Design decisions

### Why a constraint resolves against tags, not against `plugin.json`

A marketplace serves one copy of a plugin at a time, so the only record of the versions it served
before is its repository's history. A tag names a commit for a version without trusting a manifest
that may lag behind.

### Why cross-marketplace dependencies need the root's allowlist

Installing from a marketplace is a decision to trust it. Without the allowlist, one marketplace could
install plugins from a source the user never reviewed; an install the user already made is their
decision, so it needs no allowlist.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J16.17 | A dependency string with two `@` and an object without `name` fail the manifest; an unknown object key is ignored; an invalid range is not a manifest error but `has an invalid version requirement` at resolution or load; a blank `version` is no constraint (§16.23). | The docs say only that the fields are strings. Oracle 2.1.325 (`claude plugin validate`): `"a@b@c"` → `dependencies.1: Invalid input`; `{ "version": "^1" }` → `dependencies.0: Invalid input`; `{ "name": "x", "version": "not a range" }` and an extra key pass. Reference: `src/marketplace/dependencies.ts`. |
| J16.18 | The dependency walk has no depth limit, plans each plugin once in dependencies-first order, never plans the root as its own dependency, and ends on a cycle; a dependency installed only at another scope is installed again at the target scope (§16.24). | The docs say dependencies install "at the same scope", not how deep or what a cycle does. Reference: `src/marketplace/dependency-install-walk.ts`, `dependency-install-plan.ts`. |
| J16.19 | A release tag is exactly `<name>--v<strict semver>`; `v`, `=` or blanks before the version, or fewer than three parts, are not tags of the plugin; build metadata is dropped (§16.25). | The docs give `<plugin-name>--v<version>` only. Reference: `src/marketplace/dependency-tags.ts`. |
| J16.20 | Every installed plugin's range counts, whatever its scope or enabled state, except that the plugin being installed or updated is planned against its current declaration only (§16.26). | The docs say "several installed plugins"; counting a plugin's stale range against its own new one would refuse its update. Reference: `src/marketplace/dependency-install-plan.ts`. |
| J16.21 | Ranges overlap when some combination of their `||` alternatives meets pairwise; over 64 combinations the requirement is "too complex to intersect" (§16.26). | The docs name the message, not the limit or method. Reference: `src/marketplace/semver.ts`. |
| J16.22 | The cross-marketplace refusal continues `; add it to "allowCrossMarketplaceDependenciesOn" in the marketplace.json of "<root>"` (§16.27). | The docs quote the start and say it "names the field to set". Reference: `src/marketplace/cross-marketplace.ts`. |
| J16.23 | Uninstalling a dependency of enabled plugins succeeds, the success line ending ` — warning: required by <names>` (the enabled dependents, by name); `uninstall` has no `--force` (§16.29; §17 cites this row). | The docs refuse a disable in that case and say nothing about uninstall. Reference oracle 2.1.322: `✔ Successfully uninstalled plugin: b (scope: user) — warning: required by a`, exit 0 (`tests/cli/uninstall-dependents.test.ts`). Not re-run here: an uninstall writes state. |
| J16.24 | The `is not installed` line is the documented text; guidance after it is the client's own. A disabled dependency is named by the id its entry resolves to: `<name>@<marketplace>` when a marketplace is named or implied by the dependent's, the bare declared name when none is (a `--plugin-dir` dependent), never `<name>@inline`; the same id is the `dependency` of the `errorDetails` item. The docs' "when the error names the dependency as `<name>@inline`" is read as saying what that id means where it appears (in `plugin list` and the session-only rows of §16.8), not that the error uses it (§16.28.1, §16.30). | Oracle 2.1.325 (`claude --plugin-dir … plugin list`, private config dir): `Dependency "q3" is not installed — run \`claude plugin install q3\`, or check that its marketplace is added`; a disabled local `q2` gave `Dependency "q2" is disabled — enable it or remove the dependency`, naming `q2`, not `q2@inline`. Oracle 2.1.325, private config dir, a directory marketplace `m` with `p` declaring `["q2"]`, both installed, `q2@m` then set `false` in `enabledPlugins` (`plugin disable q2@m` refuses while `p` needs it): `plugin list --json` gave `Dependency "q2@m" is disabled — enable it or remove the dependency` and `errorDetails` `{"type":"dependency-unsatisfied","plugin":"p","dependency":"q2@m"}`. The 2.1.321 docs quote only the opening. |
