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
// A relative endpoint resolves against the page, a parameter without a
// value stays out - it would reach the app as the text "null" - and an
// array is several values of one name, the launchpad's shape.
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
              endpoint: "sap/bc/z2ui5_alt/",
              params: {
                customer: "4711",
                note: null,
                flag: undefined,
                ids: ["1", 2, null],
                none: [],
              },
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
      ids: ["1", "2"],
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
    // the URL parser drops tabs, line breaks and leading spaces: each of
    // these is //evil.example to the browser
    "/\t/evil.example/sap/bc/z2ui5",
    "/\n/evil.example/sap/bc/z2ui5",
    "/\r/evil.example/sap/bc/z2ui5",
    " //evil.example/sap/bc/z2ui5",
    // "." and ".." segments go when the URL is parsed: each of these has
    // the path //evil.example/sap/bc/z2ui5 - on this origin, but another
    // host to the browser once that path is used on its own
    "/.//evil.example/sap/bc/z2ui5",
    "/sap/..//evil.example/sap/bc/z2ui5",
    "/%2e//evil.example/sap/bc/z2ui5",
    "/.\\/evil.example/sap/bc/z2ui5",
    "..//evil.example/sap/bc/z2ui5",
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

// A page of a host's own, with nothing started on it: UI5 and the control
// come from this server by absolute URLs, so only what the control requests
// itself is left to the page - its <base>, when `head` has one.
const hostPage = (baseURL, head = "") => `<!DOCTYPE html>
  <html><head>
  ${head}
  <script id="sap-ui-bootstrap"
    src="${baseURL}/resources/sap-ui-core.js"
    data-sap-ui-theme="sap_horizon"
    data-sap-ui-libs="sap.m"
    data-sap-ui-resourceroots='{"z2ui5.embed": "${baseURL}/thirdparty/z2ui5/embed/"}'
    data-sap-ui-compatVersion="edge"
    data-sap-ui-async="true"></script>
  </head><body class="sapUiBody"><div id="area"></div></body></html>`;

// The check resolves the endpoint against the page and compares origins -
// so what is requested has to be exactly that URL. A path is resolved by
// the browser against the page's <base>, which may name another host: the
// bundle (code) and the roundtrips would go there, unchecked.
test("a <base> on another host takes neither the frontend nor the roundtrips there", async ({
  page,
  baseURL,
}, testInfo) => {
  const foreign = [];
  await page.route(
    (url) => url.hostname === "other.test",
    (route) => {
      foreign.push(route.request().url());
      return route.abort();
    },
  );
  await page.route(
    (url) => url.pathname === "/base-elsewhere.html",
    (route) =>
      route.fulfill({
        contentType: "text/html",
        body: hostPage(baseURL, '<base href="http://other.test/">'),
      }),
  );
  await page.goto(
    `/base-elsewhere.html${testInfo.project.metadata.query ?? ""}`,
  );
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        sap.ui.getCore().attachInit(() =>
          sap.ui.require(["z2ui5/embed/Container"], (Container) => {
            new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              height: "300px",
              componentCreated: () => resolve("created"),
              componentFailed: (e) => resolve(e.getParameter("reason").message),
            }).placeAt("area");
          }),
        );
      }),
  );

  expect(result).toBe("created");
  // the first roundtrip came back: the app's view is there
  await expect(postButtons(page)).toHaveCount(1);
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

