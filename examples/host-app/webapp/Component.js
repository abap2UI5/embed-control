sap.ui.define(["sap/ui/core/UIComponent"], (UIComponent) => {
  "use strict";

  // An ordinary UI5 app - nothing in here knows about abap2UI5 except the
  // view, which places z2ui5.embed.Container controls.
  return UIComponent.extend("demo.host.Component", {
    metadata: {
      manifest: "json",
      interfaces: ["sap.ui.core.IAsyncContentCreation"],
    },
  });
});
