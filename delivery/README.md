# abap2UI5 frontend-embed-control

abap2UI5 apps inside any UI5 app, with the npm package
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control):
the examples of
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control), ready to
read, run and install. A `z2ui5.embed.Container` control runs an abap2UI5
app - an ABAP class implementing `z2ui5_if_app` - in its own backend
session, wherever the host app places it:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

The branch `standard` has two host apps:

| Path | |
|---|---|
| [`freestyle/`](https://github.com/abap2UI5/frontend-embed-control/tree/standard/freestyle) | a UI5 freestyle app with three containers - the package is an npm dependency like any other |
| [`fiori-elements/`](https://github.com/abap2UI5/frontend-embed-control/tree/standard/fiori-elements) | a Fiori elements app, list report and object page, with the control in a **custom section** of the object page - the abap2UI5 app gets the key of the object on the page |
| [`src/`](https://github.com/abap2UI5/frontend-embed-control/tree/standard/src) | the freestyle app as the BSP `Z2UI5_HOST`, with the control from npm where `ui5 build` puts it - to try it on a system with a plain abapGit pull |
| `VERSION` | the commit of abap2UI5/embed-control and the version of `@abap2ui5/embed-control` the branch is built from |

None of them carries a copy of the abap2UI5 frontend: the control loads it
from the abap2UI5 installation it talks to, so the frontend always has the
version of that backend.

## Include the package in your UI5 app

Four steps - the first three are the same in every app, the fourth places
the control.

**1. Install it** -
[`freestyle/package.json`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/package.json):

```bash
npm install @abap2ui5/embed-control
```

**2. Take it into the build** -
[`freestyle/ui5.yaml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/ui5.yaml).
`ui5 serve` serves the control anyway; `ui5 build` copies it into
`dist/thirdparty/z2ui5/embed/` only for a dependency named here:

```yaml
builder:
  settings:
    includeDependency:
      - "@abap2ui5/embed-control"
```

**3. Register its namespace** -
[`freestyle/webapp/manifest.json`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/webapp/manifest.json):

```json
"sap.ui5": {
  "resourceRoots": { "z2ui5.embed": "./thirdparty/z2ui5/embed/" }
}
```

`thirdparty/`, not `resources/`: an app deployed to an ABAP system answers
every `<app>/resources/` path from the UI5 of the system.

**4. Place the control** - in a view of your own,
[`freestyle/webapp/view/Main.view.xml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/webapp/view/Main.view.xml):

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

or, in a Fiori elements app, in a custom section - [below](#in-a-fiori-elements-app-a-custom-section).

That is all a deployed app needs, as long as the page and abap2UI5 share an
origin: the app served from the same system (BSP, launchpad), or an
approuter that routes `/sap/bc/z2ui5` to it. `ui5 serve` against a remote
system needs one more thing: a proxy for `/sap` that drops the browser's
`Origin`, or abap2UI5's CSRF check rejects the roundtrips -
[`freestyle/ui5.yaml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/ui5.yaml)
and
[`freestyle/lib/sameOrigin.js`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/lib/sameOrigin.js)
show both pieces.

Properties, events, the backend the control needs and the UI5 versions it
supports are in the
[package README](https://www.npmjs.com/package/@abap2ui5/embed-control).

## In a Fiori elements app: a custom section

The object page of a Fiori elements app takes content of its own as a
custom section - an entry in the manifest and a fragment. There the
control runs an abap2UI5 app for the object on the page:
[`fiori-elements/webapp/manifest.json`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/fiori-elements/webapp/manifest.json),
in the object page's settings:

```json
"content": {
  "body": {
    "sections": {
      "abap2UI5": {
        "template": "demo.fe.ext.Abap2UI5Section",
        "title": "abap2UI5",
        "position": { "placement": "After", "anchor": "General" }
      }
    }
  }
}
```

[`fiori-elements/webapp/ext/Abap2UI5Section.fragment.xml`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/fiori-elements/webapp/ext/Abap2UI5Section.fragment.xml),
bound to the object - `ID` is the key of the customer on the page, and
[`ext/Abap2UI5Section.js`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/fiori-elements/webapp/ext/Abap2UI5Section.js)
turns it into the class to run and its parameters:

```xml
<z2ui5:Container
    core:require="{ Section: 'demo/fe/ext/Abap2UI5Section' }"
    app="{ path: 'ID', formatter: 'Section.app' }"
    params="{ path: 'ID', targetType: 'any', formatter: 'Section.params' }"
    height="420px"/>
```

The ABAP class reads the key with
`client->get( )-t_comp_params` - a snippet, and why `targetType: 'any'` is
there, are in
[`fiori-elements/README.md`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/fiori-elements/README.md).
Another customer ends the running abap2UI5 session and starts a new one
with its key.

A Fiori elements app routes by the URL hash, so the abap2UI5 behind it has
to leave the hash to the page it is embedded in: **the first abap2UI5
release after 1.145.0** does. An older one clears the hash after every
roundtrip, and the object page goes back to the list.

## Run the examples

```bash
git clone --branch standard https://github.com/abap2UI5/frontend-embed-control.git
cd frontend-embed-control/freestyle      # or fiori-elements
npm install
npm start                        # ui5 serve, /sap/** proxied to the backend
```

The proxy goes to `http://localhost:3000` by default - abap2UI5 transpiled
to JavaScript and run in Node, no SAP system needed. For a real system, copy
`.env.example` to `.env` and set the system's URL and user there. The
READMEs of
[`freestyle/`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/freestyle/README.md)
and
[`fiori-elements/`](https://github.com/abap2UI5/frontend-embed-control/blob/standard/fiori-elements/README.md)
have both. The Fiori elements app answers its own OData service from mock
data, and takes SAPUI5 from npm - Fiori elements for OData V4 is not part of
OpenUI5. `npm run build` writes an app to deploy into `dist/`.

## Install the BSP

1. [abap2UI5](https://github.com/abap2UI5/abap2UI5) **1.145.0 or later**,
   with its HTTP service `/sap/bc/z2ui5` active - the node the `standard`
   branch of [abap2UI5/frontend](https://github.com/abap2UI5/frontend)
   brings, for example.
2. Pull the branch `standard` of this repository with abapGit into a new
   package. It creates the BSP `Z2UI5_HOST` with the ICF nodes
   `/sap/bc/ui5_ui5/sap/z2ui5_host` and `/sap/bc/bsp/sap/z2ui5_host` -
   nothing else, and nothing shared with the `Z2UI5` BSP of
   abap2UI5/frontend. abapGit reads `src/` only; `freestyle/` and
   `fiori-elements/` stay out of the system.
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

The Fiori elements app has no BSP here: it needs its OData service, which
the example mocks and a system does not have - an app of your own brings
its RAP service.

## Known limitations

- One frontend per page: the first control that starts decides where it
  comes from; every control still sends its roundtrips to its own endpoint.
- Embedding is still page-wide in places - busy indicator, title, the
  `sap.m.App` root - until abap2UI5's embedded mode covers them
  ([backlog item](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md));
  the URL hash is the host's from the release after 1.145.0 on.
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
| the examples, the build, this README | [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) - `examples/freestyle`, `examples/fiori-elements`, `scripts/build-bsp.mjs`, `delivery/README.md` |
| the control | [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) - `packages/embed-control`, published to npm as `@abap2ui5/embed-control` |
| the abap2UI5 frontend and `?z2ui5-bundle`, the BSP tooling | [abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5) - `app/webapp`, `z2ui5_cl_ui5_http_handler`, `tools/` |
| `result/` on `main`, the branch | machine-written - a hand edit is overwritten by the next delivery |
| this repository's docs and workflows | here, as a maintenance pull request |

## Issues

For bug reports or feature requests, open an issue in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control/issues)
(the apps, the control) or
[abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5/issues) (the
frontend, the backend).
