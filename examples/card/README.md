# Example: abap2UI5 in a UI Integration Card

A generic UI Integration Card - the cards of SAP Build Work Zone - that runs an
abap2UI5 app: an ABAP class implementing `z2ui5_if_app`, started in a
`z2ui5.embed.Container` control from
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control).
The card is of type `Component` and knows nothing about the app: which class
runs is a card parameter, so one card serves every abap2UI5 app, and an
administrator configures each card on a page - the way an FLP tile names its
class with `?app_start=`.

## How it works

| File | |
|---|---|
| `webapp/manifest.json` | the card: `sap.card` of type `Component`, the destination `abap2UI5`, the parameters below, the `z2ui5.embed` resourceRoot `./thirdparty/z2ui5/embed/` |
| `webapp/Component.js` | `onCardReady`: resolves the destination, builds the endpoint from it and hands class, endpoint and startup parameters to the control |
| `webapp/view/Card.view.xml` | one `z2ui5:Container`, and a message strip that says why an app did not start |
| `webapp/dt/Configuration.js` | what an administrator sets per card in the card's configuration editor |
| `ui5.yaml` | `includeDependency` puts the control into the card's build; the proxy to the SAP system for `ui5 serve` |
| `ui5-local.yaml` | the same, with the proxy to abap2UI5 running locally in Node |
| `webapp/test/` | a preview page, not part of the card: three cards on a page, a stand-in for Work Zone |

The card never names a URL. It names a destination, and the host resolves it:
SAP Build Work Zone to a path of its own origin, which it proxies to the system
behind the BTP destination. The control loads the abap2UI5 frontend from there
(`GET <path>/sap/bc/z2ui5?z2ui5-bundle`) and sends the roundtrips there
(`POST <path>/sap/bc/z2ui5`). No file of the abap2UI5 frontend is in the card.

### Parameters

| Parameter | Default | |
|---|---|---|
| `app` | `Z2UI5_CL_UI5_APP_HI_WORLD` | the ABAP class to run |
| `title`, `subtitle` | `abap2UI5`, empty | the card header |
| `service` | `/sap/bc/z2ui5` | path of the abap2UI5 HTTP service on the system |
| `height` | `25rem` | height of the app in the card |
| `semanticObject`, `action` | empty, `display` | the header navigates to this intent - the tile of the full app, for example. Empty: the header does not navigate |

Every other parameter you add to `sap.card/configuration/parameters` reaches
the app as a startup parameter, `client->get( )-t_comp_params` - one card
class, configured per card:

```json
"parameters": {
  "app": { "value": "ZCL_MY_APPROVALS" },
  "plant": { "value": "1000" }
}
```

### A class made for a card

Any class runs, the hello world app included - but a card is small and sits
on a page with other cards. A class written for it shows a compact view
without `Shell` and `Page`, and lets the full app open from the header. Until
abap2UI5 has an embedded mode, a roundtrip raises abap2UI5's busy indicator
over the whole page; a card app keeps it down on its own events with
`s_ctrl = VALUE #( check_no_busy = abap_true )` in `client->_event( )`.

## Run it

It needs an abap2UI5 backend that answers `?z2ui5-bundle` and leaves the URL
hash to the page it is embedded in - **abap2UI5 1.146.0 or later**. 1.145.0
answers the bundle but clears the page's
hash with the card's first roundtrip, and SAP Build Work Zone routes by it.
Both commands open the preview `test/index.html`.

**Against an SAP system** - `npm start`: set the system's URL as `baseUri`
in `ui5.yaml`, copy `.env.example` to `.env` and put user and password there.

```bash
npm install
npm start                        # the preview, /sap/** proxied to the system in ui5.yaml
```

**Without an SAP system** - `npm run start-local` (`ui5-local.yaml`): abap2UI5
transpiled to JavaScript and run in Node, on `http://localhost:3000`. The npm
package
[`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime)
is exactly that, prebuilt - 1.146.0 or later, in a folder of its own, with
Node 22 or later:

```bash
mkdir abap2ui5-backend && cd abap2ui5-backend
npm install @abap2ui5/node-runtime express
node --input-type=module -e 'import { serve } from "@abap2ui5/node-runtime"; await serve({ port: 3000 });'
```

```bash
npm run start-local              # the preview, /sap/** proxied to localhost:3000
```

`npm run build` writes the card into `dist/`: the manifest, the component and
the control in `dist/thirdparty/z2ui5/embed/` - without the preview.

## Put it into SAP Build Work Zone

1. **The system:** abap2UI5 - 1.146.0 or later, see above -
   with its HTTP service `/sap/bc/z2ui5` active.
2. **A destination** in the BTP subaccount to that system - for an on-premise
   system through the Cloud Connector, for example with principal
   propagation. Name it `ABAP2UI5`, or change `name` under
   `sap.card/configuration/destinations/abap2UI5` in `webapp/manifest.json`.
3. **The card:** give it an id of your own (`sap.app/id` in
   `webapp/manifest.json`, the namespace in `Component.js`, the view and the
   controller), build it and deploy it the way your Work Zone takes UI
   Integration Cards - SAP Business Application Studio deploys a card project
   like this one.
4. **On a page:** add the card and configure it - the class, the texts,
   the navigation target.

What to check on the first card:

- **The Origin check.** abap2UI5 refuses a POST whose `Origin` names another
  host than its own (403, "CSRF validation failed"). Behind Work Zone the
  browser's `Origin` is Work Zone's; abap2UI5 accepts it when the proxy tells
  the backend Work Zone's host in `X-Forwarded-Host`. Where it does not,
  decide in the abap2UI5 user exit (`check_trust_forwarded_host`,
  `check_csrf_active` in `set_config_http_post`).
- **The destination resolves to Work Zone's own origin.** A URL on another
  origin loads nothing - what comes back is code that runs in the page - and
  the card says so.
- **Where the card runs.** A Component card runs in the browser: SAP Build
  Work Zone shows it, the native mobile apps render declarative cards only.

## Where it comes from

The card is developed in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as
`examples/card`, next to the package and its freestyle and Fiori elements
examples - there,
`npm install` at the repository root links the package from
`packages/embed-control`. Its delivery repository
[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
carries it as `card/`, with the control from npm.