// A failed load is not the end of the page: the next start asks the backend
// again - it may be back, the session valid again. Nothing may keep the
// failure: not the control, and not UI5's module loader, which remembers a
// module it could not load for good - so the control never asks it for
// z2ui5/embed, it only looks whether the bundle defined it.
test("a failed frontend load is tried again by the next start", async ({
  page,
}, testInfo) => {
  const failures = {
    "a logon page": (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<!DOCTYPE html><html><body><form>Logon</form></body></html>",
      }),
    "a backend that is down": (route) =>
      route.fulfill({ status: 503, contentType: "text/plain", body: "down" }),
  };
  for (const [failure, fail] of Object.entries(failures)) {
    let answered = 0;
    await page.unrouteAll();
    await page.route(
      (url) => url.searchParams.has("z2ui5-bundle"),
      (route) => (++answered === 1 ? fail(route) : route.continue()),
    );
    const moduleRequests = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/z2ui5/embed.js")) moduleRequests.push(r.url());
    });
    await page.goto(`/index.html${testInfo.project.metadata.query ?? ""}`);
    await expect(
      page.getByText(/abap2UI5 could not start/).first(),
    ).toBeVisible({ timeout: 45_000 });
    await expect(postButtons(page), failure).toHaveCount(0);

    // the host starts another app in #single - a new start
    await page.locator("[id$='--input-inner']").fill("z2ui5_cl_ui5_app_start");
    await page.locator("[id$='--start']").click();
    await expect(
      container(page, "single").getByText("Quickstart", { exact: false }),
      failure,
    ).toBeVisible({ timeout: 45_000 });

    expect(answered, failure).toBe(2);
    expect(moduleRequests, failure).toEqual([]);
    // the failed script is gone, the loaded one stays
    expect(
      await page.evaluate(
        () => document.querySelectorAll("script[src*='z2ui5-bundle']").length,
      ),
      failure,
    ).toBe(1);
  }
});

// A change of the app - or the end of the control - while the component is
// still being created: the component that arrives late is destroyed, not
// left running unseen with its backend session.
for (const change of ["a new app", "the control destroyed"]) {
  test(`a component still being created is destroyed - ${change}`, async ({
    page,
  }) => {
    const acted = await page.evaluate(
      (change) =>
        new Promise((resolve, reject) => {
          sap.ui.require(
            ["z2ui5/embed/Container", "sap/ui/core/Component"],
            (Container, Component) => {
              const z2ui5 = () =>
                Component.registry.filter(
                  (c) => c.getMetadata().getName() === "z2ui5.Component",
                );
              const before = new Set(z2ui5());
              const state = (window.leak = { created: 0, before });
              const host = document.createElement("div");
              document.body.prepend(host);
              const control = new Container({
                app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                height: "300px",
                componentCreated: () => state.created++,
              });
              // the moment the component is asked for - Component.create
              // has not resolved yet; whoever creates it goes through here
              const create = Component.create;
              Component.create = function (options) {
                const creating = create.apply(this, arguments);
                if (options.name !== "z2ui5") return creating;
                Component.create = create;
                queueMicrotask(() => {
                  const acted = state.created === 0;
                  if (change === "a new app") {
                    control.setApp("Z2UI5_CL_UI5_APP_START");
                  } else {
                    control.destroy();
                  }
                  creating.then((component) => {
                    state.first = component.getId();
                    resolve(acted);
                  }, reject);
                });
                return creating;
              };
              control.placeAt(host);
            },
            reject,
          );
        }),
      change,
    );
    // the change came before the component was handed over
    expect(acted).toBe(true);

    const state = () =>
      page.evaluate(() => {
        const Component = sap.ui.require("sap/ui/core/Component");
        return {
          firstAlive: !!Component.registry.get(window.leak.first),
          created: window.leak.created,
          alive: Component.registry.filter(
            (c) =>
              c.getMetadata().getName() === "z2ui5.Component" &&
              !window.leak.before.has(c),
          ).length,
        };
      });
    if (change === "a new app") {
      // the new app runs, the first component is gone
      await expect(
        page.getByText("Quickstart", { exact: false }).first(),
      ).toBeVisible();
      await expect
        .poll(state)
        .toEqual({ firstAlive: false, created: 1, alive: 1 });
    } else {
      await expect
        .poll(state)
        .toEqual({ firstAlive: false, created: 0, alive: 0 });
    }
  });
}

