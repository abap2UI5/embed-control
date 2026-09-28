# abap2UI5 embed control

Home of **[`@abap2ui5/embed-control`](packages/embed-control)**:
a UI5 custom control, published on npm, that runs an
[abap2UI5](https://github.com/abap2UI5/abap2UI5) app inside any UI5 app, plus
two example apps that show how to use it - a
**[UI5 freestyle app](examples/freestyle)** and a
**[Fiori elements app](examples/fiori-elements)** with the control in a custom
section of its object page - delivered with the package from npm to
[abap2UI5/frontend-embed-control](https://github.com/abap2UI5/frontend-embed-control).

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

How to use the package is in its [README](packages/embed-control/README.md)
(also what npm shows). This file is about working on it.

## Layout

```
packages/embed-control/        the npm package - a UI5 CLI project of type "module"
  src/                           the control and its stylesheet
examples/freestyle/            a UI5 freestyle app using the package like any consumer
examples/fiori-elements/       a Fiori elements app with the control in a custom section
test/e2e/                      Playwright tests of both examples against a live backend
scripts/                       the consumer check, the release check and the delivery build
delivery/                      the README of abap2UI5/frontend-embed-control
```

The workspaces are linked by npm: each example depends on
`@abap2ui5/embed-control@^0.1.0` exactly as an app from the registry
would, and npm resolves it to `packages/embed-control` - as long as the
package's version is inside that range. Past it, npm would quietly install
the published version into the examples instead; CI fails then, and the
ranges go up with the version.

## The frontend is not here

The control is a thin wrapper around the `z2ui5` UI5 component - the whole
abap2UI5 frontend. The package does not carry it: the control loads it at run
time from the abap2UI5 service it talks to anyway
(`GET /sap/bc/z2ui5?z2ui5-bundle`). Every abap2UI5 installation embeds its
frontend in the ABAP classes generated from
[`app/webapp`](https://github.com/abap2UI5/abap2UI5/tree/main/app/webapp), so
the frontend always has the version of the backend it runs against, and
nothing here has to follow abap2UI5's releases.

A change the control needs from the frontend (an embedded mode, a new
component setting, ...) is a pull request to abap2UI5; the control can rely
on it once the abap2UI5 installations it targets have it.

## Run the examples

They need an abap2UI5 backend that answers `?z2ui5-bundle` (1.145.0 or
later), the Fiori elements one an abap2UI5 that leaves the URL hash to the
page it is embedded in (the first release after 1.145.0 - its main has it).
Without an SAP system, run abap2UI5 transpiled to JavaScript in Node, from an
abap2UI5 checkout (the first build takes a few minutes):

```bash
git clone https://github.com/abap2UI5/abap2UI5.git && cd abap2UI5
npm ci && npm run downport && npm run auto_transpile
npm run express                  # abap2UI5 on http://localhost:3000
```

Then, here:

```bash
npm install
npm start                        # the freestyle example
npm run start:fe                 # the Fiori elements example, on its mock OData service
```

Against a real system instead: copy an example's `.env.example` to `.env`
next to it and set the system's URL and user there. The Fiori elements
example takes SAPUI5 from npm - Fiori elements for OData V4 is not part of
OpenUI5 - so its first start downloads more.

## Checks

| Command | |
|---|---|
| `npm run lint` / `npm run format:check` | ESLint and Prettier |
| `npm run build` | `ui5 build` of both examples - proves a consumer build takes the control into `dist/thirdparty/z2ui5/embed/`, the Fiori elements app's too |
| `npm run pack:check` | what `npm publish` would put into the package |
| `npm run consumer:check` | the packed package, installed into an app of its own and built with UI5 CLI 3 and 4 |
| `ABAP2UI5_DIR=../abap2UI5 npm run bsp` | the tree abap2UI5/frontend-embed-control delivers - both examples as UI5 projects, the freestyle one as BSP - into `out/standard/`, checked with abap2UI5's page invariants. With the control of this checkout; `-- --from-npm` takes it from the registry, as the delivery does |
| `npx playwright test` | both examples in a browser against the backend on port 3000 - the freestyle one on UI5 1.136 and 1.71, the Fiori elements one on SAPUI5 1.136 (`PW_CHROMIUM_PATH` for an installed Chromium) |

CI (`.github/workflows/ci.yaml`) runs all of them; its e2e job builds the
backend from abap2UI5's default branch, so it tests the pair a user gets
today: this control and the current abap2UI5. Because abap2UI5 moves on
without a pull request here, CI also runs every night.

## Publish

A published npm version can never be replaced, so a release is a deliberate
step:

1. Bump `version` in `packages/embed-control/package.json`. When the new
   version leaves the examples' range (`^0.1.0` takes 0.1.x only), raise the
   range in `examples/*/package.json` as well; `npm install` updates the
   lockfile.
2. In [`packages/embed-control/CHANGELOG.md`](packages/embed-control/CHANGELOG.md),
   move the entries under `## Unreleased` under `## <version>`.
3. Merge, then create a GitHub release with the tag `v<version>`.

`publish.yaml` runs the whole CI on that commit, e2e included, checks that
tag, version, changelog and repository agree (`scripts/release-check.mjs`),
publishes by trusted publishing - no token, with npm provenance - and then
delivers the example with the new version to
[abap2UI5/frontend-embed-control](#delivery-to-abap2ui5frontend-embed-control).
Run by hand (Actions → publish → Run workflow), it is a dry run: everything
except the publish and the delivery.

### The first version

npm sets up trusted publishing only for a package that exists, so the first
version goes out by hand, once - by a maintainer of the npm organisation
`abap2ui5`, from a clean checkout of `main` whose CI is green:

```bash
npm ci
node scripts/release-check.mjs v0.1.0   # tag, version and changelog agree
npm run pack:check                      # README, LICENSE, package.json, ui5.yaml, src/
npm login
npm publish --workspace packages/embed-control --access public
```

Then:

1. npmjs.com → `@abap2ui5/embed-control` → Settings → Trusted Publisher →
   GitHub Actions: organisation `abap2UI5`, repository `embed-control`,
   workflow `publish.yaml`, no environment. From now on `publish.yaml`
   publishes.
2. Create the GitHub release `v0.1.0` on that commit. `publish.yaml` finds
   0.1.0 on the registry and publishes nothing, but delivers the example to
   abap2UI5/frontend-embed-control - with the deploy key of the
   [delivery](#delivery-to-abap2ui5frontend-embed-control) set up by then.

## Delivery to abap2UI5/frontend-embed-control

[abap2UI5/frontend-embed-control](https://github.com/abap2UI5/frontend-embed-control)
shows the example the way an app uses the package, on its branch `standard`:

- `freestyle/` and `fiori-elements/` - the examples as UI5 projects,
  `@abap2ui5/embed-control` an npm dependency: `examples/*` without what
  only the tests here use
- `src/` - the freestyle app as the BSP `Z2UI5_HOST`, with the control where
  `ui5 build` puts it, to try the control on a real system with a plain
  abapGit pull (the Fiori elements app needs an OData service, which only
  the example's mockserver has)

Neither carries a copy of the abap2UI5 frontend, and the control in both is
the **published** package: `scripts/build-bsp.mjs --from-npm` installs the
version `packages/embed-control/package.json` names from the registry.
`frontend_deploy.yaml` builds the tree with abap2UI5's BSP tools and writes
it into frontend-embed-control's `main` as `result/standard`; the `deliver`
workflow over there makes the branch of it. It runs after every publish, on
every change to the example, the build or `delivery/README.md`, and once a
month - and delivers only from a commit whose control is the published one:
while main has changes to `src/` or `ui5.yaml` that no release carries yet,
its example may already need them, so it waits for that release.

**One-time setup:** the push needs a deploy key. Create a key pair
(`ssh-keygen -t ed25519 -N "" -f frontend-embed-control`), add the public
half to frontend-embed-control under Settings → Deploy keys with write
access, and the private half here as the Actions secret
`ACTION_KEY_FRONTEND_EMBED_CONTROL`. Until then the workflow builds and
checks the tree and warns that nothing was delivered.

## Next steps

What is still open is tracked in abap2UI5 as the
[embed-as-reuse-component](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)
backlog item: an embedded mode of the frontend that leaves page-wide things
to the host app. The first part is there - the bundle marks the component
embedded, and it leaves the URL hash alone (abap2UI5 after 1.145.0), which
is what the Fiori elements example needs. Busy indicator, title, favicon
and the `sap.m.App` root are still the frontend's; nothing in the control
has to change when they follow.

## License

MIT
