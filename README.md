# abap2UI5 embed control

Home of **[`@abap2ui5/embed-control`](packages/embed-control)**:
a UI5 custom control, published on npm, that runs an
[abap2UI5](https://github.com/abap2UI5/abap2UI5) app inside any UI5 app, plus
an **[example app](examples/host-app)** that shows how to use it.

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
examples/host-app/             a plain UI5 app using the package like any consumer
test/e2e/                      Playwright tests of the example against a live backend
scripts/                       the consumer check and the release check - see Checks and Publish
```

The two workspaces are linked by npm: the example depends on
`@abap2ui5/embed-control@^0.1.0` exactly as an app from the registry
would, and npm resolves it to `packages/embed-control` - as long as the
package's version is inside that range. Past it, npm would quietly install
the published version into the example instead; CI fails then, and the
range goes up with the version.

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

## Run the example

It needs an abap2UI5 backend that answers `?z2ui5-bundle` (1.145.0 or
later). Without an SAP system, run abap2UI5 transpiled to JavaScript in Node,
from an abap2UI5 checkout (the first build takes a few minutes):

```bash
git clone https://github.com/abap2UI5/abap2UI5.git && cd abap2UI5
npm ci && npm run downport && npm run auto_transpile
npm run express                  # abap2UI5 on http://localhost:3000
```

Then, here:

```bash
npm install
npm start                        # ui5 serve, opens the example
```

Against a real system instead: copy `examples/host-app/.env.example` to
`.env` and set the system's URL and user there.

## Checks

| Command | |
|---|---|
| `npm run lint` / `npm run format:check` | ESLint and Prettier |
| `npm run build` | `ui5 build` of the example - proves a consumer build takes the control into `dist/thirdparty/z2ui5/embed/` |
| `npm run pack:check` | what `npm publish` would put into the package |
| `npm run consumer:check` | the packed package, installed into an app of its own and built with UI5 CLI 3 and 4 |
| `npx playwright test` | the example in a browser on UI5 1.136 and 1.71, against the backend on port 3000 (`PW_CHROMIUM_PATH` for an installed Chromium) |

CI (`.github/workflows/ci.yaml`) runs all of them; its e2e job builds the
backend from abap2UI5's default branch, so it tests the pair a user gets
today: this control and the current abap2UI5. Because abap2UI5 moves on
without a pull request here, CI also runs every night.

## Publish

A published npm version can never be replaced, so a release is a deliberate
step:

1. Bump `version` in `packages/embed-control/package.json`. When the new
   version leaves the example's range (`^0.1.0` takes 0.1.x only), raise the
   range in `examples/host-app/package.json` as well; `npm install` updates
   the lockfile.
2. In [`packages/embed-control/CHANGELOG.md`](packages/embed-control/CHANGELOG.md),
   move the entries under `## Unreleased` under `## <version>`.
3. Merge, then create a GitHub release with the tag `v<version>`.

`publish.yaml` runs the whole CI on that commit, e2e included, checks that
tag, version, changelog and repository agree (`scripts/release-check.mjs`)
and publishes by trusted publishing - no token, with npm provenance. Run by
hand (Actions → publish → Run workflow), it is a dry run: everything except
the publish.

**The first version is published by hand**, because npm sets up trusted
publishing only for a package that exists. A maintainer of the npm
organisation `abap2ui5` runs `npm login` and
`npm publish --workspace packages/embed-control --access public`, then points
npmjs.com → `@abap2ui5/embed-control` → Settings → Trusted Publisher at this
repository and `publish.yaml`. A release of a version that is on the registry
already publishes nothing, so the GitHub release for that first version can
follow as usual.

## Next steps

What is still open is tracked in abap2UI5 as the
[embed-as-reuse-component](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)
backlog item: an embedded mode of the frontend that leaves page-wide things
(busy indicator, title, favicon, hash, `sap.m.App` root) to the host app. The
control forwards it once abap2UI5 has it.

## License

MIT
