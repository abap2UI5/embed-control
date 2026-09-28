// What an administrator sets per card in SAP Build Work Zone, in the card's
// configuration editor: which ABAP class runs, the header texts, the
// abap2UI5 service, the height and an optional navigation target. The editor
// adds the destination - the abap2UI5 system - by itself, for every entry of
// sap.card/configuration/destinations.
sap.ui.define(["sap/ui/integration/Designtime"], (Designtime) => {
  "use strict";

  const parameter = (name) =>
    `/sap.card/configuration/parameters/${name}/value`;

  return function () {
    return new Designtime({
      form: {
        items: {
          app: {
            manifestpath: parameter("app"),
            type: "string",
            label: "ABAP class (implements z2ui5_if_app)",
            required: true,
          },
          title: {
            manifestpath: parameter("title"),
            type: "string",
            label: "Title",
            translatable: true,
          },
          subtitle: {
            manifestpath: parameter("subtitle"),
            type: "string",
            label: "Subtitle",
            translatable: true,
          },
          service: {
            manifestpath: parameter("service"),
            type: "string",
            label: "abap2UI5 service path",
          },
          height: {
            manifestpath: parameter("height"),
            type: "string",
            label: "Height (CSS size)",
          },
          semanticObject: {
            manifestpath: parameter("semanticObject"),
            type: "string",
            label: "Header navigation: semantic object",
          },
          action: {
            manifestpath: parameter("action"),
            type: "string",
            label: "Header navigation: action",
          },
        },
      },
      // the editor shows the card abstract - a live preview would start an
      // abap2UI5 session on the system for every change
      preview: {
        modes: "Abstract",
      },
    });
  };
});
