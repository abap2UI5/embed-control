# abap2UI5 frontend-cc

abap2UI5 inside a UI5 app, ready to install: the example app of
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as the
BSP `Z2UI5_HOST`. A plain UI5 app places `z2ui5.embed.Container` controls,
and each of them runs an abap2UI5 app - an ABAP class implementing
`z2ui5_if_app` - in its own backend session:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

It is here to try the control on a real system with a plain abapGit pull. A
real app takes the control from npm (`@abap2ui5/embed-control`) and deploys
the output of its `ui5 build` with its usual tools.

The branch carries the host app and the control - **no copy of the abap2UI5
frontend**. The control loads the frontend from abap2UI5's own service node,
the one it talks to anyway, so the frontend always has the version of the
abap2UI5 it runs against:

```
BSP Z2UI5_HOST                             the host app
  ├─ thirdparty/z2ui5/embed/               the control, as the npm package has it
  └─ z2ui5.embed.Container
       ├─ GET  /sap/bc/z2ui5?z2ui5-bundle   the frontend as a script, once per page
       └─ POST /sap/bc/z2ui5                the roundtrips, one session per control
```

## Install

1. [abap2UI5](https://github.com/abap2UI5/abap2UI5) **1.145.0 or later**,
   with its HTTP service `/sap/bc/z2ui5` active - the node the `standard`
   branch of [abap2UI5/frontend](https://github.com/abap2UI5/frontend)
   brings, for example.
2. Pull the branch `standard` of this repository with abapGit into a new
   package. It creates the BSP `Z2UI5_HOST` with the ICF nodes
   `/sap/bc/ui5_ui5/sap/z2ui5_host` and `/sap/bc/bsp/sap/z2ui5_host` -
   nothing else, and nothing shared with the `Z2UI5` BSP of
   abap2UI5/frontend.
3. Activate the two ICF nodes in `SICF`.
4. Open `/sap/bc/ui5_ui5/sap/z2ui5_host/index.html`.

What to look for: three hello world apps. In the browser's network tab,
`thirdparty/z2ui5/embed/Container.js` and `.css` of the BSP, one
`GET /sap/bc/z2ui5?z2ui5-bundle` and no other file of the frontend; every
`POST` goes to `/sap/bc/z2ui5`. An abap2UI5 older than 1.145.0 answers the
bundle request with its page - the control then says so ("abap2UI5 could not
start") instead of starting.

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
> `scripts/build-bsp.mjs` and delivered by its `frontend_cc_deploy` workflow:
> first as `result/standard` into one commit on `main`, then fanned out by
> the `deliver` workflow here, so the branch is always one commit ahead of
> `main`.

| Content | Owned by |
|---|---|
| the host app, the control, the build, this README | [abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) - `examples/host-app`, `packages/embed-control/src`, `scripts/build-bsp.mjs`, `delivery/README.md` |
| the abap2UI5 frontend and `?z2ui5-bundle`, the BSP tooling | [abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5) - `app/webapp`, `z2ui5_cl_ui5_http_handler`, `tools/` |
| `result/` on `main`, the branch | machine-written - a hand edit is overwritten by the next delivery |
| this repository's docs and workflows | here, as a maintenance pull request |

## Issues

For bug reports or feature requests, open an issue in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control/issues)
(the app, the control) or
[abap2UI5/abap2UI5](https://github.com/abap2UI5/abap2UI5/issues) (the
frontend, the backend).
