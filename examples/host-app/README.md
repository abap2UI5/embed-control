# Example: abap2UI5 inside a UI5 app

A plain UI5 app that embeds abap2UI5 apps with
[`@abap2ui5/embed-control`](../../packages/embed-control).
How to run it is in the [repository README](../../README.md#run-the-example).

What to look at:

| File | |
|---|---|
| `package.json` | the package is an ordinary dependency |
| `ui5.yaml` | `includeDependency` takes the control into the build, the proxy to the backend, and every UI5 library the ABAP apps use |
| `webapp/manifest.json` | the `z2ui5.embed` resourceRoot: `./thirdparty/z2ui5/embed/` |
| `webapp/view/Main.view.xml` | `xmlns:z2ui5="z2ui5.embed"` and three `z2ui5:Container` controls |
| `webapp/controller/Main.controller.js` | starting another app = setting a model property |
| `lib/sameOrigin.js` | why a dev proxy has to drop `Origin` for abap2UI5 |

No file of the abap2UI5 frontend is in the app or its build: the control
loads it from the backend (`/sap/bc/z2ui5?z2ui5-bundle`).
