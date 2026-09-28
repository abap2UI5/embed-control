// A stand-in for a page of SAP Build Work Zone - not part of the card.
//
// The card of this project, placed three times with different parameters,
// the way an administrator configures each card on a page, and a host that
// does for the card what Work Zone does: it resolves the card's destination
// to a URL of the page's own origin - here the dev server, which proxies
// /sap to the abap2UI5 backend (ui5.yaml) - and it handles the card's
// navigation.
sap.ui.define(
  [
    "sap/m/App",
    "sap/m/Page",
    "sap/m/FlexBox",
    "sap/m/MessageToast",
    "sap/ui/integration/Host",
    "sap/ui/integration/widgets/Card",
  ],
  (App, Page, FlexBox, MessageToast, Host, Card) => {
    "use strict";

    const host = new Host("host", {
      // Work Zone answers with a path it proxies to the BTP destination of
      // that name
      resolveDestination: () => window.location.origin,
      // Work Zone opens the app behind the intent
      action: (event) => {
        const { ibnTarget } = event.getParameter("parameters") || {};
        if (event.getParameter("type") === "Navigation" && ibnTarget) {
          event.preventDefault();
          MessageToast.show(
            `Navigation to ${ibnTarget.semanticObject}-${ibnTarget.action}`,
          );
        }
      },
    });

    const card = (id, parameters) =>
      new Card(id, {
        // the card as Work Zone gets it - the project's manifest.json
        manifest: "../manifest.json",
        host,
        parameters,
        width: "26rem",
        // a Work Zone page sizes its cards itself; here they take the height
        // of their content
        height: "auto",
      }).addStyleClass("sapUiSmallMargin");

    new App({
      pages: [
        new Page({
          title: "abap2UI5 in UI Integration Cards - preview",
          content: [
            new FlexBox({
              wrap: "Wrap",
              alignItems: "Start",
              items: [
                card("hello", {
                  title: "Hello World",
                  subtitle: "Z2UI5_CL_UI5_APP_HI_WORLD",
                  app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                }),
                card("again", {
                  title: "The same class once more",
                  subtitle: "its own session - the header navigates",
                  app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                  semanticObject: "Z2UI5",
                  action: "display",
                }),
                card("start", {
                  title: "Another class",
                  subtitle: "Z2UI5_CL_UI5_APP_START",
                  app: "Z2UI5_CL_UI5_APP_START",
                  height: "32rem",
                }),
              ],
            }),
          ],
        }),
      ],
    }).placeAt("content");
  },
);
