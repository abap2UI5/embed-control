# Example: abap2UI5 inside a UI5 freestyle app

A plain UI5 app that runs abap2UI5 apps in `z2ui5.embed.Container`
controls, with the control from npm:
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control).

## How the package is included

| File | |
|---|---|
| `package.json` | the package is an ordinary dependency - `npm install @abap2ui5/embed-control` |
| `ui5.yaml` | `includeDependency` takes the control into the build; the proxy to the SAP system; every UI5 library the ABAP apps use |
| `ui5-local.yaml` | the same, with the proxy to abap2UI5 running locally in Node |
| `webapp/manifest.json` | the `z2ui5.embed` resourceRoot: `./thirdparty/z2ui5/embed/` |
| `webapp/view/Main.view.xml` | `xmlns:z2ui5="z2ui5.embed"` and three `z2ui5:Container` controls |
| `webapp/controller/Main.controller.js` | starting another app = setting a model property |

No file of the abap2UI5 frontend is in the app or its build: the control
loads it from the backend (`/sap/bc/z2ui5?z2ui5-bundle`).

## Run it

It needs an abap2UI5 backend that answers `?z2ui5-bundle` - abap2UI5 1.145.0
or later.

**Against an SAP system** - `npm start`: set the system's URL as `baseUri`
in `ui5.yaml`, copy `.env.example` to `.env` and put user and password there.

```bash
npm install
npm start                        # ui5 serve, /sap/** proxied to the system in ui5.yaml
```

**Without an SAP system** - `npm run start-local` (`ui5-local.yaml`): abap2UI5
transpiled to JavaScript and run in Node, on `http://localhost:3000`. The npm
package
[`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime)
is exactly that, prebuilt - in a folder of its own, with Node 22 or later:

```bash
mkdir abap2ui5-backend && cd abap2ui5-backend
npm install @abap2ui5/node-runtime express
node --input-type=module -e 'import { serve } from "@abap2ui5/node-runtime"; await serve({ port: 3000 });'
```

```bash
npm run start-local              # ui5 serve, /sap/** proxied to localhost:3000
```

Its version is the abap2UI5 release it was built from, and it runs the apps
that come with abap2UI5, the hello world app among them.

The proxy tells the backend the dev server's host in `X-Forwarded-Host`, and
abap2UI5's CSRF check compares the browser's `Origin` with it - nothing else
is needed. An installation that switched `check_trust_forwarded_host` off in
its user exit answers 403 through the proxy.

`npm run build` writes the app to deploy into `dist/`, the control in
`dist/thirdparty/z2ui5/embed/`.

## Where it comes from

The app is developed in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as
`examples/freestyle`, next to the package - there, `npm install` at the
repository root links the package from `packages/embed-control`. Its
delivery repository
[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
carries it as this UI5 project and as the BSP `Z2UI5_HOST`, both with the
control from npm - next to the other example, the control in a custom
section of a Fiori elements app.
