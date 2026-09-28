import { defineConfig } from "@playwright/test";

// The examples, driven in a browser against a live abap2UI5 backend:
//   freestyle        on the UI5 release the example targets and on 1.71, the
//                    oldest one abap2UI5 (and so the control) supports
//   fiori-elements   on SAPUI5 1.136 - Fiori elements for OData V4 is SAPUI5
//                    only, and needs far more than 1.71
//   card             on OpenUI5 1.136 - a UI Integration Card, whose hosts
//                    (SAP Build Work Zone) bring a current UI5; its preview
//                    page stands in for the host
//
// The UI5 dev servers are started here. The backend is NOT: it has to be
// running already where the examples' proxies point - http://localhost:3000
// by default, the transpiled abap2UI5 from an abap2UI5 checkout
// (`npm run express` there, see README), or any system set in an example's
// .env. The Fiori elements app's own OData service is a mockserver of its
// dev server (examples/fiori-elements/ui5.yaml).
//
// PW_CHROMIUM_PATH runs a Chromium that is already installed instead of the
// one `npx playwright install chromium` downloads.
const serve = (example, config, port, timeout, page = "index.html") => ({
  command: `npm run serve --workspace examples/${example} -- --config ${config} --port ${port}`,
  url: `http://localhost:${port}/${page}`,
  reuseExistingServer: !process.env.CI,
  // the first start downloads the UI5 libraries
  timeout,
});

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    viewport: { width: 1280, height: 1100 },
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  projects: [
    {
      name: "ui5-1.136",
      testMatch: "freestyle.spec.mjs",
      use: { baseURL: "http://localhost:8080" },
    },
    {
      name: "ui5-1.71",
      testMatch: "freestyle.spec.mjs",
      use: { baseURL: "http://localhost:8081" },
      metadata: { query: "?sap-ui-theme=sap_fiori_3" },
    },
    {
      name: "fiori-elements",
      testMatch: "fiori-elements.spec.mjs",
      use: { baseURL: "http://localhost:8082" },
    },
    {
      name: "card",
      testMatch: "card.spec.mjs",
      use: { baseURL: "http://localhost:8083" },
    },
  ],
  webServer: [
    serve("freestyle", "ui5.yaml", 8080, 180_000),
    serve("freestyle", "ui5-1.71.yaml", 8081, 180_000),
    // SAPUI5 with sap.fe and everything it needs is the biggest download
    serve("fiori-elements", "ui5.yaml", 8082, 300_000),
    // the card itself is no page - its preview is
    serve("card", "ui5.yaml", 8083, 180_000, "test/index.html"),
  ],
});
