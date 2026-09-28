sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast"],
  (Controller, MessageToast) => {
    "use strict";

    return Controller.extend("demo.host.controller.Main", {
      // Writing the class into the model is all it takes: the control's app
      // property is bound to /app, and a new value starts the new app.
      onStart() {
        const model = this.getOwnerComponent().getModel("host");
        const app = String(model.getProperty("/input") || "")
          .trim()
          .toUpperCase();
        model.setProperty("/app", app);
      },

      onComponentCreated(event) {
        MessageToast.show(`abap2UI5 started: ${event.getSource().getApp()}`);
      },

      onComponentFailed(event) {
        MessageToast.show(
          `abap2UI5 could not start: ${event.getParameter("reason")}`,
        );
      },
    });
  },
);
