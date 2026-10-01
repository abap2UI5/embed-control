sap.ui.define([], () => {
  "use strict";

  // What the object page extension starts, from the country on the page.
  // Nothing starts before the page has its country with all three fields -
  // a field still on its way (undefined) would start the app without it and
  // start it again, in a new session, once it arrives; another country ends
  // the running abap2UI5 session and starts a new one with its fields.
  //
  // Z2UI5_CL_UI5_APP_HI_WORLD is in every abap2UI5 installation, the local
  // one in Node included. With the RAP objects of abap/ in the system, start
  // the app that comes with them, Z2UI5_CL_EMBED_COUNTRY - it reads the three
  // parameters and the country from the same service.
  const APP = "Z2UI5_CL_UI5_APP_HI_WORLD";

  const complete = (country, language, nationality) =>
    !!country && language != null && nationality != null;

  return {
    app(country, language, nationality) {
      return complete(country, language, nationality) ? APP : "";
    },

    params(country, language, nationality) {
      return complete(country, language, nationality)
        ? { country, language, nationality }
        : null;
    },
  };
});
