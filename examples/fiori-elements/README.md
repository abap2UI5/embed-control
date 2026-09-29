# Example: abap2UI5 inside a Fiori elements app

A Fiori elements app - list report and object page of customers - with an
abap2UI5 app in a **custom section of its object page**, placed by the
control from npm:
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control).
The section runs the ABAP class for the customer on the page: the
customer's key goes in as a startup parameter.

## How the package is included

The same three places as in any UI5 app:

| File | |
|---|---|
| `package.json` | the package is an ordinary dependency - `npm install @abap2ui5/embed-control` |
| `ui5.yaml` | `includeDependency` takes the control into the build; the proxy to the SAP system that runs abap2UI5; every UI5 library the ABAP apps use |
| `ui5-local.yaml` | the same, with the proxy to abap2UI5 running locally in Node |
| `webapp/manifest.json` | the `z2ui5.embed` resourceRoot: `./thirdparty/z2ui5/embed/` |

## The custom section

Two files and one entry - the custom extension a Fiori elements app has for
content of its own:

| File | |
|---|---|
| `webapp/manifest.json` | the section, in the object page's `content.body.sections`: its fragment, its title, and where it goes (after the `General` facet) |
| `webapp/ext/Abap2UI5Section.fragment.xml` | the `z2ui5:Container`, bound to the customer on the page |
| `webapp/ext/Abap2UI5Section.js` | which ABAP class runs, and with which parameters |

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

```xml
<z2ui5:Container
    core:require="{ Section: 'demo/fe/ext/Abap2UI5Section' }"
    app="{ path: 'ID', formatter: 'Section.app' }"
    params="{ path: 'ID', targetType: 'any', formatter: 'Section.params' }"
    height="420px"/>
```

- The section is bound to the object, so `ID` is the key of the customer on
  the page. Nothing starts before the page has one, and another customer
  ends the running abap2UI5 session and starts a new one with its key.
- `targetType: 'any'` - an OData V4 binding gives its value the type of the
  service property and converts it into the type of the control property,
  and an `Edm.String` does not convert into the object `params` is ("Don't
  know how to format String to object"). With it, the formatter gets the
  key as it is.
- The control needs a height - a section gives it none of its own.

The ABAP class reads the key as a startup parameter:

```abap
CLASS zcl_customer_notes DEFINITION PUBLIC FINAL.
  PUBLIC SECTION.
    INTERFACES z2ui5_if_app.
    DATA customer TYPE string.
ENDCLASS.

CLASS zcl_customer_notes IMPLEMENTATION.
  METHOD z2ui5_if_app~main.
    IF client->check_on_navigated( ).
      " params="{ customer: '1001' }" of the section
      DATA(params) = client->get( )-t_comp_params.
      customer = VALUE #( params[ n = `customer` ]-v OPTIONAL ).
      " ... build the view for this customer
    ENDIF.
  ENDMETHOD.
ENDCLASS.
```

The example starts `Z2UI5_CL_UI5_APP_HI_WORLD`, which every abap2UI5
installation has - put your class into `ext/Abap2UI5Section.js`.

## Run it

It needs an abap2UI5 backend that answers `?z2ui5-bundle` and leaves the
URL to the page it is embedded in - **the first abap2UI5 release after
1.145.0**. An older one clears the URL hash after every roundtrip, and the
object page goes back to the list.

The app's own OData service is a mockserver of the dev server - the
metadata with the UI annotations in `webapp/localService/metadata.xml`, the
customers in `webapp/localService/data/` - with either backend: the list and
the object page come from the mock data, the section from abap2UI5.

**Against an SAP system** - `npm start`: set the system's URL as `baseUri`
in `ui5.yaml`, copy `.env.example` to `.env` and put user and password there.

```bash
npm install
npm start                        # ui5 serve, /sap/** proxied to the system in ui5.yaml
```

**Without an SAP system** - `npm run start-local` (`ui5-local.yaml`): abap2UI5
transpiled to JavaScript and run in Node, on `http://localhost:3000`. From an
abap2UI5 checkout, whose main has what the app needs (the first build takes a
few minutes):

```bash
git clone https://github.com/abap2UI5/abap2UI5.git && cd abap2UI5
npm ci && npm run downport && npm run auto_transpile
npm run express                  # abap2UI5 on http://localhost:3000
```

```bash
npm run start-local              # ui5 serve, /sap/** proxied to localhost:3000
```

The npm package
[`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime)
is the same prebuilt, but its version is an abap2UI5 release: once one after
1.145.0 is out, install that one instead of building a checkout - the
freestyle example's README shows how.

The proxy tells the backend the dev server's host in `X-Forwarded-Host`, and
abap2UI5's CSRF check compares the browser's `Origin` with it - nothing else
is needed. An installation that switched `check_trust_forwarded_host` off in
its user exit answers 403 through the proxy.

Fiori elements for OData V4 is part of SAPUI5, not of OpenUI5: `ui5.yaml`
takes SAPUI5 1.136 from npm, and the first start downloads it.

## In an app of your own

A Fiori elements app of your own - generated against your RAP service with
the SAP Fiori tools, say - needs the three places of the package above, the
section entry in its manifest and the fragment. Deployed to the system that
runs abap2UI5 (or behind an approuter that routes `/sap/bc/z2ui5` to it),
nothing else is needed: the proxy is for `ui5 serve` only.

## Where it comes from

The app is developed in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as
`examples/fiori-elements`, next to the package - there, `npm install` at the
repository root links the package from `packages/embed-control`. Its
delivery repository
[abap2UI5/frontend-embed-control](https://github.com/abap2UI5/frontend-embed-control)
carries it as this UI5 project, with the control from npm.
