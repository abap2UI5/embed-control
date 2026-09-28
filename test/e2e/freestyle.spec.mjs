import { test, expect } from "@playwright/test";

// The freestyle example (examples/freestyle) with three z2ui5.embed.Container
// controls - one bound to the host's model (#single), two side by side
// (#left, #right) - all running Z2UI5_CL_UI5_APP_HI_WORLD on the backend.
// Every test runs once per project in playwright.config.mjs (UI5 release).

const container = (page, id) =>
  page.locator(`.z2ui5EmbedContainer[id$='--${id}']`);
const postButtons = (page) => page.getByRole("button", { name: "Post" });

test.beforeEach(async ({ page }, testInfo) => {
  await page.goto(`/index.html${testInfo.project.metadata.query ?? ""}`);
  // every container has started its app once each shows the Post button
  await expect(postButtons(page)).toHaveCount(3, { timeout: 45_000 });
});

test("every container runs its own abap2UI5 session", async ({ page }) => {
  const left = container(page, "left");
  await left.getByRole("textbox").fill("Alice");
  await left.getByRole("button", { name: "Post" }).click();

  // the ABAP side answered with a message box built from the bound value
  await expect(page.getByText("Your name is Alice")).toBeVisible();
  await page.getByRole("button", { name: "OK" }).click();

  await expect(container(page, "right").getByRole("textbox")).toHaveValue("");
});

test("the host starts another app through its model", async ({ page }) => {
  await page.locator("[id$='--input-inner']").fill("z2ui5_cl_ui5_app_start");
  await page.locator("[id$='--start']").click();

  await expect(
    container(page, "single").getByText("Quickstart", { exact: false }),
  ).toBeVisible();
  // the two other containers are untouched
  await expect(postButtons(page)).toHaveCount(2);
});

test("the embedded app stays inside its container", async ({ page }) => {
  // sap.m.Shell centers itself on the viewport - Container.css keeps it in
  // the control's area, which is narrower than the viewport here
  for (const id of ["single", "left", "right"]) {
    const outer = await container(page, id).boundingBox();
    const inner = await container(page, id)
      .locator(".sapMShellCentralBox")
      .boundingBox();
    expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1);
    expect(inner.x + inner.width).toBeLessThanOrEqual(
      outer.x + outer.width + 1,
    );
  }
});

// sap.m.App - the frontend's root - and sap.m.Shell set height:100% on every
// ancestor that has no height, up to <html>, unless they meet an element
// marked as root content. The control marks its area, so the host's layout
// above it stays the way the host made it.
test("the embedded app leaves the host's layout alone", async ({ page }) => {
  const heights = await container(page, "single").evaluate((el) => {
    const set = [];
    for (let ref = el.parentElement; ref; ref = ref.parentElement) {
      if (ref.classList.contains("sapMPage")) break;
      if (ref.style.height) set.push(`${ref.className}: ${ref.style.height}`);
    }
    return set;
  });
  expect(heights).toEqual([]);
});

// The endpoint is handed over as componentData.endpoint, which the frontend
// reads itself since abap2UI5 2f93737 (#2791) and does not send on - so the
// POST has to arrive at that path, with only the startup parameters in it.
test("endpoint and params reach the backend", async ({ page }) => {
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/sap/bc/z2ui5_alt"),
  );
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["z2ui5/embed/Container"],
          (Container) => {
            const host = document.createElement("div");
            document.body.prepend(host);
            new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              endpoint: "/sap/bc/z2ui5_alt",
              params: { customer: "4711" },
              height: "300px",
              componentCreated: () => resolve(),
            }).placeAt(host);
          },
          reject,
        );
      }),
  );

  const body = JSON.parse((await request).postData());
  expect(body.value.S_FRONT.CONFIG.ComponentData).toEqual({
    startupParameters: {
      customer: ["4711"],
      app_start: ["Z2UI5_CL_UI5_APP_HI_WORLD"],
    },
  });
  await expect(postButtons(page)).toHaveCount(4);
});

// The frontend is not part of the app: the control loads it once from the
// backend it talks to (GET <endpoint>?z2ui5-bundle) - no z2ui5 module is
// requested on its own, the control comes from the app's thirdparty/.
test("the frontend comes from the backend, in one request", async ({
  page,
}, testInfo) => {
  const requests = [];
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (r.method() === "GET" && /z2ui5/i.test(url.pathname + url.search)) {
      requests.push(url.pathname + url.search);
    }
  });
  await page.goto(`/index.html${testInfo.project.metadata.query ?? ""}`);
  await expect(postButtons(page)).toHaveCount(3, { timeout: 45_000 });

  expect(requests.sort()).toEqual([
    "/sap/bc/z2ui5?z2ui5-bundle",
    "/thirdparty/z2ui5/embed/Container.css",
    "/thirdparty/z2ui5/embed/Container.js",
  ]);
});

// What comes back from the endpoint is code that runs in the page - so only
// a path on this server is accepted, and nothing is requested otherwise.
test("an endpoint on another origin loads no code", async ({ page }) => {
  const foreign = [];
  page.on("request", (r) => {
    if (!r.url().startsWith("http://localhost")) foreign.push(r.url());
  });
  for (const endpoint of [
    "https://evil.example/sap/bc/z2ui5",
    "//evil.example/sap/bc/z2ui5",
    "/\\evil.example/sap/bc/z2ui5",
  ]) {
    const reason = await page.evaluate(
      (endpoint) =>
        new Promise((resolve) => {
          sap.ui.require(["z2ui5/embed/Container"], (Container) => {
            const host = document.createElement("div");
            document.body.appendChild(host);
            new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              endpoint,
              componentCreated: () => resolve("created"),
              componentFailed: (e) => resolve(e.getParameter("reason").message),
            }).placeAt(host);
          });
        }),
      endpoint,
    );
    expect(reason).toContain("is not a path on this server");
  }
  expect(foreign).toEqual([]);
});

// An expired session answers with a logon page, an abap2UI5 without the
// bundle with its HTML page - neither defines z2ui5/embed, and the control
// says so instead of starting nothing.
test("a logon page instead of the bundle ends in componentFailed", async ({
  page,
}, testInfo) => {
  await page.route(
    (url) => url.searchParams.has("z2ui5-bundle"),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><body><form>Logon</form></body></html>",
      }),
  );
  await page.goto(`/index.html${testInfo.project.metadata.query ?? ""}`);
  await expect(page.getByText(/abap2UI5 could not start/)).toBeVisible({
    timeout: 45_000,
  });
  await expect(postButtons(page)).toHaveCount(0);
});
