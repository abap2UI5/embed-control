# AGENTS.md — AI Assistant Guide for the abap2UI5 embed control

> This file follows the cross-tool AGENTS.md convention and is the single
> agent instruction file of this repository. `CLAUDE.md` next to it is a
> pointer at this file, nothing more.

## What this repository is

The source of the npm package **`@abap2ui5/embed-control`**
(`packages/embed-control`): the UI5 custom control
`z2ui5.embed.Container`, which runs an abap2UI5 app - an ABAP class
implementing `z2ui5_if_app` - inside any UI5 app. Nothing else: the examples
that consume the package - a UI5 freestyle app, Fiori elements apps for
OData V4 and V2 (with the RAP service the latter reads) and a UI
Integration Card for SAP Build Work Zone - their Playwright tests and the
branches that deliver them live in
[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control),
where they take the package from npm. CI here runs them with the control of
the commit (see "The examples are tested here, but live there").

**Language:** English for all code, comments, docs, commit messages, PRs.

## The package is the control and nothing else

The abap2UI5 frontend - the `z2ui5` UI5 component the control wraps - is
**not** part of this repository or the package. The control loads it at run
time from the abap2UI5 service it talks to
(`GET <endpoint>?z2ui5-bundle`, answered by `z2ui5_cl_ui5_http_handler` from
the generated `z2ui5_cl_ui5f_preload`; its only source is
[abap2UI5 `app/webapp`](https://github.com/abap2UI5/abap2UI5/tree/main/app/webapp)).

- Never vendor, copy or pin the frontend here, and add nothing to the package
  that has to follow abap2UI5's releases.
- A change the control needs from the frontend (an embedded mode, a new
  `componentData` setting, ...) is a pull request to abap2UI5. Do not work
  around a frontend limitation in the control when the fix belongs there -
  say so instead.
- Nothing is deployed to an ABAP system for the control: it is a plain
  module (no component, no library, no manifest), so it never takes an app
  index entry, and any number of apps carry their own copy.

## Layout

| Path | |
|---|---|
| `packages/embed-control/src/` | The control (`Container.js`) and its stylesheet |
| `packages/embed-control/ui5.yaml` | UI5 CLI project of type `module`: `/thirdparty/z2ui5/embed/` → `src/` |
| `packages/embed-control/README.md` | The consumer documentation - what npm shows |
| `packages/embed-control/CHANGELOG.md` | Every release; the publish checks it |
| `scripts/consumer-check.mjs` | The packed package in an app of its own, built with UI5 CLI 3 and 4 |
| `scripts/release-check.mjs` | The gate before `npm publish`: tag, version, changelog and repository agree |
| `test/container.test.mjs` | The Node tests of the control: its module run with stubs for UI5 - no browser, no backend (`npm test`) |
| `.github/workflows/` | `ci.yaml` (checks, consumer builds, and the examples of samples-embed-control with the control of the commit - their branch build and their e2e tests against abap2UI5's default branch and the 1.145.0 floor - on every pull request, every night, and before every publish), `publish.yaml` (npm, on a GitHub release) |

## The examples are tested here, but live there

[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
is the source of the examples, their tests (`test/e2e/`,
`playwright.config.mjs`) and their branch build (`scripts/build-bsp.mjs`).
The `samples` job of `ci.yaml` checks out its `main`, runs `npm ci` there,
unpacks `npm pack` of `packages/embed-control` into its
`node_modules/@abap2ui5/embed-control` - the one copy every example takes -
and runs `npm run bsp` and `npx playwright test` there.

- **Never add an example, a test app or a copy of the examples here.** A
  test of the control is a test in samples-embed-control, against one of its
  examples; a new example goes there too. The one exception needs no
  browser: `test/container.test.mjs` runs the control's module in Node with
  stubs for UI5 and pins what the control decides before UI5 is involved -
  the endpoint check and what is requested, what the component gets, when a
  start happens, is repeated or given up. A case of that kind goes there;
  everything that renders or talks to a backend goes over there.
- **The floor leg names samples-embed-control's Playwright projects** and
  its tag `@after-1.145.0`. A project renamed over there is renamed in
  `ci.yaml` here in the same breath.
- **A control change that needs an example to change** - new behaviour a
  test pins down differently - needs both sides: the examples over there must
  pass with the published control and with the one of this `main`. Land the
  control first when the examples cannot do both, and say so in the pull
  request.
- **An example only reaches the control's new features with its release**:
  samples-embed-control takes the package from npm, by its lockfile.

## Rules for `src/`

- **UI5 1.71 is the floor**, as in abap2UI5. Use no module, class, property or
  enum newer than 1.71, and no `sap/ui/core/Lib` / `sap/ui/core/Element`
  static APIs. What the control uses today and since when:
  `sap/ui/dom/includeStylesheet` (1.58), `sap/base/Log` (1.58),
  `Component.create` (1.56), `ComponentContainer#lifecycle` (1.56), renderer
  `apiVersion: 2` (1.67).
  The e2e tests run the freestyle example on 1.71 too
  (samples-embed-control's `freestyle/ui5-1.71.yaml`, the `ui5-1.71`
  Playwright project) - a change to `src/` is done when every project of the
  `samples` job passes, the `fiori-elements` and `fiori-elements-v2` ones
  included.
- **Keep the control thin.** It picks the class, the endpoint and the size;
  everything the app does comes from the backend through the component. It
  configures the component only through what the frontend reads itself -
  `componentData` (abap2UI5 `Component.init`), filled from the bundle's
  `z2ui5/embed` module plus `startupParameters` and `endpoint` - never by
  patching the manifest or reaching into the component's state.
- **The bundle is code - load it only from a path on this server.** Keep the
  `sameOriginUrl` check: the `endpoint` is parsed the way the browser parses
  it (`new URL(endpoint, location.href)`), refused before anything is
  requested unless it is http(s) on the page's origin, and only the resolved
  absolute URL is requested and handed to the frontend - never the raw
  string, which the URL parser rewrites (it drops tabs and line breaks, reads
  a backslash as a slash), and never a bare path, which the browser resolves
  against the page's `<base>` - another host, possibly. A path that begins
  with `//` is refused too: the parser drops `.` and `..` segments, so
  `/.//host` comes out on the page's origin with the path `//host`, another
  host wherever that path is used on its own. Load it with a
  `<script src>`, never with `eval`, `new Function` or `fetch` + inject.
- **One frontend per page, one component per control, one backend session per
  component.** The bundle is loaded once; a change of `app`, `endpoint` or
  `params` replaces the component, and so does `restart()`; nothing is
  patched into a running one. A start is compared by what the backend gets
  - the resolved endpoint, the params as `startupParameters` makes them -
  never by the raw property values. A control that shared a load from
  another control's endpoint and saw it fail tries its own once; a failed
  start is never repeated by the control itself.
- **`width` and `height` go to the live DOM, not through a rendering**
  (`_setSizeProperty`): a re-rendering of the control re-renders the
  ComponentContainer and with it every control of the app, and UI5 1.71
  rebuilds their DOM - the value the user was typing and the focus went with
  it. A property the ComponentContainer does not draw from is written with
  `setProperty(name, value, true)` and applied to the DOM the same way.
- **Nothing starts for a control nobody sees.** UI5 calls
  `onBeforeRendering` for an invisible control too; the control starts only
  while `visible`, and an app that runs keeps running while it is hidden.
- **Every failure reaches the host asynchronously**, from the promise chain
  after the rendering that started the app - the refused endpoint included.
  Never fire `componentFailed` or `componentCreated` inside a rendering hook.
- **`thirdparty/`, not `resources/`.** An app deployed to an ABAP system
  answers every `<app>/resources/` path from the system's UI5; the control is
  served and built under `thirdparty/z2ui5/embed/` and registered with a
  relative resourceRoot. Keep `ui5.yaml`, the consumer README and the
  examples' manifests in samples-embed-control in step.
- **`z2ui5/embed` is the backend's module, `z2ui5/embed/` this package's
  namespace.** The bundle defines the module; the control's own modules live
  below it. Never add a module named `z2ui5/embed` here, and a folder
  `app/webapp/embed/` in abap2UI5 would collide with this namespace.
- **No inline styles for descendants and no `eval`**: a host with a strict
  Content-Security-Policy must need nothing extra. Styles go into
  `Container.css`, scoped under `.z2ui5EmbedContainer`.
- A UI5 module id is case-sensitive and a wrong one only fails in the browser
  (`includeStylesheet`, not `includeStyleSheet`) - run the e2e tests.

## Rules for the package

- **The package's `ui5.yaml` stays at specVersion 3.0.** The consumer's UI5
  CLI reads it, and UI5 CLI 3 refuses a dependency with 4.0.
  `npm run consumer:check` builds the packed package with CLI 3 and 4.
- **abap2UI5 1.145.0 is the backend floor** - the first release that answers
  `?z2ui5-bundle`. The package records it in its `package.json`
  (`"abap2ui5": { "minBackend": "1.145.0" }`, the custom-field style
  `@abap2ui5/node-runtime` uses), the package README names it in prose,
  with what 1.145.0 does not do yet, and the samples job of `ci.yaml` runs
  the examples against it (the published `@abap2ui5/node-runtime` of that
  version, read from the field by the job `floor`) next to abap2UI5 main;
  raise it in package.json and the README - and in samples-embed-control's
  `ci.yaml`, which tests the published control - when the control starts to
  rely on something newer. A test that needs a newer backend is tagged
  `@after-<floor>` (`@after-1.145.0` today), which the floor leg leaves
  out, as it leaves out the Fiori elements examples, which need the hash. The
  package has no `engines`: it is a browser control without Node code, and a
  UI5 CLI 3 consumer may install it on Node 16 or 18.
- **A host that routes by the hash needs abap2UI5 1.146.0.** Its
  bundle marks the component embedded (`componentData.embedded`, abap2UI5
  `Component.init`), and an embedded component leaves the URL hash to the
  host - 1.145.0 clears it after every roundtrip, which sends a Fiori
  elements object page back to its list, and takes SAP Build Work Zone off
  the page a card sits on. The control passes the bundle's component data
  through and sets no flag of its own. The READMEs name 1.146.0 for it.

## Validation

```bash
npm ci
npm run lint && npm run format:check
npm test              # the Node tests of the control (test/), no browser, no backend
npm run pack:check     # package contents: ui5.yaml, src/ and CHANGELOG.md (npm adds README, LICENSE)
npm run consumer:check # the tarball in an app of its own, built with UI5 CLI 3 and 4
```

A change to `src/` also runs the examples - in a checkout of
samples-embed-control, with this package copied into its
`node_modules/@abap2ui5/embed-control` (README, "Checks"): `npm run bsp`
and `npx playwright test` there, against an abap2UI5 backend with
`?z2ui5-bundle` on `:3000`.

All text files are LF-only. The JavaScript, JSON and CSS files are formatted
with Prettier (`.prettierrc`, `npm run format:check`); the Markdown files are
not - Prettier would pad every table to its column width.

## Publishing

A GitHub release `v<version>` publishes the version in
`packages/embed-control/package.json` - by trusted publishing (OIDC, no
token), after the whole CI passed on that commit (`publish.yaml` calls
`ci.yaml`). The steps are in the README; the one-time setup is in the header
of `publish.yaml`.

- **The examples follow with a bump over there.** samples-embed-control
  takes a new version with its lockfile (dependabot, or by hand after the
  release - with the examples' ranges, once the version leaves them).
- **Every release has its section in `packages/embed-control/CHANGELOG.md`**,
  and nothing stays under "Unreleased". `scripts/release-check.mjs` refuses
  the publish otherwise, and a tag that does not name the version.
- **`repository.url` names the repository the workflow runs in** - npm
  refuses the provenance otherwise. A renamed repository needs package.json
  and the Trusted Publisher entry on npmjs.com to follow.
- Running `publish.yaml` by hand is a dry run. Never publish from a
  developer machine except the one-time first version (README, "The first
  version").
