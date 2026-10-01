// The control, run in Node: its sap.ui.define factory with stubs for what it
// takes from UI5, in a page of its own - a window with a location, a document
// that keeps the scripts it is given, a loader that answers for z2ui5/embed.
// No browser and no backend. What is pinned here is what the control decides
// before either is involved - which endpoints it accepts and what URL it
// requests, what it hands the component, when it starts, restarts and gives
// up - case by case, in milliseconds; the examples' Playwright tests in
// abap2UI5/samples-embed-control run the shipped control against a live
// abap2UI5 for the rest.
//
//   npm test

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SOURCE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages/embed-control/src/Container.js",
);
const PAGE = "https://host.example/app/index.html";
const APP = "ZCL_MY_APP";
// what the bundle's z2ui5/embed module hands over
const EMBED = {
  componentData: {
    embedded: true,
    nodePath: "/sap/bc/z2ui5",
    ccResourceRoot: "/sap/bc/ui5_ui5/sap/z2ui5_cci",
  },
};

// Loads the control into a fresh page. `page` records what the control does
// to it: the <script> elements in its head (`scripts`), the components asked
// for (`created`), what was logged (`logged`); `page.embed` is what the
// loader answers for z2ui5/embed - null until "the bundle has run".
function load({ href = PAGE, hostGlobal } = {}) {
  const page = {
    scripts: [],
    created: [],
    components: [],
    logged: [],
    embed: null,
  };
  const document = {
    head: { appendChild: (script) => page.scripts.push(script) },
    createElement: (tag) => ({
      tag,
      remove() {
        page.scripts.splice(page.scripts.indexOf(this), 1);
      },
    }),
  };
  const sandbox = { URL, setTimeout, document, location: new URL(href) };
  sandbox.window = sandbox;
  if (hostGlobal) sandbox.z2ui5 = hostGlobal;
  let deps, factory;
  sandbox.sap = {
    ui: {
      define: (d, f) => {
        deps = d;
        factory = f;
      },
      require: Object.assign(
        (name) => (name === "z2ui5/embed" ? page.embed : undefined),
        { toUrl: (name) => `./${name}` },
      ),
    },
  };
  vm.runInNewContext(readFileSync(SOURCE, "utf8"), sandbox, {
    filename: SOURCE,
  });
  const stubs = {
    "sap/ui/core/Control": {
      // like UI5 1.x: the class and its renderer go onto the window as well
      extend(name, info) {
        function Container() {}
        Object.assign(Container.prototype, info);
        const path = name.split(".");
        let holder = sandbox;
        for (const key of path.slice(0, -1)) {
          holder = holder[key] = holder[key] || {};
        }
        holder[path.at(-1)] = Container;
        holder[`${path.at(-1)}Renderer`] = info.renderer;
        return Container;
      },
    },
    "sap/ui/core/Component": {
      getOwnerComponentFor: () => null,
      create(options) {
        page.created.push(options);
        const component = {
          options,
          destroyed: false,
          destroy() {
            this.destroyed = true;
          },
        };
        page.components.push(component);
        if (!page.holdCreate) return Promise.resolve(component);
        // the test releases the component itself (page.release)
        return new Promise((resolve) => {
          page.release = () => resolve(component);
        });
      },
    },
    "sap/ui/core/ComponentContainer": function ComponentContainer(settings) {
      this.settings = settings;
    },
    "sap/ui/dom/includeStylesheet": () => {},
    "sap/base/Log": { error: (...args) => page.logged.push(args) },
  };
  const Container = factory(
    ...deps.map((dep) => {
      if (!(dep in stubs)) throw new Error(`no stub for ${dep}`);
      return stubs[dep];
    }),
  );
  return { Container, page, sandbox };
}