// params is an object, and a binding hands over a new one whenever the
// model says it changed - model.refresh(true), a formatter. The same
// parameters must not restart the app, which would lose its state; other
// ones do.
test("the same params do not restart the app", async ({ page }) => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["z2ui5/embed/Container", "sap/ui/model/json/JSONModel"],
          (Container, JSONModel) => {
            const model = new JSONModel({ customer: "4711" });
            const state = (window.params = { created: 0, model });
            const host = document.createElement("div");
            document.body.prepend(host);
            const control = new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              height: "300px",
              params: {
                path: "/customer",
                formatter: (customer) => ({ customer, note: undefined }),
              },
              componentCreated: () => {
                state.created++;
                resolve();
              },
            });
            control.setModel(model);
            control.placeAt(host);
          },
          reject,
        );
      }),
  );
  await page.evaluate(() => window.params.model.refresh(true));
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.params.created)).toBe(1);

  await page.evaluate(() =>
    window.params.model.setProperty("/customer", "4712"),
  );
  await expect.poll(() => page.evaluate(() => window.params.created)).toBe(2);
});

// What counts is what the running app was started with. A host that
// changes the params object it handed over and hands it over again - as a
// copy, or as the same object - means other parameters, although the
// property already holds the changed object.
for (const handover of ["a copy", "the same object"]) {
  test(`params changed in place restart the app - handed over as ${handover}`, async ({
    page,
  }) => {
    const starts = await page.evaluate(
      (handover) =>
        new Promise((resolve, reject) => {
          sap.ui.require(
            ["z2ui5/embed/Container"],
            (Container) => {
              const starts = [];
              const params = { customer: "4711" };
              const host = document.createElement("div");
              document.body.prepend(host);
              const control = new Container({
                app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                height: "300px",
                params,
                componentCreated: (e) => {
                  const data = e.getParameter("component").getComponentData();
                  starts.push(data.startupParameters.customer[0]);
                  if (starts.length > 1) {
                    resolve(starts);
                    return;
                  }
                  params.customer = "4712";
                  control.setParams(
                    handover === "a copy" ? Object.assign({}, params) : params,
                  );
                  setTimeout(() => resolve(starts), 10_000);
                },
              });
              control.placeAt(host);
            },
            reject,
          );
        }),
      handover,
    );
    expect(starts).toEqual(["4711", "4712"]);
  });
}

// UI5 exports every class as a global; abap2UI5 dropped its z2ui5 global on
// purpose (#2777), and the control takes its own export off again.
test("the control puts nothing on a z2ui5 global", async ({ page }) => {
  expect(
    await page.evaluate(() => typeof (window.z2ui5 && window.z2ui5.embed)),
  ).toBe("undefined");
});

// A host the launchpad keeps alive (UI5 1.88+) is deactivated when the user
// leaves it - possibly while an app in it is still starting. UI5 creates no
// component in the context of an inactive owner (runAsOwner throws), so the
// app starts without that owner instead of failing for good.
test("an app whose host is deactivated while it starts still starts", async ({
  page,
}) => {
  const result = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["sap/ui/core/UIComponent", "z2ui5/embed/Container"],
          (UIComponent, Container) => {
            if (!UIComponent.prototype.deactivate) {
              resolve("no keep-alive");
              return;
            }
            const Host = UIComponent.extend("keepalive.Component", {
              metadata: {
                manifest: {
                  "sap.app": { id: "keepalive" },
                  "sap.ui5": { keepAlive: { supported: true } },
                },
              },
            });
            const host = new Host();
            const area = document.createElement("div");
            document.body.prepend(area);
            host
              .runAsOwner(
                () =>
                  new Container({
                    app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                    height: "300px",
                    componentCreated: () => resolve("created"),
                    componentFailed: (e) =>
                      resolve(String(e.getParameter("reason"))),
                  }),
              )
              .placeAt(area);
            // the rendering starts the app; the frontend is on the page
            // already, so the component is asked for right after this task -
            // by then the user has left the host
            sap.ui.getCore().applyChanges();
            host.deactivate();
          },
          reject,
        );
      }),
  );
  test.skip(result === "no keep-alive", "keep-alive needs UI5 1.88");
  expect(result).toBe("created");
  await expect(postButtons(page)).toHaveCount(4);
});

