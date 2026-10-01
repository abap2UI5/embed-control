sap.ui.define(
  ["sap/suite/ui/generic/template/lib/AppComponent"],
  (AppComponent) => {
    "use strict";

    // An ordinary Fiori elements app for OData V2 - list report and object
    // page, both from manifest.json ("sap.ui.generic.app") and the
    // annotations of the service. abap2UI5 comes in through one view
    // extension of the object page (ext/).
    return AppComponent.extend("demo.fev2.Component", {
      metadata: {
        manifest: "json",
      },
    });
  },
);