// A control, with the part of ManagedObject it uses stubbed: properties,
// the hidden aggregation, invalidation, the DOM reference, the events.
function control(Container, settings = {}) {
  const props = {
    app: "",
    endpoint: "",
    params: null,
    width: "100%",
    height: "100%",
    visible: true,
  };
  const c = Object.create(Container.prototype);
  Object.assign(c, {
    props,
    sets: [],
    events: [],
    aggregations: {},
    invalidated: 0,
    dom: null,
    getId: () => "host---main--embed",
    getProperty: (name) => props[name],
    setProperty(name, value, suppressInvalidate) {
      props[name] = value;
      c.sets.push([name, value, suppressInvalidate === true]);
      return c;
    },
    invalidate() {
      c.invalidated++;
    },
    getApp: () => props.app,
    getEndpoint: () => props.endpoint,
    getParams: () => props.params,
    getVisible: () => props.visible,
    getWidth: () => props.width,
    getHeight: () => props.height,
    getDomRef: () => c.dom,
    getAggregation: (name) => c.aggregations[name] || null,
    setAggregation(name, value) {
      c.aggregations[name] = value;
      return c;
    },
    destroyAggregation(name) {
      if (c.aggregations[name]) c.aggregations[name].destroyed = true;
      delete c.aggregations[name];
      return c;
    },
    fireComponentCreated: (parameters) =>
      c.events.push(["componentCreated", parameters]),
    fireComponentFailed: (parameters) =>
      c.events.push(["componentFailed", parameters]),
  });
  for (const [name, value] of Object.entries(settings)) {
    const setter = `set${name[0].toUpperCase()}${name.slice(1)}`;
    if (typeof c[setter] === "function") c[setter](value);
    else props[name] = value;
  }
  return c;
}

// a few macrotasks, for the promise chains and the setTimeout of the load
const settle = () => new Promise((resolve) => setTimeout(resolve, 10));

// one rendering of the control, settled
async function render(c) {
  c.onBeforeRendering();
  await settle();
}

const requested = (page) => page.scripts.map((script) => script.src);
const events = (c) => c.events.map(([name]) => name);
const failure = (c) => {
  const failed = c.events.find(([name]) => name === "componentFailed");
  return failed ? failed[1].reason.message : null;
};
const container = (c) => c.aggregations._container;
// an object made in the control's page has that page's Object.prototype -
// compared as data, not by its prototype
const plain = (value) => JSON.parse(JSON.stringify(value));

// the bundle arrives: the script runs and defines z2ui5/embed
async function bundleArrives(page, embed = EMBED) {
  page.embed = embed;
  page.scripts.at(-1).onload();
  await settle();
}

test("the default endpoint is /sap/bc/z2ui5 on the page's origin", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
  assert.deepEqual(events(c), []);
});

test("an endpoint on this server is requested as the URL the browser resolves it to", async () => {
  const cases = {
    "/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5/": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5//": "https://host.example/sap/bc/z2ui5",
    "sap/bc/z2ui5": "https://host.example/app/sap/bc/z2ui5",
    "../other/node": "https://host.example/other/node",
    "/": "https://host.example/",
    " /sap/bc/z2ui5 ": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5?": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z2ui5#": "https://host.example/sap/bc/z2ui5",
    "/sap/bc/z 2ui5": "https://host.example/sap/bc/z%202ui5",
    "https://host.example/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    "HTTPS://HOST.example/sap/bc/z2ui5": "https://host.example/sap/bc/z2ui5",
    // credentials are no part of what is requested
    "https://user:secret@host.example/sap/bc/z2ui5":
      "https://host.example/sap/bc/z2ui5",
  };
  for (const [endpoint, url] of Object.entries(cases)) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    await render(c);
    assert.deepEqual(requested(page), [`${url}?z2ui5-bundle`], endpoint);
    await bundleArrives(page);
    assert.equal(page.created[0].componentData.endpoint, url, endpoint);
  }
});

