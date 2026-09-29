# Example: abap2UI5 inside a UI5 freestyle app

A plain UI5 app that runs abap2UI5 apps in `z2ui5.embed.Container`
controls, with the control from npm:
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control).

## How the package is included

| File | |
|---|---|
| `package.json` | the package is an ordinary dependency - `npm install @abap2ui5/embed-control` |
| `ui5.yaml` | `includeDependency` takes the control into the build; the proxy to the backend; every UI5 library the ABAP apps use |
| `webapp/manifest.json` | the `z2ui5.embed` resourceRoot: `./thirdparty/z2ui5/embed/` |
| `webapp/view/Main.view.xml` | `xmlns:z2ui5="z2ui5.embed"` and three `z2ui5:Container` controls |
| `webapp/controller/Main.controller.js` | starting another app = setting a model property |
| `lib/sameOrigin.js` | dev server only: why a proxy has to drop `Origin` for abap2UI5 |

No file of the abap2UI5 frontend is in the app or its build: the control
loads it from the backend (`/sap/bc/z2ui5?z2ui5-bundle`).

## Run it

It needs an abap2UI5 backend that answers `?z2ui5-bundle` - abap2UI5 1.145.0
or later.

```bash
npm install
npm start                        # ui5 serve, /sap/** proxied to the backend
```

The proxy goes to `http://localhost:3000` by default: abap2UI5 transpiled to
JavaScript and run in Node, no SAP system needed. The npm package
[`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime)
is exactly that, prebuilt - in a folder of its own, with Node 22 or later:

```bash
mkdir abap2ui5-backend && cd abap2ui5-backend
npm install @abap2ui5/node-runtime express
node --input-type=module -e 'import { serve } from "@abap2ui5/node-runtime"; await serve({ port: 3000 });'
```

Its version is the abap2UI5 release it was built from, and it runs the apps
that come with abap2UI5, the hello world app among them.

Against a real system instead: copy `.env.example` to `.env` and set the
system's URL and user there.

`npm run build` writes the app to deploy into `dist/`, the control in
`dist/thirdparty/z2ui5/embed/`.

## Where it comes from

The app is developed in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as
`examples/freestyle`, next to the package - there, `npm install` at the
repository root links the package from `packages/embed-control`. Its
delivery repository
[abap2UI5/frontend-embed-control](https://github.com/abap2UI5/frontend-embed-control)
carries it as this UI5 project and as the BSP `Z2UI5_HOST`, both with the
control from npm - next to the other example, the control in a custom
section of a Fiori elements app.
