sap.ui.define(["sap/fe/core/AppComponent"], (AppComponent) => {
  "use strict";

  // An ordinary Fiori elements app - list report and object page, both from
  // manifest.json and the annotations of the service. abap2UI5 comes in
  // through one custom section of the object page (ext/).
  return AppComponent.extend("demo.fe.Component", {
    metadata: {
      manifest: "json",
    },
  });
});
