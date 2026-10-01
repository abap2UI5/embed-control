# AGENTS.md — AI Assistant Guide for the abap2UI5 embed control

> This file follows the cross-tool AGENTS.md convention and is the single
> agent instruction file of this repository. `CLAUDE.md` next to it is a
> pointer at this file, nothing more.

## What this repository is

The source of the npm package **`@abap2ui5/embed-control`**
(`packages/embed-control`): the UI5 custom control
`z2ui5.embed.Container`, which runs an abap2UI5 app - an ABAP class
implementing `z2ui5_if_app` - inside any UI5 app. Next to it the examples
that consume the package the way an app from the registry would - a UI5
freestyle app (`examples/freestyle`), a Fiori elements app with the control
in a custom section of its object page (`examples/fiori-elements`), a Fiori
elements app for OData V2 with the control in an object page extension and
the RAP service it reads (`examples/fiori-elements-v2`) and a generic UI
Integration Card for SAP Build Work Zone (`examples/card`) - and
Playwright tests (`test/e2e`) that drive them against a live abap2UI5
backend. The examples are delivered, with the published package, to
[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control).

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
| `examples/freestyle/` | The freestyle example: a plain UI5 app, `includeDependency` and the `z2ui5.embed` resourceRoot, `ui5-middleware-simpleproxy` to the backend - `ui5.yaml` to an SAP system (`npm start`), `ui5-local.yaml` to abap2UI5 in Node on `localhost:3000` (`npm run start-local`, what the e2e tests use). Delivered as `freestyle/` and as the BSP - its README is written for both places |
| `examples/fiori-elements/` | The Fiori elements example: SAPUI5, list report and object page on a mock OData V4 service (`@sap-ux/ui5-middleware-fe-mockserver`, `webapp/localService/`), the control in the object page's custom section (`webapp/ext/`). Delivered as `fiori-elements/` |
| `examples/fiori-elements-v2/` | The Fiori elements example for OData V2: SAPUI5, list report and object page (`sap.suite.ui.generic.template`) on a mock of the RAP service in `abap/`, under the paths the binding has in a system (`webapp/localService/`), the control in a view extension after the facet `General` (`webapp/ext/`). Delivered as `fiori-elements-v2/`, and on the branch `rap` as BSP with the service |
| `examples/fiori-elements-v2/abap/` | The RAP service of that example and the abap2UI5 app it starts on a system, in abapGit's format: CDS view entity on `T005T`, metadata extension, service definition, OData V2 binding, `Z2UI5_CL_EMBED_COUNTRY`. The successor of abap2UI5-addons/fiori-elements-integration. Delivered as `src/01` of the branch `rap` |
| `examples/card/` | The card example: a UI Integration Card of type `Component`, generic - the class it runs is a card parameter, the backend a card destination the host resolves (`webapp/Component.js`, `onCardReady`) - with `webapp/dt/Configuration.js` for the host's configuration editor and a preview page in `webapp/test/` that `ui5 build` leaves out. OpenUI5, the same `includeDependency`, resourceRoot and the two proxy configurations as the freestyle app. Delivered as `card/` |
| `test/e2e/` | Playwright tests of the examples, one spec file each |
| `scripts/consumer-check.mjs` | The packed package in an app of its own, built with UI5 CLI 3 and 4 |
| `scripts/release-check.mjs` | The gate before `npm publish`: tag, version, changelog and repository agree |
| `scripts/build-bsp.mjs` | The trees abap2UI5/samples-embed-control delivers, built with abap2UI5's tools: `out/standard/` - the examples as UI5 projects and the freestyle one as BSP `Z2UI5_HOST` (`src/`); `out/rap/` - `fiori-elements-v2/abap` (`src/01`) and that example as BSP `Z2UI5_HOST_FE` (`src/02`); `--from-npm` takes the control from the registry |
| `delivery/README.md` | The README of abap2UI5/samples-embed-control, on its `main` and its branches |
| `abaplint.jsonc` | abaplint over the examples' ABAP, against abap2UI5's main (`npm run abaplint`) |
| `.github/workflows/` | `ci.yaml` (checks, consumer builds, the delivered tree, e2e against abap2UI5's default branch and the 1.145.0 floor - on every pull request, every night, and before every publish), `publish.yaml` (npm, on a GitHub release, then the delivery), `frontend_deploy.yaml` (the trees into abap2UI5/samples-embed-control, after a publish and on every change to the examples, the build or its README) |

## Rules for `src/`

- **UI5 1.71 is the floor**, as in abap2UI5. Use no module, class, property or
  enum newer than 1.71, and no `sap/ui/core/Lib` / `sap/ui/core/Element`
  static APIs. What the control uses today and since when:
  `sap/ui/dom/includeStylesheet` (1.58), `Component.create` (1.56),
  `ComponentContainer#lifecycle` (1.56), renderer `apiVersion: 2` (1.67).
  The e2e tests run the freestyle example on 1.71 too
  (`examples/freestyle/ui5-1.71.yaml`, the `ui5-1.71` Playwright project) -
  a change to `src/` is done when every project passes, the
  `fiori-elements` and `fiori-elements-v2` ones included.
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
  example's `manifest.json` in step.
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
  with what 1.145.0 does not do yet, and the e2e job of `ci.yaml` runs
  against it (the published `@abap2ui5/node-runtime` of that version, read
  from the field by the job `floor`) next to abap2UI5 main; raise it in
  package.json and the README when the control starts to rely on something
  newer. A test that needs a newer backend is tagged `@after-<floor>`
  (`@after-1.145.0` today), which the floor leg leaves out - as it leaves
  out the Fiori elements example, which needs the hash. The package has no
  `engines`: it is a browser control without Node code, and a UI5 CLI 3
  consumer may install it on Node 16 or 18.
- **A host that routes by the hash needs abap2UI5 1.146.0.** Its
  bundle marks the component embedded (`componentData.embedded`, abap2UI5
  `Component.init`), and an embedded component leaves the URL hash to the
  host - 1.145.0 clears it after every roundtrip, which sends a Fiori
  elements object page back to its list, and takes SAP Build Work Zone off
  the page a card sits on. The control passes the bundle's component data
  through and sets no flag of its own. The READMEs name 1.146.0 for it, and
  every example's README runs the local backend from
  `@abap2ui5/node-runtime` on npm (its version is the abap2UI5 release).

## Rules for the examples' dev server

- **`npm start` goes to an SAP system, `npm run start-local` to
  `localhost:3000`** - `ui5.yaml` and `ui5-local.yaml`, the split the SAP
  Fiori tools generate. The two differ in the proxy's `baseUri` only; keep
  everything else in step. The e2e tests serve `ui5-local.yaml`.
- **The system's URL stays in `ui5.yaml`, never in `.env`.**
  `ui5-middleware-simpleproxy` loads `.env` itself, and a value from there
  wins over the YAML - a `UI5_MIDDLEWARE_SIMPLE_PROXY_BASEURI` in `.env`
  would send `start-local` to the system too. `.env` carries the user only.
- **No middleware of our own for abap2UI5's CSRF check.** The standard
  proxy sends `X-Forwarded-Host` (`xfwd`), and abap2UI5 compares the
  browser's `Origin` with it (`check_trust_forwarded_host`, on by default
  in every release the control supports). Dropping `Origin` in the dev
  server was needed once and is not any more - do not bring it back; a
  proxy that does not send the header is the thing to fix.

