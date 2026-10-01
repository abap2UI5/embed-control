// The whole card: an abap2UI5 app - an ABAP class implementing z2ui5_if_app -
// in a UI Integration Card of type "Component", run by z2ui5.embed.Container
// from @abap2ui5/embed-control.
//
// Generic: WHICH class runs, and on WHICH system, is card configuration
// (sap.card/configuration in manifest.json), so one card serves every
// abap2UI5 app - an administrator configures each card on a page
// (dt/Configuration.js), the way an FLP tile names its class with
// ?app_start=.
//
// The card knows no backend URL. It names a destination, and the host
// resolves it - SAP Build Work Zone to a path of its own origin, which it
// proxies to the system behind the BTP destination of that name. The control
// loads the abap2UI5 frontend from there (GET <service>?z2ui5-bundle) and
// sends the roundtrips there (POST <service>), which is why the destination
// has to resolve to this page's origin: what comes back is code that runs in
// the page.
sap.ui.define(
  [
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "sap/ui/base/DataType",
  ],
  (UIComponent, JSONModel, DataType) => {
    "use strict";

    // the height of the app in the card unless the parameter names a CSS
    // size of its own
    const DEFAULT_HEIGHT = "25rem";

    // the parameters the card reads itself - every other parameter of
    // sap.card/configuration reaches the app as a startup parameter
    // (client->get( )-t_comp_params)
    const OWN = [
      "app",
      "title",
      "subtitle",
      "service",
      "height",
      "semanticObject",
      "action",
    ];

    return UIComponent.extend("demo.card.Component", {
      metadata: {
        manifest: "json",
        interfaces: ["sap.ui.core.IAsyncContentCreation"],
      },

      init() {
        UIComponent.prototype.init.apply(this, arguments);
        // app stays empty until the destination is resolved - the control
        // starts nothing while it is empty
        this.setModel(
          new JSONModel({
            app: "",
            endpoint: "",
            params: null,
            height: DEFAULT_HEIGHT,
            error: "",
          }),
          "embed",
        );
      },

      // Called by sap.ui.integration once the component exists, with the card
      // it runs in.
      onCardReady(card) {
        // getResolvedParameters since UI5 1.152, getCombinedParameters before
        const values = card.getResolvedParameters
          ? card.getResolvedParameters()
          : card.getCombinedParameters();
        card.resolveDestination("abap2UI5").then(
          (url) => this._start(values || {}, url),
          (reason) =>
            this._fail(`The destination could not be resolved: ${reason}`),
        );
      },

      _start(values, url) {
        // the card may be gone by the time its host has answered
        if (this.isDestroyed()) return;
        const destination = new URL(url, window.location.href);
        if (destination.origin !== window.location.origin) {
          this._fail(
            `The destination resolves to ${destination.origin}, not to this ` +
              "page's origin - the abap2UI5 frontend is only loaded from " +
              "there (in SAP Build Work Zone: through its destination proxy).",
          );
          return;
        }
        const app = String(values.app || "").trim();
        if (!app) {
          this._fail("No ABAP class - set the card parameter 'app'.");
          return;
        }

        const service = String(values.service || "/sap/bc/z2ui5")
          .trim()
          .replace(/^\/*/, "/");
        const params = {};
        for (const [name, value] of Object.entries(values)) {
          if (!OWN.includes(name) && value != null && value !== "") {
            params[name] = value;
          }
        }

        // The control's height takes a CSS size and nothing else: a value it
        // refuses ("400", "big") would throw inside the binding, and the card
        // stayed empty without a word. The default instead, and a word.
        const height = String(values.height || "").trim();
        const validHeight =
          !height || DataType.getType("sap.ui.core.CSSSize").isValid(height);

        this.getModel("embed").setData({
          app,
          endpoint: destination.pathname.replace(/\/+$/, "") + service,
          params: Object.keys(params).length ? params : null,
          height: validHeight && height ? height : DEFAULT_HEIGHT,
          error: validHeight
            ? ""
            : `'${height}' is no CSS size - the card parameter 'height' ` +
              `takes one like '30rem' or '400px'; using ${DEFAULT_HEIGHT}.`,
        });
      },

      _fail(message) {
        if (this.isDestroyed()) return;
        this.getModel("embed").setProperty("/error", message);
      },
    });
  },
);