test("an endpoint that is no path on this server loads nothing and fails the start", async () => {
  const endpoints = [
    "https://evil.example/sap/bc/z2ui5",
    "http://host.example/sap/bc/z2ui5",
    "https://host.example:8443/sap/bc/z2ui5",
    "https://host.example.evil.example/sap/bc/z2ui5",
    "//evil.example/sap/bc/z2ui5",
    "/\\evil.example/sap/bc/z2ui5",
    "\\\\evil.example/sap/bc/z2ui5",
    // the URL parser drops tabs, line breaks and leading spaces
    "/\t/evil.example/sap/bc/z2ui5",
    "/\n/evil.example/sap/bc/z2ui5",
    "/\r/evil.example/sap/bc/z2ui5",
    " //evil.example/sap/bc/z2ui5",
    // "." and ".." segments go when the URL is parsed: a path //evil.example
    "/.//evil.example/sap/bc/z2ui5",
    "/sap/..//evil.example/sap/bc/z2ui5",
    "/%2e//evil.example/sap/bc/z2ui5",
    "/.\\/evil.example/sap/bc/z2ui5",
    "..//evil.example/sap/bc/z2ui5",
    // no path on a server at all
    "blob:https://host.example/0f3a",
    "javascript:alert(1)",
    "data:text/javascript,1",
    "ftp://host.example/sap/bc/z2ui5",
    "about:blank",
  ];
  for (const endpoint of endpoints) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    c.onBeforeRendering();
    // asynchronously - never inside the rendering
    assert.deepEqual(events(c), [], endpoint);
    await settle();
    assert.deepEqual(requested(page), [], endpoint);
    assert.deepEqual(events(c), ["componentFailed"], endpoint);
    assert.match(
      failure(c),
      /is not a path on this server/,
      JSON.stringify(endpoint),
    );
  }
});

test("a query or a fragment is refused with its own reason", async () => {
  for (const endpoint of [
    "/sap/bc/z2ui5?sap-client=100",
    "/sap/bc/z2ui5#/app/ZCL_OTHER",
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]) {
    const { Container, page } = load();
    const c = control(Container, { app: APP, endpoint });
    await render(c);
    assert.deepEqual(requested(page), [], endpoint);
    assert.match(failure(c), /carries a query or a fragment/, endpoint);
  }
});

test("a page without an origin - file: - has no path on this server", async () => {
  const { Container, page } = load({ href: "file:///C:/pages/index.html" });
  const c = control(Container, { app: APP, endpoint: "/sap/bc/z2ui5" });
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.match(failure(c), /is not a path on this server/);
});

test("a refused start is not repeated by a rendering, only by restart( ) or a change", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP, endpoint: "//evil.example/x" });
  await render(c);
  await render(c);
  assert.deepEqual(events(c), ["componentFailed"]);
  c.restart();
  await render(c);
  assert.deepEqual(events(c), ["componentFailed", "componentFailed"]);
  c.setEndpoint("/sap/bc/z2ui5");
  await render(c);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
});

test("nothing starts for an empty app or an invisible control", async () => {
  const { Container, page } = load();
  const c = control(Container);
  await render(c);
  c.setApp(APP);
  c.props.visible = false;
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.deepEqual(events(c), []);
  c.props.visible = true;
  await render(c);
  assert.equal(requested(page).length, 1);
});

test("one start is the class, the endpoint as requested and the params as the backend gets them", () => {
  const { Container } = load();
  const key = (settings) =>
    control(Container, { app: APP, ...settings })._startKey();
  const base = key({ endpoint: "/sap/bc/z2ui5", params: { a: "1" } });
  for (const endpoint of [
    "",
    "/sap/bc/z2ui5/",
    "../sap/bc/z2ui5",
    "https://host.example/sap/bc/z2ui5",
  ]) {
    assert.equal(key({ endpoint, params: { a: "1" } }), base, endpoint);
  }
  for (const params of [
    { a: ["1"] },
    { a: "1", app_start: "ZCL_OTHER" },
    { a: "1", b: null, c: undefined },
    { a: 1 },
  ]) {
    assert.equal(key({ endpoint: "", params }), base, JSON.stringify(params));
  }
  assert.equal(
    key({ endpoint: "", params: { b: "2", a: "1" } }),
    key({ endpoint: "", params: { a: "1", b: "2" } }),
  );
  assert.notEqual(key({ endpoint: "/sap/bc/z2ui5_other" }), base);
  assert.notEqual(key({ endpoint: "", params: { a: "2" } }), base);
  assert.notEqual(key({ endpoint: "", params: { a: ["1", "1"] } }), base);
  assert.notEqual(key({ app: "ZCL_OTHER", params: { a: "1" } }), base);
});