## Delivery: abap2UI5/samples-embed-control

[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
shows the examples the way apps use the package from npm, on two branches.
`standard`: `freestyle/`, `fiori-elements/`, `fiori-elements-v2/` and
`card/` are the examples as UI5 projects, `src/` the freestyle app as the BSP
`Z2UI5_HOST`, to try the control on any abap2UI5 system with a plain abapGit
pull. `rap`: `src/01` the RAP service of `fiori-elements-v2` and the
abap2UI5 app it starts, `src/02` that example as the BSP `Z2UI5_HOST_FE` -
one pull on a system with RAP. Everything in them comes from here:
`scripts/build-bsp.mjs` builds the trees from `examples/*` and the control in
`thirdparty/z2ui5/embed/`, with abap2UI5's BSP tools (`ABAP2UI5_DIR`,
abap2UI5's main in CI), and `frontend_deploy.yaml` writes them into
samples-embed-control's `main` as `result/<branch>`, where the `deliver`
workflow over there makes the branches.

- **No frontend in the trees.** The control loads it from the system, as in
  any app - a branch is the example apps, their ABAP and the control,
  nothing else.
- **A branch is one abapGit repository with its BSP in `src/02`** - where
  abap2UI5's `check-pages` looks for it - and an identity of its own: BSP
  name and ICF nodes (`BRANCHES` in `build-bsp.mjs`), so every branch
  installs next to the other and next to abap2UI5/frontend. A new branch
  goes into `BRANCHES`, into the loop of `frontend_deploy.yaml` and into the
  `deliver` workflow of samples-embed-control - a maintenance pull request
  over there, which a maintainer labels; until it is merged, the folder
  reaches `main` there and no branch.
- **`standard` stays installable on every abap2UI5 system.** ABAP that needs
  more - RAP, OData - goes onto a branch of its own, as `rap` does; an
  abapGit pull fails on the objects a system cannot activate.
- **The delivered control is the published package.** The delivery builds
  with `--from-npm`, which installs the version
  `packages/embed-control/package.json` names from the registry - and only
  from a commit whose `src/` and `ui5.yaml` are that published version. A
  change to the control, and an example that needs it, reach
  samples-embed-control with the release that publishes them;
  `publish.yaml` calls the delivery right after the publish. The
  pull-request check (`ci.yaml`, job `bsp`) builds without `--from-npm`,
  with the control of the commit.
- **Every example is delivered under its name, as git has it**, without
  what only the tests here use (`ui5-1.71.yaml` - `TESTS_ONLY` in
  `build-bsp.mjs`). A new example goes into `EXAMPLES` there. Only an app
  whose service a branch brings becomes a BSP: the freestyle app on
  `standard`, the Fiori elements app for OData V2 on `rap`, with its RAP
  service. The one for OData V4 mocks a service no system has, and a card
  is deployed to its host. The BSP of `rap` leaves the mock service out and
  starts `Z2UI5_CL_EMBED_COUNTRY` instead of the hello world app - the one
  patch of an example (`patch` in `BRANCHES`), because the UI5 project has
  to run locally too, where only abap2UI5's own apps exist.
  `delivery/README.md` walks through the package's three places in
  `freestyle/` and where each example places the control, linked on the
  branch; the build fails when one of them no longer has what the README
  shows (`SHOWN`). An example's README is its README on the branch as well -
  no links into the rest of this repository.
- **Never change the delivered tree in samples-embed-control.** It takes no
  pull requests except for its own docs and workflows; the app, the control,
  the build and the README (`delivery/README.md`) are changed here.
- **The guards in `build-bsp.mjs` are assumptions about abap2UI5's tools**
  (the short texts they write, the page paths bsp_rename touches). One that
  fails means the tools moved: follow them, do not loosen the guard.
- The push needs the secret `ACTION_KEY_FRONTEND_EMBED_CONTROL`, the private
  half of a deploy key with write access on samples-embed-control. Without it
  the workflow builds and checks the trees and warns that nothing was
  delivered.

## Rules for the examples' ABAP

`examples/fiori-elements-v2/abap/` is ABAP in abapGit's file format, pulled
into systems from the branch `rap`. abaplint (`npm run abaplint`,
`abaplint.jsonc`, in the `check` job) checks it against abap2UI5's main, the
CDS sources included; activation it cannot check.

- **Never hand-write the metadata sidecar of an object type nobody has
  exported from a real system.** The sidecars here follow the ones
  abap2UI5-addons/fiori-elements-integration exported (DDLS, DDLX, SRVD,
  SRVB, CLAS); a new object type - a table, a behavior definition - is
  created in a system once and committed as abapGit serializes it.
- **Only DDIC objects every target system has.** `T005T` is on every
  standard ABAP system; ABAP Cloud does not release it.
- **The mock mirrors the service.** `webapp/localService/` answers under the
  paths of the binding, with its entity set, its property names and the
  annotations of the metadata extension. A change to the CDS view, the
  metadata extension or the service definition changes the mock in the same
  commit - the app is tested against the mock only.
- **The app class is built like any abap2UI5 app** - `z2ui5_cl_ui5_view_builder`
  in the house chain layout, lifecycle checks in one IF chain - and only
  with API of the release the READMEs name (1.146.0). The abap2UI5 linter
  (`npx @abap2ui5/linter`) finds the rest.
- Object names stay within 25 characters, the budget of abap2UI5's
  namespace rename.

## Validation

```bash
npm ci
npm run lint && npm run format:check
npm run abaplint       # the examples' ABAP, against abap2UI5's main
npm run build          # ui5 build of the examples - the control lands in dist/thirdparty/
npm run pack:check     # package contents: ui5.yaml, src/ and CHANGELOG.md (npm adds README, LICENSE)
npm run consumer:check # the tarball in an app of its own, built with UI5 CLI 3 and 4
ABAP2UI5_DIR=../abap2UI5 npm run bsp   # the samples-embed-control trees, with abap2UI5's page checks
npx playwright test    # the examples; needs an abap2UI5 backend with ?z2ui5-bundle on :3000 - see README
```

All text files are LF-only, formatted with Prettier (`.prettierrc`).

## Publishing

A GitHub release `v<version>` publishes the version in
`packages/embed-control/package.json` - by trusted publishing (OIDC, no
token), after the whole CI passed on that commit (`publish.yaml` calls
`ci.yaml`). The steps are in the README; the one-time setup is in the header
of `publish.yaml`.

- **Bump the example's range with the version** once the version leaves it
  (`^0.1.0` takes 0.1.x only). Past the range npm installs the published
  package into the example instead of linking the workspace; the check job
  fails then.
- **Every release has its section in `packages/embed-control/CHANGELOG.md`**,
  and nothing stays under "Unreleased". `scripts/release-check.mjs` refuses
  the publish otherwise, and a tag that does not name the version.
- **`repository.url` names the repository the workflow runs in** - npm
  refuses the provenance otherwise. A renamed repository needs package.json
  and the Trusted Publisher entry on npmjs.com to follow.
- Running `publish.yaml` by hand is a dry run. Never publish from a
  developer machine except the one-time first version (README, "The first
  version").
