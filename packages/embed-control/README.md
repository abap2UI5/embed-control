# @abap2ui5/embed-control

Run [abap2UI5](https://github.com/abap2UI5/abap2UI5) apps inside any UI5 app.

abap2UI5 builds UI5 apps purely in ABAP: an ABAP class implementing
`z2ui5_if_app` decides the view and handles every event. This package puts
such an app into **your** UI5 app as an ordinary control, next to your own
controls:

```xml
<mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
  <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
</mvc:View>
```

The package is the control and nothing else. The abap2UI5 frontend it wraps
comes from the abap2UI5 installation the app talks to - so it always has the
version of that backend, and your app never carries a copy of it.

## Install

```bash
npm install @abap2ui5/embed-control
```

Then two entries in your app. `ui5.yaml` - so `ui5 build` copies the control
into your app (`ui5 serve` serves it anyway):

```yaml
builder:
  settings:
    includeDependency:
      - "@abap2ui5/embed-control"
```

`manifest.json` - where the control's namespace lives:

```json
"sap.ui5": {
  "resourceRoots": { "z2ui5.embed": "./thirdparty/z2ui5/embed/" }
}
```

The build puts it into `dist/thirdparty/z2ui5/embed/` and your deployment
takes it along like every other file of the app. Not under `resources/`: an
app deployed to an ABAP system answers every `<app>/resources/` path from the
UI5 library of the system. The relative resource root holds in a standalone
page and in the SAP Fiori launchpad alike.

Nothing else is deployed anywhere: the control is a plain module (no
component, no library), so no app index entry of an ABAP system is involved,
and any number of apps can carry their own copy.

## Use

In an XML view, as above, or in code:

```js
sap.ui.require(["z2ui5/embed/Container"], (Container) => {
  new Container({
    app: "ZCL_MY_ABAP2UI5_APP",
    params: { customer: "4711" },
    height: "600px",
  }).placeAt("content");
});
```

| Property | Type | Default | |
|---|---|---|---|
| `app` | string | | The ABAP class to run. Nothing starts while it is empty |
| `endpoint` | string | `/sap/bc/z2ui5` | Path of the abap2UI5 HTTP service on this server - the frontend is loaded from it, the roundtrips go to it. See [Backend](#backend) |
| `params` | object | | `{ name: "value" }`, read by the app with `client->get( )-t_comp_params` |
| `width` | CSSSize | `100%` | |
| `height` | CSSSize | `100%` | The app fills its container - give it a height, or a parent that has one |

| Event | Parameters | |
|---|---|---|
| `componentCreated` | `component` | The app's component exists (the first roundtrip is under way) |
| `componentFailed` | `reason` | It could not be created - the endpoint is not a path on this server, the frontend could not be loaded, or the component failed |

Every control is its **own abap2UI5 session** - two controls with the same
class do not share state. Changing `app`, `endpoint` or `params` ends the
running session and starts a new one; destroying the control ends it too.
All three are ordinary properties, so they can be bound to your model.

## Backend

The app runs on an ABAP system with
[abap2UI5 installed](https://abap2ui5.github.io/docs/configuration/installation.html)
and its HTTP service (by default `/sap/bc/z2ui5`) active. The control needs
**abap2UI5 1.145.0 or later**, whose service answers `?z2ui5-bundle`:

```
GET  /sap/bc/z2ui5?z2ui5-bundle   the frontend as one script - loaded once per page
POST /sap/bc/z2ui5                the roundtrips, one session per control
GET  /sap/bc/z2ui5                abap2UI5's own page, unchanged
```

An older abap2UI5 answers with its page; the control then fires
`componentFailed` ("no abap2UI5 frontend at ...") instead of starting.

**The page and the service have to share an origin.** abap2UI5 rejects a
POST whose `Origin` names another host than its own (its CSRF defense), and
the control loads the frontend only from a path on this server - an
`endpoint` with a scheme or a host is refused, because what comes back is
code that runs in your page. So the browser reaches the service through your
app's origin:

- **deployed** - the app is served from the same system (BSP, launchpad), or
  an approuter / destination routes `/sap/bc/z2ui5` to it
- **`ui5 serve`** - a proxy middleware forwards `/sap` to the system. The
  proxy rewrites `Host` but passes the browser's `Origin` on, so it also has
  to drop `Origin` and `Referer`; the
  [example app](https://github.com/abap2UI5/reuse-custom-control/tree/main/examples/host-app)
  shows both pieces

**Content-Security-Policy:** the frontend is a `<script src>` of your own
origin, and every module in it is a function - nothing is evaluated from a
string. A host with `script-src 'self'` and no `'unsafe-eval'` needs nothing
extra (UI5 1.71 itself still needs `'unsafe-eval'`).

## UI5 libraries

The embedded app loads whatever UI5 library its ABAP view names. With the UI5
CLI serving the framework (`framework:` in `ui5.yaml`), list every library
your ABAP apps use there, not only the ones your own views use - the hello
world app, for instance, needs `sap.ui.layout`.

## Supported UI5 versions

The same floor as abap2UI5: OpenUI5 / SAPUI5 **1.71** and later. The example
app is tested on 1.71 and 1.136.

Your app's tooling: UI5 CLI 3 or 4 - the package's `ui5.yaml` is
specVersion 3.0, and every release is built with both.

## Known limitations

- **One frontend per page**: the first control that starts decides which
  endpoint the frontend comes from; every control still sends its roundtrips
  to its own endpoint.
- abap2UI5 was built to own the whole page. Until its embedded mode exists
  ([backlog item](https://github.com/abap2UI5/abap2UI5/blob/main/backlog/items/embed-as-reuse-component.md)),
  an embedded app still shows the global busy indicator during a roundtrip,
  may set the document title and favicon when the ABAP app asks for it, takes
  part in hash routing when the ABAP app opts into it, and renders its root
  as `sap.m.App`.

## What is inside

| Path | |
|---|---|
| `src/Container.js` | The control, `z2ui5.embed.Container` |
| `src/Container.css` | Its stylesheet, loaded by the control |
| `ui5.yaml` | Serves `src/` under `/thirdparty/z2ui5/embed/` |

## License

MIT
