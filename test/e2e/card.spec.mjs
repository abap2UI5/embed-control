import { test, expect } from "@playwright/test";

// The card example (examples/card): a UI Integration Card of type Component
// that runs an abap2UI5 app in z2ui5.embed.Container. Its preview page
// (webapp/test/) places the card three times with different parameters -
// #hello and #again run Z2UI5_CL_UI5_APP_HI_WORLD, #start runs
// Z2UI5_CL_UI5_APP_START - with a host that resolves the card's destination
// to the page's origin, the way SAP Build Work Zone resolves it to its
// destination proxy.

const card = (page, id) => page.locator(`[id='${id}']`);
const postButtons = (page) => page.getByRole("button", { name: "Post" });

test.beforeEach(async ({ page }) => {
  await page.goto("/test/index.html");
  // every card has started its app: two hello worlds and the start app
  await expect(postButtons(page)).toHaveCount(2, { timeout: 45_000 });
  await expect(
    card(page, "start").getByText("Quickstart", { exact: false }),
  ).toBeVisible();
});

// Places one more card on the preview page: the project's manifest, its
// parameters changed by `change`, with a host that resolves the destination
// to `destination` ({origin} the page's, {name} the destination's).
async function placeCard(page, id, destination, change) {
  await page.evaluate(
    ({ id, destination, change }) =>
      fetch("/manifest.json")
        .then((response) => response.json())
        .then(
          (manifest) =>
            new Promise((resolve, reject) => {
              Object.assign(
                manifest["sap.card"].configuration.parameters,
                change,
              );
              sap.ui.require(
                ["sap/ui/integration/widgets/Card", "sap/ui/integration/Host"],
                (Card, Host) => {
                  const area = document.createElement("div");
                  document.body.prepend(area);
                  new Card(id, {
                    manifest,
                    baseUrl: "/",
                    host: new Host({
                      resolveDestination: (name) =>
                        destination
                          .replace("{origin}", window.location.origin)
                          .replace("{name}", name),
                    }),
                    width: "26rem",
                    height: "auto",
                  }).placeAt(area);
                  resolve();
                },
                reject,
              );
            }),
        ),
    { id, destination, change },
  );
}

test("every card runs its app in a session of its own", async ({ page }) => {
  const hello = card(page, "hello");
  await hello.getByRole("textbox").fill("Alice");
  await hello.getByRole("button", { name: "Post" }).click();

  // the ABAP side answered with a message box built from the bound value
  await expect(page.getByText("Your name is Alice")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();

  await expect(card(page, "again").getByRole("textbox")).toHaveValue("");
});

test("the parameters name the class and the header", async ({ page }) => {
  const header = card(page, "hello").locator(".sapFCardHeader");
  await expect(header).toContainText("Hello World");
  await expect(header).toContainText("Z2UI5_CL_UI5_APP_HI_WORLD");
  await expect(card(page, "start").locator(".sapFCardHeader")).toContainText(
    "Z2UI5_CL_UI5_APP_START",
  );
});

test("the header navigates to the intent it is given", async ({ page }) => {
  // #hello has no semantic object - its header stays a header
  await card(page, "hello").locator(".sapFCardHeader").click();
  await page.waitForTimeout(1000);
  await expect(page.getByText(/^Navigation to/)).toHaveCount(0);

  await card(page, "again").locator(".sapFCardHeader").click();
  await expect(page.getByText("Navigation to Z2UI5-display")).toBeVisible();
});

// SAP Build Work Zone routes by the URL hash - #Shell-home, the intent of a
// page - so the cards on it must leave the hash alone: an abap2UI5 whose
// bundle marks the component embedded does (the release after 1.145.0),
// 1.145.0 cleared it with the first roundtrip - so the CI leg against that
// floor leaves this test out (@after-1.145.0).
test(
  "the cards leave the page's URL hash alone",
  { tag: "@after-1.145.0" },
  async ({ page }) => {
    await page.goto("/test/index.html#Shell-home");
    await expect(postButtons(page)).toHaveCount(2, { timeout: 45_000 });
    const hello = card(page, "hello");
    await hello.getByRole("textbox").fill("Alice");
    await hello.getByRole("button", { name: "Post" }).click();
    await expect(page.getByText("Your name is Alice")).toBeVisible();

    expect(await page.evaluate(() => window.location.hash)).toBe("#Shell-home");
  },
);

// The app takes the room the card gives it and no more: sap.m.App and
// sap.m.Shell set height:100% on every ancestor up to <html>, unless the
// control marks its area as their root.
test("the card keeps the height of its content", async ({ page }) => {
  const box = await card(page, "hello").boundingBox();
  const app = await card(page, "hello")
    .locator(".z2ui5EmbedContainer")
    .boundingBox();
  // 25rem, the card's default height parameter
  expect(app.height).toBe(400);
  expect(box.height).toBeLessThan(app.height + 150);
});

// Work Zone resolves the destination to a path of its own origin that it
// proxies to the system. Routed back to the dev server's /sap here - what
// counts is the path the card builds from it.
test("the destination and the parameters reach the backend", async ({
  page,
}) => {
  await page.route("**/dynamic_dest/ABAP2UI5/**", (route) =>
    route.continue({
      url: route.request().url().replace("/dynamic_dest/ABAP2UI5", ""),
    }),
  );
  const request = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/dynamic_dest/ABAP2UI5/sap/bc/z2ui5",
  );
  await placeCard(page, "workzone", "{origin}/dynamic_dest/{name}", {
    plant: { value: "4711" },
  });

  // every parameter the card does not read itself is a startup parameter
  const body = JSON.parse((await request).postData());
  expect(body.value.S_FRONT.CONFIG.ComponentData).toEqual({
    startupParameters: {
      plant: ["4711"],
      app_start: ["Z2UI5_CL_UI5_APP_HI_WORLD"],
    },
  });
  await expect(postButtons(page)).toHaveCount(3);
});

// What comes back from the endpoint is code that runs in the page - so a
// destination on another origin loads nothing, and the card says why.
test("a destination on another origin loads nothing", async ({ page }) => {
  const foreign = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost")) foreign.push(r.url());
  });
  await placeCard(page, "foreign", "https://evil.example/{name}", {});

  await expect(
    card(page, "foreign").getByText(/not to this page's origin/),
  ).toBeVisible();
  await expect(postButtons(page)).toHaveCount(2);
  expect(foreign).toEqual([]);
});

test("without a class the card starts nothing", async ({ page }) => {
  await placeCard(page, "empty", "{origin}", { app: { value: "" } });

  await expect(card(page, "empty").getByText(/No ABAP class/)).toBeVisible();
  await expect(postButtons(page)).toHaveCount(2);
});

// dt/Configuration.js - what an administrator gets in the card's
// configuration editor, here the one SAP Build Work Zone uses
test("the configuration editor offers the card's parameters", async ({
  page,
}) => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["sap/ui/integration/designtime/editor/CardEditor"],
          (CardEditor) => {
            const area = document.createElement("div");
            document.body.prepend(area);
            new CardEditor({
              card: { manifest: "/manifest.json", baseUrl: "/" },
              mode: "admin",
              host: "host",
            }).placeAt(area);
            resolve();
          },
          reject,
        );
      }),
  );

  await expect(
    page.getByText("ABAP class (implements z2ui5_if_app)"),
  ).toBeVisible();
  await expect(page.getByText("abap2UI5 service path")).toBeVisible();
});
