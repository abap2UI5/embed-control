# Changelog

Every release of `@abap2ui5/embed-control`, newest first. The publish
workflow reads this file: the version being released needs a section of its
own, and nothing may be left under "Unreleased".

## Unreleased

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
