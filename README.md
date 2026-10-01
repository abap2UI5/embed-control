# abap2UI5 embed control

Home of **[`@abap2ui5/embed-control`](packages/embed-control)**:
a UI5 custom control, published on npm, that runs an
[abap2UI5](https://github.com/abap2UI5/abap2UI5) app inside any UI5 app. The
examples that show how to use it - a UI5 freestyle app, Fiori elements apps
for OData V4 and V2 and a UI Integration Card for SAP Build Work Zone - are
in
**[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)**,
where they take the package from npm like any app.

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
scripts/                       the consumer check and the release check
```

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

## The examples

[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
has them, with their Playwright tests and the branches that deliver them
(`standard`, `rap`) - how to run them is in its README. They take the
control from npm; CI here runs them with the control of the commit instead
([below](#checks)), so a change to the control is tested against them
before it is published. An example that needs a change to the control
follows over there with the release that brings it.

## Checks

| Command | |
|---|---|
| `npm run lint` / `npm run format:check` | ESLint and Prettier |
| `npm run pack:check` | what `npm publish` would put into the package |
| `npm run consumer:check` | the packed package, installed into an app of its own and built with UI5 CLI 3 and 4 |

CI (`.github/workflows/ci.yaml`) runs them, and the examples: it checks out
`main` of abap2UI5/samples-embed-control, unpacks the package of the commit
into its `node_modules/@abap2ui5/embed-control`, builds its branches
(`npm run bsp`, with abap2UI5's BSP tools) and runs its Playwright tests -
the freestyle example on UI5 1.136 and 1.71, the Fiori elements ones on
SAPUI5 1.136, the card on OpenUI5 1.136 - against an abap2UI5 backend built
from abap2UI5's default branch, and against 1.145.0, the backend floor. So
it tests the pair a user gets today: this control and the current abap2UI5.
Because abap2UI5 and the examples move on without a pull request here, CI
also runs every night.

To run the examples with a local change to the control, in a checkout of
samples-embed-control next to this one:

```bash
npm ci
rm -rf node_modules/@abap2ui5/embed-control
cp -r ../embed-control/packages/embed-control node_modules/@abap2ui5/embed-control
npx playwright test                # with an abap2UI5 backend on port 3000 - see its README
```

## Publish

A published npm version can never be replaced, so a release is a deliberate
step:

1. Bump `version` in `packages/embed-control/package.json`.
2. In [`packages/embed-control/CHANGELOG.md`](packages/embed-control/CHANGELOG.md),
   move the entries under `## Unreleased` under `## <version>`.
3. Merge, then create a GitHub release with the tag `v<version>`.

`publish.yaml` runs the whole CI on that commit, e2e included, checks that
tag, version, changelog and repository agree (`scripts/release-check.mjs`),
and publishes by trusted publishing - no token, with npm provenance. Run by
hand (Actions → publish → Run workflow), it is a dry run: everything except
the publish.

The examples in abap2UI5/samples-embed-control take the new version with a
bump of their lockfile - dependabot's, weekly, or one by hand right after
the release (`npm install @abap2ui5/embed-control@<version> --workspaces`
there, which also raises their ranges when the version leaves them); the
merge delivers it to their branches.

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
   0.1.0 on the registry and publishes nothing.

## Next steps

What is still open is tracked in abap2UI5 as the
[embed-as-reuse-component](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)
backlog item: an embedded mode of the frontend that leaves page-wide things
to the host app. The first part is there - the bundle marks the component
embedded, and it leaves the URL hash alone (abap2UI5 1.146.0), which
is what the Fiori elements examples need. Busy indicator, title, favicon
and the `sap.m.App` root are still the frontend's; nothing in the control
has to change when they follow.

## License

MIT
