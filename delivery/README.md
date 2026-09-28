# abap2UI5 frontend-embed-control

abap2UI5 apps inside any UI5 app, with the npm package
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control):
the example app of
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control), ready to
read, run and install. A plain UI5 app places `z2ui5.embed.Container`
controls, and each of them runs an abap2UI5 app - an ABAP class implementing
`z2ui5_if_app` - in its own backend session:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

The branch `standard` has the app twice:

| Path | |
|---|---|
| [`app/`](https://github.com/abap2UI5/frontend-embed-control/tree/standard/app) | the example as a UI5 project - the package is an npm dependency like any other. This is the part to copy into your own app |
| [`src/`](https://github.com/abap2UI5/frontend-embed-control/tree/standard/src) | the same app as the BSP `Z2UI5_HOST`, with the control from npm where `ui5 build` puts it - to try it on a system with a plain abapGit pull |
| `VERSION` | the commit of abap2UI5/embed-control and the version of `@abap2ui5/embed-control` the branch is built from |

Neither carries a copy of the abap2UI5 frontend: the control loads it from
the abap2UI5 installation it talks to, so the frontend always has the version
of that backend.

## Include the package in your UI5 app

Four steps - each of them is a file of `app/`.

**1. Install it** -
[`app/package.json`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/package.json):

```bash
npm install @abap2ui5/embed-control
```

**2. Take it into the build** -
[`app/ui5.yaml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/ui5.yaml).
`ui5 serve` serves the control anyway; `ui5 build` copies it into
`dist/thirdparty/z2ui5/embed/` only for a dependency named here:

```yaml
builder:
  settings:
    includeDependency:
      - "@abap2ui5/embed-control"
```

**3. Register its namespace** -
[`app/webapp/manifest.json`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/webapp/manifest.json):

```json
"sap.ui5": {
  "resourceRoots": { "z2ui5.embed": "./thirdparty/z2ui5/embed/" }
}
```

`thirdparty/`, not `resources/`: an app deployed to an ABAP system answers
every `<app>/resources/` path from the UI5 of the system.

**4. Place the control** -
[`app/webapp/view/Main.view.xml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/webapp/view/Main.view.xml):

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

That is all a deployed app needs, as long as the page and abap2UI5 share an
origin: the app served from the same system (BSP, launchpad), or an
approuter that routes `/sap/bc/z2ui5` to it. `ui5 serve` against a remote
system needs one more thing: a proxy for `/sap` that drops the browser's
`Origin`, or abap2UI5's CSRF check rejects the roundtrips -
[`app/ui5.yaml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/ui5.yaml)
and
[`app/lib/sameOrigin.js`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/lib/sameOrigin.js)
show both pieces.

Properties, events, the backend the control needs and the UI5 versions it
supports are in the
[package README](https://www.npmjs.com/package/@abap2ui5/embed-control).

## Run the UI5 project

```bash
git clone --branch standard https://github.com/abap2UI5/frontend-embed-control.git
cd frontend-embed-control/app
npm install
npm start                        # ui5 serve, /sap/** proxied to the backend
```

The proxy goes to `http://localhost:3000` by default - abap2UI5 transpiled
to JavaScript and run in Node, no SAP system needed. For a real system, copy
`.env.example` to `.env` and set the system's URL and user there.
[`app/README.md`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/app/README.md)
has both. `npm run build` writes the app to deploy into `dist/`.

## Install the BSP

1. [abap2UI5](https://github.com/abap2UI5/abap2UI5) **1.145.0 or later**,
   with its HTTP service `/sap/bc/z2ui5` active - the node the `standard`
   branch of [abap2UI5/frontend](https://github.com/abap2UI5/frontend)
   brings, for example.
2. Pull the branch `standard` of this repository with abapGit into a new
   package. It creates the BSP `Z2UI5_HOST` with the ICF nodes
   `/sap/bc/ui5_ui5/sap/z2ui5_host` and `/sap/bc/bsp/sap/z2ui5_host` -
   nothing else, and nothing shared with the `Z2UI5` BSP of
   abap2UI5/frontend. abapGit reads `src/` only; `app/` stays out of the
   system.
3. Activate the two ICF nodes in `SICF`.
4. Open `/sap/bc/ui5_ui5/sap/z2ui5_host/index.html`.

What to look for: three hello world apps. In the browser's network tab,
`thirdparty/z2ui5/embed/Container.js` and `.css` of the BSP, one
`GET /sap/bc/z2ui5?z2ui5-bundle` and no other file of the frontend; every
`POST` goes to `/sap/bc/z2ui5`. An abap2UI5 older than 1.145.0 answers the
bundle request with its page - the control then says so ("abap2UI5 could not
start") instead of starting.

```
BSP Z2UI5_HOST                             the host app
  ├─ thirdparty/z2ui5/embed/               the control, from npm
  └─ z2ui5.embed.Container
       ├─ GET  /sap/bc/z2ui5?z2ui5-bundle   the frontend as a script, once per page
       └─ POST /sap/bc/z2ui5                the roundtrips, one session per control
```

## Known limitations

- One frontend per page: the first control that starts decides where it
  comes from; every control still sends its roundtrips to its own endpoint.
- Embedding is still page-wide in places - busy indicator, title, hash
  routing, the `sap.m.App` root - until abap2UI5 has its embedded mode
  ([backlog item](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)).
- Custom controls from `Z2UI5_CCI`/`Z2UI5_CCC`: the bundle hands over their
  paths like abap2UI5's own page does; not tried yet.
- The host app's own `Component-preload.js` does not exist in a BSP pulled
  with abapGit (a page name may not contain a hyphen): UI5 answers the 404 by
  loading the host's few files one by one. An app deployed from its
  `ui5 build` output has it.

## Where to change what

> **This repository is generated.** The branch is built in
> [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) by
> `scripts/build-bsp.mjs`, with the control installed from npm, and delivered
> by its `frontend_deploy` workflow: first as `result/standard` into one
> commit on `main`, then fanned out by the `deliver` workflow here, so the
> branch is always one commit ahead of `main`. A new version of the package
> arrives here with its release.

| Content | Owned by |
|---|---|
| the example app, the build, this README | [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) - `examples/host-app`, `scripts/build-bsp.mjs`, `delivery/README.md` |
| the control | [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) - `packages/embed-control`, published to npm as `@abap2ui5/embed-control` |
| the abap2UI5 frontend and `?z2ui5-bundle`, the BSP tooling | [abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5) - `app/webapp`, `z2ui5_cl_ui5_http_handler`, `tools/` |
| `result/` on `main`, the branch | machine-written - a hand edit is overwritten by the next delivery |
| this repository's docs and workflows | here, as a maintenance pull request |

## Issues

For bug reports or feature requests, open an issue in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control/issues)
(the app, the control) or
[abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5/issues) (the
frontend, the backend).
