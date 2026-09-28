sap.ui.define(["sap/ui/core/mvc/Controller"], (Controller) => {
  "use strict";

  return Controller.extend("demo.card.controller.Card", {
    // The control could not start the app: no abap2UI5 frontend behind the
    // endpoint (an older abap2UI5, a logon page, the service not active) or a
    // component that failed. Say so in the card, where the admin looks.
    onComponentFailed(event) {
      const reason = event.getParameter("reason");
      this.getOwnerComponent()
        .getModel("embed")
        .setProperty(
          "/error",
          `abap2UI5 could not start: ${(reason && reason.message) || reason}`,
        );
    },
  });
});