// A query or a fragment on the endpoint is refused as well - the bundle is
// asked for with a query of its own, the roundtrips go to the path - and
// the reason says which, instead of calling a path on this server another
// host. Like every failure it arrives after the rendering that started
// the app.
test("a query or a fragment on the endpoint is refused, and named", async ({
  page,
}) => {
  for (const endpoint of [
    "/sap/bc/z2ui5?sap-client=100",
    "/sap/bc/z2ui5#top",
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
    expect(reason).toContain("carries a query or a fragment");
  }
  await expect(postButtons(page)).toHaveCount(3);
});

// What a start is made of is the endpoint as it is requested and the params
// as the backend gets them: the same endpoint in another spelling, or an
// app_start in the params (the app wins over it anyway), is no change and
// keeps the app and its state; another endpoint is a change.
test("the same endpoint spelled differently does not restart the app", async ({
  page,
}) => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["z2ui5/embed/Container"],
          (Container) => {
            const state = (window.spelling = { created: 0 });
            const host = document.createElement("div");
            document.body.prepend(host);
            state.control = new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              endpoint: "/sap/bc/z2ui5",
              height: "300px",
              componentCreated: () => {
                state.created++;
                resolve();
              },
            });
            state.control.placeAt(host);
          },
          reject,
        );
      }),
  );
  await page.evaluate(() => {
    const { control } = window.spelling;
    control.setEndpoint("/sap/bc/z2ui5/");
    control.setEndpoint("sap/bc/z2ui5");
    control.setEndpoint("");
    control.setParams({ app_start: "Z2UI5_CL_UI5_APP_START" });
  });
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.spelling.created)).toBe(1);
  await expect(postButtons(page)).toHaveCount(4);

  await page.evaluate(() =>
    window.spelling.control.setEndpoint("/sap/bc/z2ui5_alt"),
  );
  await expect.poll(() => page.evaluate(() => window.spelling.created)).toBe(2);
});

// restart( ) starts the app anew: the running session ends, and with it
// what the user typed.
test("restart() starts the app anew", async ({ page }) => {
  const single = container(page, "single");
  await single.getByRole("textbox").fill("Alice");
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const el = document.querySelector(
          ".z2ui5EmbedContainer[id$='--single']",
        );
        const control = sap.ui.getCore().byId(el.id);
        control.attachComponentCreated(() => resolve());
        control.restart();
      }),
  );
  await expect(single.getByRole("textbox")).toHaveValue("");
  await expect(postButtons(page)).toHaveCount(3);
});

// A failed start is not repeated by the control itself - a backend that is
// down would be asked on every rendering - and restart( ) is the host's way
// to try again without changing anything.
test("restart() after a failed start asks the backend again", async ({
  page,
}, testInfo) => {
  let answered = 0;
  await page.route(
    (url) => url.searchParams.has("z2ui5-bundle"),
    (route) =>
      ++answered === 1
        ? route.fulfill({
            status: 503,
            contentType: "text/plain",
            body: "down",
          })
        : route.continue(),
  );
  await page.goto(`/index.html${testInfo.project.metadata.query ?? ""}`);
  await expect(page.getByText(/abap2UI5 could not start/).first()).toBeVisible({
    timeout: 45_000,
  });
  await expect(postButtons(page)).toHaveCount(0);
  await page.waitForTimeout(2000);
  expect(answered).toBe(1);

  await page.evaluate(() => {
    const el = document.querySelector(".z2ui5EmbedContainer[id$='--single']");
    sap.ui.getCore().byId(el.id).restart();
  });
  await expect(
    container(page, "single").getByRole("button", { name: "Post" }),
  ).toBeVisible({ timeout: 45_000 });
  expect(answered).toBe(2);
  // the two others failed as well and were not restarted
  await expect(postButtons(page)).toHaveCount(1);
});

