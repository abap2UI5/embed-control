sap.ui.define([], () => {
  "use strict";

  // What the custom section starts, from the key of the customer on the
  // page. Nothing starts before the page has its customer; another customer
  // ends the running abap2UI5 session and starts a new one with its key.
  return {
    app(id) {
      return id ? "Z2UI5_CL_UI5_APP_HI_WORLD" : "";
    },

    params(id) {
      return id ? { customer: id } : null;
    },
  };
});
