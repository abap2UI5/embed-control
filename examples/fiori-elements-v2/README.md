# Example: abap2UI5 inside a Fiori elements app for OData V2, on a RAP service

A Fiori elements app for OData V2 - list report and object page of
countries - with an abap2UI5 app in an **extension of its object page**,
placed by the control from npm:
[`@abap2ui5/embed-control`](https://www.npmjs.com/package/@abap2ui5/embed-control).
The extension runs the ABAP class for the country on the page: three of its
fields go in as startup parameters. Next to the app, `abap/` has the RAP
service it reads and the abap2UI5 app it starts on a system.

## How the package is included

The same three places as in any UI5 app:

| File | |
|---|---|
| `package.json` | the package is an ordinary dependency - `npm install @abap2ui5/embed-control` |
| `ui5.yaml` | `includeDependency` takes the control into the build; the proxy to the SAP system that runs abap2UI5; every UI5 library the ABAP apps use |
| `ui5-local.yaml` | the same, with the proxy to abap2UI5 running locally in Node |
| `webapp/manifest.json` | the `z2ui5.embed` resourceRoot: `./thirdparty/z2ui5/embed/` |

## The object page extension

Two files and one entry - the view extension the Fiori elements templates
for OData V2 have for content of their own:

| File | |
|---|---|
| `webapp/manifest.json` | the extension, in `sap.ui5/extends/extensions/sap.ui.viewExtensions`: a section of its own after the facet `General` of the entity set `Countries`, and its title |
| `webapp/ext/Abap2UI5Section.fragment.xml` | the `z2ui5:Container`, bound to the country on the page |
| `webapp/ext/Abap2UI5Section.js` | which ABAP class runs, and with which parameters |

```json
"extends": {
  "extensions": {
    "sap.ui.viewExtensions": {
      "sap.suite.ui.generic.template.ObjectPage.view.Details": {
        "AfterFacet|Countries|General": {
          "type": "XML",
          "className": "sap.ui.core.Fragment",
          "fragmentName": "demo.fev2.ext.Abap2UI5Section",
          "sap.ui.generic.app": { "title": "abap2UI5" }
        }
      }
    }
  }
}
```

```xml
<z2ui5:Container
    core:require="{ Section: 'demo/fev2/ext/Abap2UI5Section' }"
    app="{ path: 'Country', formatter: 'Section.app' }"
    params="{ parts: [ 'Country', 'Language', 'Nationality' ], formatter: 'Section.params' }"
    height="420px"/>
```

- The extension is bound to the object, so `Country`, `Language` and
  `Nationality` are the fields of the country on the page. Nothing starts
  before the page has one.
- The templates keep the object page and bind it to the next object, so the
  control stays on the page: another country ends the running abap2UI5
  session, and the control starts a new one in place with the new fields.
- `General` is the `id` of the facet in the metadata extension (`abap/`) -
  `AfterFacet|<entity set>|<facet id>` places the section after it.
- An OData V2 binding hands over the values as they are, so a composite
  binding with a formatter is all `params` needs - no `targetType`, which an
  OData V4 binding needs to hand over a key unconverted.
- The control needs a height - a section gives it none of its own.

The ABAP class reads the fields as startup parameters, by the names
`Abap2UI5Section.js` gives them:

```abap
METHOD z2ui5_if_app~main.
  IF client->check_on_init( ).
    " params="{ country: 'AT', language: 'EN', nationality: 'Austrian' }"
    LOOP AT client->get( )-t_comp_params INTO DATA(param).
      IF to_lower( param-n ) = `country`.
        country = param-v.
      ENDIF.
    ENDLOOP.
    " ... read the country, build the view
  ENDIF.
ENDMETHOD.
```

## The RAP service - `abap/`

The service the app reads, and the abap2UI5 app it starts on a system - in
abapGit's file format:

| Object | |
|---|---|
| `Z2UI5_C_EMBED_COUNTRY` (DDLS) | the CDS view entity: the countries of `T005T` in the logon language - `Country`, `CountryName`, `Nationality`, `Language` |
| `Z2UI5_C_EMBED_COUNTRY` (DDLX) | its metadata extension - list report columns, header, and the facet `General` the section is placed after |
| `Z2UI5_UI_EMBED_COUNTRY` (SRVD) | the service definition, exposing the view as `Countries` |
| `Z2UI5_UI_EMBED_COUNTRY_O2` (SRVB) | the OData V2 UI binding: `/sap/opu/odata/sap/Z2UI5_UI_EMBED_COUNTRY_O2/`, its annotations as `Z2UI5_UI_EMBED_COUNTRY_O2_VAN` |
| `Z2UI5_CL_EMBED_COUNTRY` (CLAS) | the abap2UI5 app: shows the startup parameters as they came, and reads the country again from the view |

It needs a system with RAP view entities and OData V2 bindings - SAP
S/4HANA 2020 (ABAP 7.55) or later - and abap2UI5 1.146.0 or later. `T005T`
is no released API, so the view is for standard ABAP, not ABAP Cloud; there,
`I_CountryText` takes its place.

`webapp/localService/` is that service as the mockserver of the dev server
answers it, under the paths the binding has in a system: the metadata,
trimmed to the entity, the annotations the metadata extension makes, and
eight countries.

## Run it

It needs an abap2UI5 backend that answers `?z2ui5-bundle` and leaves the
URL to the page it is embedded in - **abap2UI5 1.146.0 or later**. An older
one clears the URL hash after every roundtrip, and the object page goes
back to the list.

**Without an SAP system** - `npm run start-local` (`ui5-local.yaml`): abap2UI5
transpiled to JavaScript and run in Node, on `http://localhost:3000`, the
list report and the object page from the mock service. The npm package
[`@abap2ui5/node-runtime`](https://www.npmjs.com/package/@abap2ui5/node-runtime)
is that backend, prebuilt - 1.146.0 or later, in a folder of its own, with
Node 22 or later:

```bash
mkdir abap2ui5-backend && cd abap2ui5-backend
npm install @abap2ui5/node-runtime express
node --input-type=module -e 'import { serve } from "@abap2ui5/node-runtime"; await serve({ port: 3000 });'
```

```bash
npm install
npm run start-local              # ui5 serve, /sap/** proxied to localhost:3000
```

**Against an SAP system** - `npm start`: set the system's URL as `baseUri`
in `ui5.yaml`, copy `.env.example` to `.env` and put user and password there.
The section runs on the system, the list and the object page still come
from the mock service. With the RAP service of `abap/` in the system,
delete the `sap-fe-mockserver` entry of `ui5.yaml` - the app reads the real
service under the same paths - and set `APP` in `ext/Abap2UI5Section.js` to
`Z2UI5_CL_EMBED_COUNTRY`.

The extension starts `Z2UI5_CL_UI5_APP_HI_WORLD`, which every abap2UI5
installation has, the local one included - put your class into
`ext/Abap2UI5Section.js`.

The proxy tells the backend the dev server's host in `X-Forwarded-Host`, and
abap2UI5's CSRF check compares the browser's `Origin` with it - nothing else
is needed. Fiori elements for OData V2 is part of SAPUI5, not of OpenUI5:
`ui5.yaml` takes SAPUI5 1.136 from npm, and the first start downloads it.

## On a system: the branch `rap`

[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
delivers all of it, ready for one abapGit pull, on its branch `rap`: the
objects of `abap/` in `src/01`, and this app as the BSP `Z2UI5_HOST_FE` in
`src/02` - the control from npm in `thirdparty/z2ui5/embed/`, the mock
service left out, and `Z2UI5_CL_EMBED_COUNTRY` as the class it starts.

1. abap2UI5 1.146.0 or later in the system, its HTTP service
   `/sap/bc/z2ui5` active.
2. Pull the branch `rap` with abapGit into a new package.
3. Publish the service binding `Z2UI5_UI_EMBED_COUNTRY_O2` (ADT: open it,
   **Publish**) if the pull did not, and activate the ICF nodes
   `/sap/bc/ui5_ui5/sap/z2ui5_host_fe` and `/sap/bc/bsp/sap/z2ui5_host_fe` in
   `SICF`.
4. Open `/sap/bc/ui5_ui5/sap/z2ui5_host_fe/index.html`, pick a country.

## In an app of your own

A Fiori elements app of your own - generated against your RAP service with
the SAP Fiori tools, say - needs the three places of the package above, the
extension entry in its manifest and the fragment. Deployed to the system that
runs abap2UI5 (or behind an approuter that routes `/sap/bc/z2ui5` to it),
nothing else is needed: the proxy is for `ui5 serve` only.

## Coming from abap2UI5-addons/fiori-elements-integration

This example is the successor of
[abap2UI5-addons/fiori-elements-integration](https://github.com/abap2UI5-addons/fiori-elements-integration):
the same list report and object page on a RAP service of `T005T`, the same
section after the facet, the fields of the object as startup parameters.
What the control takes over:

| The addon | Here |
|---|---|
| a controller extension creates the `z2ui5` component with `Component.create` on every `attachPageDataLoaded` and puts it into a `VBox` | a `z2ui5:Container` in the fragment, bound to the object - nothing in a controller |
| the component is found through a launchpad target mapping for `z2ui5` | the control loads the frontend from `/sap/bc/z2ui5?z2ui5-bundle` - no target mapping, no launchpad needed |
| the fields go in by position (`key1`, `key2`, `key3`) and are read by index | they go in by name, and the class reads them by name |

## Where it comes from

The app is developed in
[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) as
`examples/fiori-elements-v2`, next to the package - there, `npm install` at
the repository root links the package from `packages/embed-control`. Its
delivery repository
[abap2UI5/samples-embed-control](https://github.com/abap2UI5/samples-embed-control)
carries it as this UI5 project on its branch `standard`, and as BSP with the
RAP service on its branch `rap`, with the control from npm.