test("the component gets the bundle's data, the params in the launchpad's shape and the endpoint", async () => {
  const { Container, page } = load();
  const c = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5/",
    params: {
      customer: "4711",
      ids: ["1", 2],
      none: null,
      gone: undefined,
      flag: false,
      deep: { a: 1 },
      list: [["x"]],
      app_start: "ZCL_OTHER",
      empty: "",
    },
  });
  await render(c);
  await bundleArrives(page);
  assert.deepEqual(plain(page.created), [
    {
      name: "z2ui5",
      manifest: true,
      handleValidation: true,
      componentData: {
        embedded: true,
        nodePath: "/sap/bc/z2ui5",
        ccResourceRoot: "/sap/bc/ui5_ui5/sap/z2ui5_cci",
        startupParameters: {
          app_start: [APP],
          customer: ["4711"],
          deep: ['{"a":1}'],
          empty: [""],
          flag: ["false"],
          ids: ["1", "2"],
          list: ['["x"]'],
        },
        endpoint: "https://host.example/sap/bc/z2ui5",
      },
    },
  ]);
  assert.deepEqual(events(c), ["componentCreated"]);
  assert.equal(c.events[0][1].component.options, page.created[0]);
  const settings = container(c).settings;
  assert.equal(settings.component, c.events[0][1].component);
  assert.deepEqual(plain({ ...settings, component: null }), {
    lifecycle: "Container",
    propagateModel: false,
    width: "100%",
    height: "100%",
    component: null,
  });
});

test("the bundle is loaded once, from the first control's endpoint, and shared", async () => {
  const { Container, page } = load();
  const first = control(Container, { app: APP });
  const second = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5_other",
  });
  await render(first);
  await render(second);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
  await bundleArrives(page);
  assert.deepEqual(events(first), ["componentCreated"]);
  assert.deepEqual(events(second), ["componentCreated"]);
  // each sends its roundtrips to its own endpoint
  assert.deepEqual(
    page.created.map((options) => options.componentData.endpoint),
    [
      "https://host.example/sap/bc/z2ui5",
      "https://host.example/sap/bc/z2ui5_other",
    ],
  );
  // a third control, later, takes the frontend that is there
  const third = control(Container, { app: APP });
  await render(third);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(third), ["componentCreated"]);
});

test("a bundle the host loaded itself is not loaded again", async () => {
  const { Container, page } = load();
  page.embed = EMBED;
  const c = control(Container, { app: APP });
  await render(c);
  assert.deepEqual(requested(page), []);
  assert.deepEqual(events(c), ["componentCreated"]);
  assert.equal(page.created[0].componentData.nodePath, "/sap/bc/z2ui5");
});

test("a page or a script that defines no z2ui5/embed is no frontend", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  const script = page.scripts[0];
  // the script ran - a page without nosniff - but defined nothing
  await bundleArrives(page, null);
  assert.deepEqual(events(c), ["componentFailed"]);
  assert.equal(
    failure(c),
    "no abap2UI5 frontend at https://host.example/sap/bc/z2ui5?z2ui5-bundle" +
      " - is the service active, the session valid and abap2UI5 recent enough?",
  );
  // ... and the failed script is gone
  assert.equal(page.scripts.includes(script), false);
});

test("a failed load is forgotten; a control that shared another's failed load tries its own once", async () => {
  const { Container, page } = load();
  const first = control(Container, { app: APP });
  const second = control(Container, {
    app: APP,
    endpoint: "/sap/bc/z2ui5_other",
  });
  await render(first);
  await render(second);
  // the backend is down
  page.scripts[0].onerror();
  await settle();
  assert.deepEqual(events(first), ["componentFailed"]);
  assert.match(
    failure(first),
    /no abap2UI5 frontend at https:\/\/host.example\/sap\/bc\/z2ui5\?z2ui5-bundle/,
  );
  // the second control asks its own endpoint - the first load is gone
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5_other?z2ui5-bundle",
  ]);
  assert.deepEqual(events(second), []);
  // which fails too: tried once, no third request
  page.scripts[0].onerror();
  await settle();
  assert.deepEqual(events(second), ["componentFailed"]);
  assert.match(failure(second), /z2ui5_other\?z2ui5-bundle/);
  assert.deepEqual(requested(page), []);
  // a rendering repeats neither start; restart( ) asks the backend again
  await render(first);
  await render(second);
  assert.deepEqual(requested(page), []);
  first.restart();
  await render(first);
  assert.deepEqual(requested(page), [
    "https://host.example/sap/bc/z2ui5?z2ui5-bundle",
  ]);
  await bundleArrives(page);
  assert.deepEqual(events(first), ["componentFailed", "componentCreated"]);
  // and the second control, restarted, takes the frontend that is there now
  second.restart();
  await render(second);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(second), ["componentFailed", "componentCreated"]);
});

