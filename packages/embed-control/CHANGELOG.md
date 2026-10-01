# Changelog

Every release of `@abap2ui5/embed-control`, newest first. The publish
workflow reads this file: the version being released needs a section of its
own, and nothing may be left under "Unreleased".

## Unreleased

- `package.json` names the author (abap2UI5), as npm and the Best of UI5
  listing show it.
- `package.json` records the backend floor, `"abap2ui5": { "minBackend":
  "1.145.0" }` - the first abap2UI5 whose service answers `?z2ui5-bundle`,
  which the README names in prose. The CI's e2e leg against the floor
  installs the `@abap2ui5/node-runtime` of that version, so the two cannot
  drift. No `engines`: the package is a browser control with no Node code,
  and a UI5 CLI 3 consumer may install it on Node 16 or 18.

## 0.1.1

- Security: an `endpoint` that the browser reads as another host - a tab
  or line break after the first slash (`"/\t/evil.example/..."`) - no longer
  passes the same-origin check. The endpoint is parsed the way the browser
  parses it, refused unless it lands on the page's origin, and only the
  resolved URL is requested. A relative `endpoint` now resolves against the
  page's address.
- An `endpoint` whose path begins with `//` once `.` and `..` segments are
  resolved - `"/.//evil.example/..."`, `"..//evil.example/..."` - is
  refused: no server has such a path, and on its own it names another host.
- A page with a `<base>` that names another host no longer sends the
  frontend request and the roundtrips there: the control requested the
  checked endpoint as a path, which the browser resolves against the
  `<base>`. It requests, and hands to the frontend, the absolute URL on the
  page's origin now.
- One failed load of the frontend - a backend that was down, a logon page
  instead of the bundle - no longer disables every control on the page for
  good. The failure is forgotten and the next start (a new control, or a
  change of `app`, `endpoint` or `params`) asks the backend again; the
  control no longer asks UI5's module loader for `z2ui5/embed`, which
  remembered the module as failed.
- A change of `app`, `endpoint` or `params`, or the control destroyed, while
  the component was still being created left that component running unseen,
  with its backend session. The control creates the component itself now and
  destroys it when the start it belongs to is no longer the current one.
- The component is created in the context of the control's owner - your
  app's component - as a `ComponentContainer` in a view creates it; 0.1.0
  created it without an owner. An app that declares keep-alive
  (`sap.ui5/keepAlive`, UI5 1.88+) therefore reports no keep-alive support
  while it has an embedded app: the abap2UI5 frontend does not support it,
  and 0.1.0 left the embedded app running while its host was inactive. A
  host deactivated while its app is still starting gets the app all the
  same, created without the owner.
- `params` are compared by value: a binding that hands over the same
  parameters in a new object (`model.refresh(true)`, a formatter) no longer
  restarts the app and loses its state. They are compared with what the
  running app was started with, so a params object changed in place and
  handed over again - as a copy or as the same object - does restart it
  (0.1.0 missed the same object). A parameter whose value is `null` or
  `undefined` is left out instead of reaching the app as the text "null" or
  "undefined".
- The control no longer leaves `window.z2ui5.embed` behind: UI5 exports
  every class it creates as a global, and abap2UI5 dropped its `z2ui5`
  global on purpose (#2777). The module returns the class, which is all that
  views and `sap.ui.require` use.
- README: the backend floor in Node and CAP too (`@abap2ui5/node-runtime`
  1.145.0, `@cap2ui5/cds-plugin` 0.3.1), what 1.145.0 does not do yet (the
  URL hash, a `#/app/<CLASS>` hash that wins over `app`, no CSRF token for an
  approuter route), the page-wide behaviour of the embedded frontend and
  that a starting app takes the focus from the host.
- The package carries this changelog.
- README: abap2UI5 1.146.0 is out - it names the release that leaves the URL
  hash to the host and answers an approuter's CSRF check, where it said "the
  first release after 1.145.0".

## 0.1.0

The first release.

- `z2ui5.embed.Container` runs an abap2UI5 app - an ABAP class implementing
  `z2ui5_if_app` - inside any UI5 app. Properties `app`, `endpoint`,
  `params`, `width` and `height`; events `componentCreated` and
  `componentFailed`. Every control is its own abap2UI5 session.
- The abap2UI5 frontend is not in the package: the control loads it once per
  page from the backend it talks to (`GET <endpoint>?z2ui5-bundle`, abap2UI5
  1.145.0 or later), and only from a path on the page's own server.
- Served and built under `thirdparty/z2ui5/embed/`, so it is found in an app
  deployed to an ABAP system too. UI5 1.71 and later; UI5 CLI 3 and 4.
- The control's area is the embedded app's root: `sap.m.App` and
  `sap.m.Shell` stop there instead of setting `height: 100%` on every
  ancestor up to `<html>` - the host's layout stays the host's, and a UI
  Integration Card keeps the height of its content.
