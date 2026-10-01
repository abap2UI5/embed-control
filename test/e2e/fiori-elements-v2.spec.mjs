import { test, expect } from "@playwright/test";

// The Fiori elements example for OData V2 (examples/fiori-elements-v2): a
// list report and an object page of countries, from a mock of the RAP
// service in its abap/, and in the object page an extension after the facet
// "General" with a z2ui5.embed.Container that runs Z2UI5_CL_UI5_APP_HI_WORLD
// for the country on the page - three of its fields go in as the startup
// parameters "country", "language" and "nationality".

// SAPUI5 with the V2 templates boots slower than the freestyle app
test.describe.configure({ timeout: 120_000 });

const section = (page) => page.locator(".z2ui5EmbedContainer");
const post = (page) => section(page).getByRole("button", { name: "Post" });

// the component data of every app START (an event roundtrip carries none)
function appStarts(page) {
  const starts = [];
  page.on("request", (r) => {
    if (r.method() !== "POST" || !r.url().endsWith("/sap/bc/z2ui5")) return;
    const data = JSON.parse(r.postData()).value.S_FRONT.CONFIG?.ComponentData;
    if (data) starts.push(data.startupParameters);
  });
  return starts;
}

async function openCountry(page, name) {
  await page.getByText(name, { exact: true }).click();
  await expect(post(page)).toBeVisible({ timeout: 60_000 });
}

// The object page's route - the V2 templates append an app state query to
// it (?sap-iapp-state--history=...), the entity is what identifies the page
const entity = (page) => new URL(page.url()).hash.split("/?")[0];

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByText("Austria", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
});

test("the extension runs the app with the fields of the country on the page", async ({
  page,
}) => {
  const starts = appStarts(page);
  await openCountry(page, "Austria");

  await expect(page.getByText("abap2UI5 - Hello World")).toBeVisible();
  expect(starts).toEqual([
    {
      country: ["AT"],
      language: ["EN"],
      nationality: ["Austrian"],
      app_start: ["Z2UI5_CL_UI5_APP_HI_WORLD"],
    },
  ]);
  // a section of its own after the facet the annotations make, as
  // manifest.json places it
  await expect(page.getByRole("tab")).toHaveText([
    "General Information",
    "abap2UI5",
  ]);
});

// abap2UI5 leaves the URL to the page it is embedded in: an abap2UI5 without
// it ended every roundtrip with a replaceHash(""), and Fiori elements went
// back to the list report
test("the object page keeps its route while the app runs", async ({ page }) => {
  await openCountry(page, "Austria");
  expect(entity(page)).toBe("#/Countries('AT')");
  const route = new URL(page.url()).hash;

  await section(page).getByRole("textbox").fill("Alice");
  await post(page).click();
  await expect(page.getByText("Your name is Alice")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();

  expect(new URL(page.url()).hash).toBe(route);
  await expect(page.getByText("General Information").first()).toBeVisible();
  await expect(post(page)).toBeVisible();
});

test("another country ends the session and starts the app with its fields", async ({
  page,
}) => {
  const starts = appStarts(page);
  await openCountry(page, "Austria");
  await section(page).getByRole("textbox").fill("Alice");

  await page.goBack();
  await page.getByText("Switzerland", { exact: true }).click();

  // The V2 templates keep the object page and rebind it to the next country,
  // so the section stays on the page and its control starts anew in place
  await expect
    .poll(() => starts.map((s) => [s.country, s.nationality]))
    .toEqual([
      [["AT"], ["Austrian"]],
      [["CH"], ["Swiss"]],
    ]);
  await expect(post(page)).toBeVisible();
  // a new session: nothing of the first country's app is left
  await expect(section(page).getByRole("textbox")).toHaveValue("");
  expect(entity(page)).toBe("#/Countries('CH')");
});

// No file of the abap2UI5 frontend is part of the Fiori elements app: the
// control comes from the app's thirdparty/, the frontend in one request from
// the backend it talks to. The app's own OData service lives under /sap/opu/
// and carries z2ui5 in its name - it is not counted.
test("the frontend comes from the backend, the control from the app", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.pathname.startsWith("/sap/opu/")) return;
    if (r.method() === "GET" && /z2ui5/i.test(url.pathname + url.search)) {
      requests.push(url.pathname + url.search);
    }
  });
  await openCountry(page, "Austria");

  expect(requests.sort()).toEqual([
    "/sap/bc/z2ui5?z2ui5-bundle",
    "/thirdparty/z2ui5/embed/Container.css",
    "/thirdparty/z2ui5/embed/Container.js",
  ]);
});