test("a change of app, endpoint or params replaces the component - and what a start under way still creates is destroyed", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP, params: { a: "1" } });
  await render(c);
  await bundleArrives(page);
  const first = c.events[0][1].component;
  assert.equal(container(c).settings.component, first);

  // the same params in another object: no restart
  c.setParams({ a: "1" });
  assert.equal(container(c).settings.component, first);
  assert.equal(c.invalidated, 0);

  // other params: the component goes, the next rendering starts anew
  c.setParams({ a: "2" });
  assert.equal(container(c), undefined);
  assert.equal(c.invalidated, 1);
  await render(c);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(c), ["componentCreated", "componentCreated"]);
  assert.deepEqual(plain(page.created[1].componentData.startupParameters), {
    a: ["2"],
    app_start: [APP],
  });

  // the params object changed in place and handed over again
  const params = { a: "3" };
  c.setParams(params);
  await render(c);
  params.a = "4";
  c.setParams(params);
  await render(c);
  assert.deepEqual(plain(page.created.at(-1).componentData.startupParameters), {
    a: ["4"],
    app_start: [APP],
  });

  // a change while the component is still being created
  page.holdCreate = true;
  c.setApp("ZCL_OTHER");
  await render(c);
  assert.equal(
    page.created.at(-1).componentData.startupParameters.app_start[0],
    "ZCL_OTHER",
  );
  const created = c.events.length;
  c.setEndpoint("/sap/bc/z2ui5_other");
  page.release();
  await settle();
  // destroyed, handed to nobody
  assert.equal(c.events.length, created);
  assert.equal(page.components.at(-1).destroyed, true);
  await render(c);
  page.release();
  await settle();
  assert.equal(c.events.length, created + 1);
  assert.equal(
    page.created.at(-1).componentData.endpoint,
    "https://host.example/sap/bc/z2ui5_other",
  );
});

test("restart( ) ends the running component and starts anew with the same values", async () => {
  const { Container, page } = load();
  const c = control(Container, { app: APP });
  await render(c);
  await bundleArrives(page);
  const first = container(c);
  c.restart();
  assert.equal(first.destroyed, true);
  assert.equal(container(c), undefined);
  await render(c);
  assert.equal(requested(page).length, 1);
  assert.deepEqual(events(c), ["componentCreated", "componentCreated"]);
  assert.notEqual(container(c), first);
});

test("a component that arrives after the control's end is destroyed", async () => {
  const { Container, page } = load();
  page.embed = EMBED;
  page.holdCreate = true;
  const c = control(Container, { app: APP });
  await render(c);
  c.exit();
  page.release();
  await settle();
  assert.deepEqual(events(c), []);
  assert.equal(page.components.length, 1);
  assert.equal(page.components[0].destroyed, true);
});

test("width and height go to the DOM, without a rendering", () => {
  const { Container } = load();
  const c = control(Container, { app: APP });
  c.dom = { style: {} };
  c.setHeight("500px").setWidth("50%");
  assert.deepEqual(c.sets.slice(-2), [
    ["height", "500px", true],
    ["width", "50%", true],
  ]);
  assert.deepEqual(c.dom.style, { height: "500px", width: "50%" });
  assert.equal(c.invalidated, 0);
  // not rendered yet: the property alone, for the first rendering
  c.dom = null;
  c.setHeight("300px");
  assert.equal(c.getHeight(), "300px");
});

test("a handler of componentCreated that throws is logged, not left as an unhandled rejection", async () => {
  const { Container, page } = load();
  page.embed = EMBED;
  const c = control(Container, { app: APP });
  c.fireComponentCreated = () => {
    throw new Error("host bug");
  };
  await render(c);
  assert.equal(page.logged.length, 1);
  assert.match(page.logged[0][0], /host---main--embed/);
  assert.match(page.logged[0][1], /host bug/);
});

test("the control leaves no z2ui5 global, and a host's own keeps what it held", () => {
  assert.equal("z2ui5" in load().sandbox, false);
  const host = { embed: { hostData: 1 }, other: 2 };
  assert.deepEqual(load({ hostGlobal: host }).sandbox.z2ui5, {
    embed: { hostData: 1 },
    other: 2,
  });
});
