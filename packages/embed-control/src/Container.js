// z2ui5.embed.Container - runs an abap2UI5 app inside any UI5 app.
//
//   <mvc:View xmlns:mvc="sap.ui.core.mvc" xmlns:z2ui5="z2ui5.embed">
//     <z2ui5:Container app="Z2UI5_CL_UI5_APP_HI_WORLD" height="400px"/>
//   </mvc:View>
//
// The abap2UI5 frontend - the z2ui5 UIComponent the control wraps - is not
// shipped with the control: it comes from the abap2UI5 service the app talks
// to anyway. Every abap2UI5 installation carries its frontend (embedded in
// the ABAP classes generated from app/webapp), so the frontend always has
// the version of the backend it runs against, and a host app carries nothing
// but this file and its stylesheet.
//
//   GET  <endpoint>?z2ui5-bundle   the frontend as a script, once per page
//   POST <endpoint>                the roundtrips, one session per control
//
// Without the parameter a GET of the endpoint is abap2UI5's own page, as
// always (z2ui5_cl_ui5_http_handler=>_http_get_bundle in abap2UI5).
//
// Everything the app shows and does is decided by the ABAP class on the
// backend. This control only decides WHICH class runs, against WHICH
// endpoint, and how much room it gets. Every instance is its own abap2UI5
// session; changing app, endpoint or params starts a NEW component, and
// destroying the control destroys the component, which ends the session.
sap.ui.define(
  [
    "sap/ui/core/Control",
    "sap/ui/core/ComponentContainer",
    "sap/ui/dom/includeStylesheet",
  ],
  (Control, ComponentContainer, includeStylesheet) => {
    "use strict";

    // the component name - "sap.app/id" of abap2UI5's app/webapp/manifest.json
    const COMPONENT = "z2ui5";

    // abap2UI5's own service node - the page, the roundtrips and the bundle
    const DEFAULT_ENDPOINT = "/sap/bc/z2ui5";

    // the URL parameter that asks the node for the bundle instead of the page
    const BUNDLE_PARAM = "z2ui5-bundle";

    // A path on this server - and nothing else. What comes back from it is
    // CODE that runs in this page, so an endpoint naming another host (a
    // scheme, or //host) would hand the page to whoever controls the value -
    // a host that binds the property to a URL parameter, say. The roundtrips
    // have to stay on this origin anyway (abap2UI5's CSRF check).
    const SAME_ORIGIN_PATH = /^\/(?![/\\])[^?#\\]*$/;

    // Once per page. A stylesheet rather than inline styles, so a host with
    // a strict Content-Security-Policy (no 'unsafe-inline') needs nothing
    // extra for it.
    includeStylesheet(
      sap.ui.require.toUrl("z2ui5/embed/Container.css"),
      "z2ui5-embed-container-css",
    );

    // The frontend is loaded once per page - UI5 has one z2ui5 namespace -
    // from the endpoint of the first control that starts. Every later
    // control uses it and sends its roundtrips to its own endpoint.
    //
    // A <script> element, not the module loader: the bundle is no module of
    // its own path but the answer of the endpoint to a parameter. It
    // registers the frontend's modules (sap.ui.require.preload, functions -
    // nothing is evaluated from a string) and defines z2ui5/embed, which
    // carries what only the installation knows. A logon page, or the page of
    // an abap2UI5 without the bundle, defines no such module: the script
    // either does not run (HTML under nosniff) or runs into nothing, and the
    // require below fails.
    //
    // z2ui5/embed is the bundle's module, not this package's: this control
    // lives below it, in z2ui5/embed/ - the namespace the app maps to its
    // thirdparty/ folder. So when the bundle did not define the module, the
    // require asks for thirdparty/z2ui5/embed.js, which no app has, and fails
    // as it should.
    let frontend = null;

    function loadFrontend(endpoint) {
      if (!frontend) {
        frontend = new Promise((resolve, reject) => {
          const url = `${endpoint}?${BUNDLE_PARAM}`;
          const fail = () =>
            reject(
              new Error(
                `no abap2UI5 frontend at ${url} - is the service active, ` +
                  "the session valid and abap2UI5 recent enough?",
              ),
            );
          const script = document.createElement("script");
          script.src = url;
          script.onerror = fail;
          script.onload = () => {
            sap.ui.require(
              ["z2ui5/embed"],
              (embed) =>
                embed && embed.componentData ? resolve(embed) : fail(),
              fail,
            );
          };
          document.head.appendChild(script);
        });
      }
      return frontend;
    }

    return Control.extend("z2ui5.embed.Container", {
      metadata: {
        properties: {
          // The ABAP class to run - it implements z2ui5_if_app, e.g.
          // Z2UI5_CL_UI5_APP_HI_WORLD, which every abap2UI5 installation
          // has. Nothing starts while it is empty.
          app: { type: "string", defaultValue: "" },

          // Path of the abap2UI5 HTTP service on this server; empty means
          // DEFAULT_ENDPOINT, /sap/bc/z2ui5. The frontend is loaded from it
          // (the first control on the page decides) and the roundtrips go
          // to it.
          endpoint: { type: "string", defaultValue: "" },

          // Startup parameters for the app, { name: "value", ... }. The app
          // reads them with client->get( )-t_comp_params.
          params: { type: "object", defaultValue: null },

          width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },

          // The embedded app fills its container, so the height has to come
          // from somewhere: set it here, or place the control in a parent
          // with a height of its own.
          height: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
        },
        aggregations: {
          _container: {
            type: "sap.ui.core.ComponentContainer",
            multiple: false,
            visibility: "hidden",
          },
        },
        events: {
          // the z2ui5 component of the current app has been created
          componentCreated: {
            parameters: { component: { type: "sap.ui.core.UIComponent" } },
          },
          // it could not be created - the endpoint is not a path on this
          // server, the frontend could not be loaded, or the component failed
          componentFailed: {
            parameters: { reason: { type: "object" } },
          },
        },
      },

      renderer: {
        apiVersion: 2,
        render(rm, control) {
          rm.openStart("div", control);
          // The app's root - sap.m.App, and sap.m.Shell in many abap2UI5
          // views - walks up the DOM from itself and sets height:100% on
          // every ancestor that has none, up to <html>, unless it meets an
          // element marked as root content, the way sap.m.Shell and
          // sap.ui.unified.SplitContainer mark theirs. Unmarked, the app
          // reached through the control into the host's layout - a UI
          // Integration Card grew to the height of the page. This area is
          // the app's screen, so it is the root.
          rm.attr("data-sap-ui-root-content", "true");
          rm.class("z2ui5EmbedContainer");
          rm.style("width", control.getWidth());
          rm.style("height", control.getHeight());
          rm.openEnd();
          const container = control.getAggregation("_container");
          if (container) rm.renderControl(container);
          rm.close("div");
        },
      },

      setApp(value) {
        return this._setStartProperty("app", value);
      },

      setEndpoint(value) {
        return this._setStartProperty("endpoint", value);
      },

      setParams(value) {
        return this._setStartProperty("params", value);
      },

      // The three properties the backend session is started with. A change
      // throws the running component away (which ends its session) and lets
      // the next rendering start a fresh one; a start still waiting for the
      // frontend is dropped. A destroyed container fires nothing any more,
      // so an event of the replaced app cannot reach the host.
      _setStartProperty(name, value) {
        const before = this.getProperty(name);
        this.setProperty(name, value);
        if (this.getProperty(name) !== before) {
          this.destroyAggregation("_container");
          this._start = null;
        }
        return this;
      },

      // The start is asynchronous now: the frontend may still have to come
      // from the backend. The container is set once it is there, which
      // renders the control again.
      onBeforeRendering() {
        if (!this.getApp() || this.getAggregation("_container")) return;
        if (this._start) return;
        const start = (this._start = {});

        const endpoint = this._endpoint();
        if (!SAME_ORIGIN_PATH.test(endpoint)) {
          this.fireComponentFailed({
            reason: new Error(
              `endpoint '${endpoint}' is not a path on this server - ` +
                "the abap2UI5 frontend is only loaded from there",
            ),
          });
          return;
        }
        loadFrontend(endpoint).then(
          (embed) => {
            if (this._exited || this._start !== start) return;
            this.setAggregation("_container", this._createContainer(embed));
          },
          (reason) => {
            if (this._exited || this._start !== start) return;
            this.fireComponentFailed({ reason });
          },
        );
      },

      exit() {
        this._exited = true;
      },

      _endpoint() {
        return (this.getEndpoint() || DEFAULT_ENDPOINT).replace(/\/+$/, "");
      },

      _createContainer(embed) {
        return new ComponentContainer({
          name: COMPONENT,
          manifest: true,
          async: true,
          // the component lives and dies with this container - and so does
          // its backend session
          lifecycle: "Container",
          // the models of the host app stay out of the embedded app, which
          // brings its own
          propagateModel: false,
          // the same as the standalone abap2UI5 page (data-handle-validation)
          handleValidation: true,
          width: "100%",
          height: "100%",
          settings: { componentData: this._componentData(embed) },
          componentCreated: (event) => {
            this.fireComponentCreated({
              component: event.getParameter("component"),
            });
          },
          componentFailed: (event) => {
            this.fireComponentFailed({ reason: event.getParameter("reason") });
          },
        });
      },

      // The component data of the app:
      //   startupParameters  what the backend reads - app_start picks the
      //                      class (z2ui5_cl_ui5_handler=>request_app_start),
      //                      every parameter reaches the app as
      //                      client->get( )-t_comp_params. Both in the
      //                      launchpad's shape, one array of values per name
      //   endpoint           the backend URL, read by the frontend and not
      //                      sent on (Component.init in abap2UI5 app/webapp)
      //   z2ui5/embed        what the bundle hands over - the installation's
      //                      own settings, the paths of the sibling BSPs
      //                      z2ui5_cci/z2ui5_ccc
      _componentData(embed) {
        const startupParameters = {};
        for (const [name, value] of Object.entries(this.getParams() || {})) {
          startupParameters[name] = [String(value)];
        }
        startupParameters.app_start = [this.getApp()];
        return Object.assign({}, embed.componentData, {
          startupParameters,
          endpoint: this._endpoint(),
        });
      },
    });
  },
);
