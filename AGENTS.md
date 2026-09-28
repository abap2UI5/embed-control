# AGENTS.md — AI Assistant Guide for the abap2UI5 embed control

> This file follows the cross-tool AGENTS.md convention and is the single
> agent instruction file of this repository. `CLAUDE.md` next to it is a
> pointer at this file, nothing more.

## What this repository is

The source of the npm package **`@abap2ui5/embed-control`**
(`packages/embed-control`): the UI5 custom control
`z2ui5.embed.Container`, which runs an abap2UI5 app - an ABAP class
implementing `z2ui5_if_app` - inside any UI5 app. Next to it an example app
(`examples/host-app`) that consumes the package the way an app from the
registry would, and Playwright tests (`test/e2e`) that drive that example
against a live abap2UI5 backend.

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
| `examples/host-app/` | The example: a plain UI5 app, `includeDependency` and the `z2ui5.embed` resourceRoot, `ui5-middleware-simpleproxy` to the backend, `lib/sameOrigin.js` for the backend's CSRF check |
| `test/e2e/` | Playwright tests of the example |
| `scripts/consumer-check.mjs` | The packed package in an app of its own, built with UI5 CLI 3 and 4 |
| `scripts/release-check.mjs` | The gate before `npm publish`: tag, version, changelog and repository agree |
| `scripts/build-bsp.mjs` | The BSP abap2UI5/frontend-cc delivers - the example app with the control, built with abap2UI5's tools into `out/standard/` |
| `delivery/README.md` | The README of abap2UI5/frontend-cc, on its `main` and its branch |
| `.github/workflows/` | `ci.yaml` (checks, consumer builds, the BSP, e2e against abap2UI5's default branch - on every pull request, every night, and before every publish), `publish.yaml` (npm, on a GitHub release), `frontend_cc_deploy.yaml` (the BSP into abap2UI5/frontend-cc, on every change to what it is made of) |

## Rules for `src/`

- **UI5 1.71 is the floor**, as in abap2UI5. Use no module, class, property or
  enum newer than 1.71, and no `sap/ui/core/Lib` / `sap/ui/core/Element`
  static APIs. What the control uses today and since when:
  `sap/ui/dom/includeStylesheet` (1.58), `ComponentContainer#lifecycle`
  (1.56), renderer `apiVersion: 2` (1.67).
  The e2e tests run the example on 1.71 too (`examples/host-app/ui5-1.71.yaml`,
  the `ui5-1.71` Playwright project) - a change to `src/` is done when both
  projects pass.
- **Keep the control thin.** It picks the class, the endpoint and the size;
  everything the app does comes from the backend through the component. It
  configures the component only through what the frontend reads itself -
  `componentData` (abap2UI5 `Component.init`), filled from the bundle's
  `z2ui5/embed` module plus `startupParameters` and `endpoint` - never by
  patching the manifest or reaching into the component's state.
- **The bundle is code - load it only from a path on this server.** Keep the
  `SAME_ORIGIN_PATH` check: an `endpoint` with a scheme, `//host` or a
  backslash is refused before anything is requested. Load it with a
  `<script src>`, never with `eval`, `new Function` or `fetch` + inject.
- **One frontend per page, one component per control, one backend session per
  component.** The bundle is loaded once; a change of `app`, `endpoint` or
  `params` replaces the component; nothing is patched into a running one.
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
  `?z2ui5-bundle`. The package README names it; raise it there when the
  control starts to rely on something newer.

## Delivery: abap2UI5/frontend-cc

[abap2UI5/frontend-cc](https://github.com/abap2UI5/frontend-cc) delivers the
example app as the BSP `Z2UI5_HOST` (its branch `standard`), to try the
control on a real system with a plain abapGit pull. Everything in it comes
from here: `scripts/build-bsp.mjs` builds the tree from
`examples/host-app/webapp` and the control in `thirdparty/z2ui5/embed/`, with
abap2UI5's BSP tools (`ABAP2UI5_DIR`, abap2UI5's main in CI), and
`frontend_cc_deploy.yaml` writes it into frontend-cc's `main` as
`result/standard`, where frontend-cc's `deliver` workflow makes the branch.

- **No frontend in the BSP.** The control loads it from the system, as in
  any app - the branch is the example app and the control, nothing else.
- **Never change the delivered tree in frontend-cc.** It takes no pull
  requests except for its own docs and workflows; the app, the control, the
  build and the README (`delivery/README.md`) are changed here.
- **The guards in `build-bsp.mjs` are assumptions about abap2UI5's tools**
  (the short texts they write, the page paths bsp_rename touches). One that
  fails means the tools moved: follow them, do not loosen the guard.
- The push needs the secret `ACTION_KEY_FRONTEND_CC`, the private half of a
  deploy key with write access on frontend-cc. Without it the workflow builds
  and checks the tree and warns that nothing was delivered.

## Validation

```bash
npm ci
npm run lint && npm run format:check
npm run build          # ui5 build of the example - the control lands in dist/thirdparty/
npm run pack:check     # package contents: ui5.yaml and src/ only
npm run consumer:check # the tarball in an app of its own, built with UI5 CLI 3 and 4
ABAP2UI5_DIR=../abap2UI5 npm run bsp   # the frontend-cc BSP, with abap2UI5's page checks
npx playwright test    # needs an abap2UI5 backend with ?z2ui5-bundle on :3000 - see README
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
  developer machine except the one-time first version.
