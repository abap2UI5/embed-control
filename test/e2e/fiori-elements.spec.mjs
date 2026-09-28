import { test, expect } from "@playwright/test";

// The Fiori elements example (examples/fiori-elements): a list report and an
// object page of customers, from a mock OData V4 service, and in the object
// page a custom section with a z2ui5.embed.Container that runs
// Z2UI5_CL_UI5_APP_HI_WORLD for the customer on the page - its key goes in
// as the startup parameter "customer".

// SAPUI5 with sap.fe boots slower than the freestyle app
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

async function openCustomer(page, name) {
  await page.getByText(name, { exact: true }).click();
  await expect(post(page)).toBeVisible({ timeout: 60_000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto("/index.html");
  await expect(page.getByText("Alpine Tools", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
});

test("the custom section runs the app for the customer on the page", async ({
  page,
}) => {
  const starts = appStarts(page);
  await openCustomer(page, "Alpine Tools");

  await expect(page.getByText("abap2UI5 - Hello World")).toBeVisible();
  expect(starts).toEqual([
    { customer: ["1001"], app_start: ["Z2UI5_CL_UI5_APP_HI_WORLD"] },
  ]);
});

// abap2UI5 leaves the URL to the page it is embedded in: an abap2UI5 without
// it ended every roundtrip with a replaceHash(""), and Fiori elements went
// back to the list report
test("the object page keeps its route while the app runs", async ({ page }) => {
  await openCustomer(page, "Alpine Tools");
  const route = new URL(page.url()).hash;
  expect(route).toBe("#/Customers('1001')");

  await section(page).getByRole("textbox").fill("Alice");
  await post(page).click();
  await expect(page.getByText("Your name is Alice")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();

  expect(new URL(page.url()).hash).toBe(route);
  await expect(page.getByText("General Information").first()).toBeVisible();
  await expect(post(page)).toBeVisible();
});

test("another customer ends the session and starts the app with its key", async ({
  page,
}) => {
  const starts = appStarts(page);
  await openCustomer(page, "Alpine Tools");
  await section(page).getByRole("textbox").fill("Alice");

  await page.goBack();
  await openCustomer(page, "Lakeside Foods");

  expect(starts.map((s) => s.customer)).toEqual([["1001"], ["1002"]]);
  // a new session: nothing of the first customer's app is left
  await expect(section(page).getByRole("textbox")).toHaveValue("");
  expect(new URL(page.url()).hash).toBe("#/Customers('1002')");
});

// No file of the abap2UI5 frontend is part of the Fiori elements app: the
// control comes from the app's thirdparty/, the frontend in one request from
// the backend it talks to
test("the frontend comes from the backend, the control from the app", async ({
  page,
}) => {
  const requests = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (r.method() === "GET" && /z2ui5/i.test(url.pathname + url.search)) {
      requests.push(url.pathname + url.search);
    }
  });
  await openCustomer(page, "Alpine Tools");

  expect(requests.sort()).toEqual([
    "/sap/bc/z2ui5?z2ui5-bundle",
    "/thirdparty/z2ui5/embed/Container.css",
    "/thirdparty/z2ui5/embed/Container.js",
  ]);
});