// UI5 renders a placeholder for an invisible control and calls its
// onBeforeRendering all the same: nothing starts for an app nobody sees,
// until the control is shown - and a running app keeps running, with its
// state, while the control is hidden.
test("an invisible control starts nothing until it is shown", async ({
  page,
}) => {
  await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        sap.ui.require(
          ["z2ui5/embed/Container"],
          (Container) => {
            const state = (window.hidden = { created: 0 });
            const host = document.createElement("div");
            document.body.prepend(host);
            state.control = new Container({
              app: "Z2UI5_CL_UI5_APP_HI_WORLD",
              height: "300px",
              visible: false,
              componentCreated: () => state.created++,
            });
            state.control.placeAt(host);
            resolve();
          },
          reject,
        );
      }),
  );
  await page.waitForTimeout(3000);
  expect(await page.evaluate(() => window.hidden.created)).toBe(0);
  await expect(postButtons(page)).toHaveCount(3);

  await page.evaluate(() => window.hidden.control.setVisible(true));
  await expect.poll(() => page.evaluate(() => window.hidden.created)).toBe(1);
  await expect(postButtons(page)).toHaveCount(4);
  await page
    .locator(".z2ui5EmbedContainer")
    .first()
    .getByRole("textbox")
    .fill("Alice");

  await page.evaluate(() => window.hidden.control.setVisible(false));
  await expect(postButtons(page)).toHaveCount(3);
  await page.evaluate(() => window.hidden.control.setVisible(true));
  await expect(postButtons(page)).toHaveCount(4);
  expect(await page.evaluate(() => window.hidden.created)).toBe(1);
  await expect(
    page.locator(".z2ui5EmbedContainer").first().getByRole("textbox"),
  ).toHaveValue("Alice");
});

// The first control decides where the frontend comes from - but when that
// load fails, a control with an endpoint of its own is not failed for a
// backend it never talks to: it tries its own endpoint once.
test("a frontend load that failed from another control's endpoint is tried from the control's own", async ({
  page,
  baseURL,
}, testInfo) => {
  const bundles = [];
  await page.route(
    (url) => url.searchParams.has("z2ui5-bundle"),
    (route) => {
      const url = new URL(route.request().url());
      bundles.push(url.pathname);
      return url.pathname.endsWith("/z2ui5_down")
        ? route.fulfill({
            status: 503,
            contentType: "text/plain",
            body: "down",
          })
        : route.continue();
    },
  );
  await page.route(
    (url) => url.pathname === "/two-endpoints.html",
    (route) =>
      route.fulfill({ contentType: "text/html", body: hostPage(baseURL) }),
  );
  await page.goto(
    `/two-endpoints.html${testInfo.project.metadata.query ?? ""}`,
  );
  const result = await page.evaluate(
    () =>
      new Promise((resolve) => {
        sap.ui.getCore().attachInit(() =>
          sap.ui.require(
            ["z2ui5/embed/Container", "sap/m/VBox"],
            (Container, VBox) => {
              const result = {};
              const done = () => {
                if ("down" in result && "ok" in result) resolve(result);
              };
              const control = (name, endpoint) =>
                new Container({
                  app: "Z2UI5_CL_UI5_APP_HI_WORLD",
                  endpoint,
                  height: "300px",
                  componentCreated: () => {
                    result[name] = "created";
                    done();
                  },
                  componentFailed: (e) => {
                    result[name] = e.getParameter("reason").message;
                    done();
                  },
                });
              // rendered in this order: the first one starts the load
              new VBox({
                items: [
                  control("down", "/sap/bc/z2ui5_down"),
                  control("ok", "/sap/bc/z2ui5"),
                ],
              }).placeAt("area");
            },
          ),
        );
      }),
  );

  expect(result.down).toContain("/sap/bc/z2ui5_down?z2ui5-bundle");
  expect(result.ok).toBe("created");
  await expect(postButtons(page)).toHaveCount(1);
  expect(bundles).toEqual(["/sap/bc/z2ui5_down", "/sap/bc/z2ui5"]);
});
