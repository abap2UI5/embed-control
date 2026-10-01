// Builds the branches abap2UI5/samples-embed-control delivers: the examples
// of this repository the way apps take @abap2ui5/embed-control from npm - as
// UI5 projects, and built into BSPs to install with abapGit and try the
// control on a real system. No copy of the abap2UI5 frontend anywhere: the
// control loads it from the system's /sap/bc/z2ui5?z2ui5-bundle, as in any
// other app.
//
//   ABAP2UI5_DIR=../abap2UI5 npm run bsp                  the control of this checkout
//   ABAP2UI5_DIR=../abap2UI5 npm run bsp -- --from-npm    the control from npm
//
// The trees land in the git-ignored out/<branch>/ and are everything the
// branches carry. out/standard/ - any abap2UI5 system:
//   freestyle/       examples/freestyle as git has it, without ui5-1.71.yaml
//                    (the second UI5 release of the e2e tests): a UI5
//                    freestyle app with the package as an npm dependency
//   fiori-elements/  examples/fiori-elements: a Fiori elements app for OData
//                    V4 with the control in a custom section of its object
//                    page. No BSP of it - a Fiori elements app needs its
//                    OData service, which the example mocks and a system does
//                    not have
//   fiori-elements-v2/
//                    examples/fiori-elements-v2: a Fiori elements app for
//                    OData V2 with the control in an extension of its object
//                    page, and in abap/ the RAP service it reads. Its BSP is
//                    on the branch rap, with the service
//   card/            examples/card: a UI Integration Card for SAP Build Work
//                    Zone that runs any abap2UI5 app, its `ui5 build` output
//                    the card. No BSP of it either - a card is deployed to
//                    its host, not to the ABAP system
//   src/             the package and the BSP Z2UI5_HOST - what abapGit pulls:
//                    freestyle/webapp plus the control in
//                    thirdparty/z2ui5/embed/, where `ui5 build` puts it in
//                    any app that names the package under includeDependency.
//                    Neither is patched
//   .abapgit.xml, README.md (delivery/README.md), LICENSE
// out/rap/ - a system with RAP and OData V2 (SAP S/4HANA 2020 and later):
//   src/01/          examples/fiori-elements-v2/abap: the RAP service of the
//                    Fiori elements app for OData V2 and the abap2UI5 app it
//                    starts, as git has them
//   src/02/          the BSP Z2UI5_HOST_FE: fiori-elements-v2/webapp without
//                    its mock service, the control in thirdparty/z2ui5/embed/
//                    as above - and starting Z2UI5_CL_EMBED_COUNTRY of src/01
//                    instead of the hello world app, the one patch of an
//                    example (the UI5 project runs locally too, where only
//                    abap2UI5's own apps exist)
//   .abapgit.xml, README.md, LICENSE
// frontend_deploy.yaml writes them into samples-embed-control's main as
// result/<branch>, and the deliver workflow over there makes the branches.
//
// Where the control comes from:
//   default     packages/embed-control of this checkout - the pull-request
//               check (ci.yaml, job bsp): does this commit still build?
//   --from-npm  the registry, in the version packages/embed-control/package.json
//               names, installed with npm like in any app - the delivery. So
//               the branches carry the published package and never a state
//               of main that npm does not have, and src/ has the control
//               freestyle/ gets with `npm install`.
//
// The BSPs are made by abap2UI5's own tools, the ones that build its frontend
// BSP for abap2UI5/frontend, taken from the checkout ABAP2UI5_DIR names:
//   tools/app2bsp          webapp -> BSP pages (lines a page can carry, the
//                          page directory, the ui5_ui5 and bsp nodes)
//   tools/bsp_rename       Z2UI5 -> Z2UI5_HOST (BSP, nodes, file names)
//   tools/check-pages.mjs  the page invariants, on the result

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(root, "out");

// the one place of the control in the app - the package serves it there (its
// ui5.yaml) and the app registers it there (its manifest); if either moves,
// this build has to follow instead of delivering a page that finds nothing
const THIRDPARTY = "thirdparty/z2ui5/embed/";

// The examples, delivered under their names in examples/, without what of
// them only this repository's tests use.
const EXAMPLES = ["freestyle", "fiori-elements", "fiori-elements-v2", "card"];
const TESTS_ONLY = { freestyle: ["ui5-1.71.yaml"] };

// What delivery/README.md shows of the examples besides the three places
// every one of them takes the package in (package.json, ui5.yaml,
// manifest.json - checked for all): where each places the control. If one of
// them moves, the README points at nothing - so the build fails instead.
const SHOWN = {
  freestyle: [["webapp/view/Main.view.xml", 'xmlns:z2ui5="z2ui5.embed"']],
  "fiori-elements": [
    ["webapp/manifest.json", '"template": "demo.fe.ext.Abap2UI5Section"'],
    ["webapp/ext/Abap2UI5Section.fragment.xml", 'xmlns:z2ui5="z2ui5.embed"'],
  ],
  "fiori-elements-v2": [
    ["webapp/manifest.json", '"AfterFacet|Countries|General"'],
    ["webapp/manifest.json", '"/sap/opu/odata/sap/Z2UI5_UI_EMBED_COUNTRY_O2/"'],
    ["webapp/ext/Abap2UI5Section.fragment.xml", 'xmlns:z2ui5="z2ui5.embed"'],
    ["abap/z2ui5_ui_embed_country.srvd.srvdsrv", "as Countries"],
    ["abap/z2ui5_cl_embed_country.clas.abap", "t_comp_params"],
  ],
  card: [
    ["webapp/manifest.json", '"type": "Component"'],
    ["webapp/manifest.json", '"destinations"'],
    ["webapp/Component.js", 'resolveDestination("abap2UI5")'],
    ["webapp/view/Card.view.xml", 'xmlns:z2ui5="z2ui5.embed"'],
  ],
};

// The branches. Each is one abapGit repository with its BSP in src/02; the
// deployment identity of a BSP - its name, the SICF nodes
// /sap/bc/ui5_ui5/sap/<name> and /sap/bc/bsp/sap/<name> - is its own, so it
// installs next to the Z2UI5 BSP of abap2UI5/frontend, and next to the other
// branch, without touching either.
const BRANCHES = {
  standard: {
    examples: EXAMPLES,
    abapgit: "abap2UI5-samples-embed-control",
    devc: "abap2UI5 - embed control example",
    bsp: {
      example: "freestyle",
      name: "z2ui5_host",
      wapa: "abap2UI5 embed control example (generated)",
      devc: "abap2UI5 - embed control example, BSP",
      icf: "abap2UI5 - embed control example",
    },
  },
  rap: {
    examples: [],
    abapgit: "abap2UI5-samples-embed-control-rap",
    devc: "abap2UI5 - embed control example, RAP",
    // the RAP service and the app the BSP starts, as git has them - with
    // their own package.devc.xml, so abapGit makes the subpackage of them
    abap: { example: "fiori-elements-v2", dir: "abap" },
    bsp: {
      example: "fiori-elements-v2",
      name: "z2ui5_host_fe",
      wapa: "abap2UI5 embed control - Fiori elements V2",
      devc: "abap2UI5 - embed control example, Fiori elements BSP",
      icf: "abap2UI5 - embed control, Fiori elements V2",
      // the mock of the RAP service: the system has the real one
      leaveOut: ["localService"],
      // the app the BSP runs is the one src/01 brings
      patch: [
        "ext/Abap2UI5Section.js",
        'const APP = "Z2UI5_CL_UI5_APP_HI_WORLD";',
        'const APP = "Z2UI5_CL_EMBED_COUNTRY";',
      ],
    },
  },
};

const workspace = join(root, "packages", "embed-control");
const pkg = JSON.parse(readFileSync(join(workspace, "package.json"), "utf8"));

const args = process.argv.slice(2);
const fromNpm = args.includes("--from-npm");
// The real path: bsp_rename runs only as the main module, which it decides by
// comparing its own path with argv[1] - called through a symlink, the two
// differ and the tool does nothing, without a word.
const a2dir = process.env.ABAP2UI5_DIR && resolve(process.env.ABAP2UI5_DIR);
const a2 = a2dir && existsSync(a2dir) ? realpathSync(a2dir) : a2dir;
const TOOLS = [
  "tools/app2bsp/run.js",
  "tools/bsp_rename/rename-bsp.mjs",
  "tools/check-pages.mjs",
];
if (args.some((arg) => arg !== "--from-npm")) {
  console.error("build-bsp: the only option is --from-npm");
  process.exit(1);
}
if (!a2 || TOOLS.some((tool) => !existsSync(join(a2, tool)))) {
  console.error(
    "build-bsp: set ABAP2UI5_DIR to an abap2UI5 checkout with " +
      TOOLS.join(", "),
  );
  process.exit(1);
}

const abapgitXml = (name) => `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
 <asx:values>
  <DATA>
   <NAME>${name}</NAME>
   <MASTER_LANGUAGE>E</MASTER_LANGUAGE>
   <STARTING_FOLDER>/src/</STARTING_FOLDER>
   <FOLDER_LOGIC>PREFIX</FOLDER_LOGIC>
  </DATA>
 </asx:values>
</asx:abap>
`;

const packageXml = (text) => `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_DEVC" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <DEVC>
    <CTEXT>${text}</CTEXT>
   </DEVC>
  </asx:values>
 </asx:abap>
</abapGit>
`;

// Every patch below is an assumption about a file this repository or
// abap2UI5's tools write. If one stops holding, carrying on would deliver a
// branch that is consistent with its sources and still wrong - so it fails.
function mustReplace(file, from, to) {
  const text = readFileSync(file, "utf8");
  if (!text.includes(from)) {
    throw new Error(`build-bsp: '${from}' not found in ${file}`);
  }
  writeFileSync(file, text.split(from).join(to));
}
function mustContain(file, text) {
  if (!readFileSync(file, "utf8").includes(text)) {
    throw new Error(`build-bsp: '${text}' not found in ${file}`);
  }
}

// Quiet on success, never on failure: the discarded output is the only thing
// that says WHY a step failed.
function run(command, commandArgs, cwd) {
  try {
    return execFileSync(command, commandArgs, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    process.stderr.write(String(error.stdout ?? ""));
    process.stderr.write(String(error.stderr ?? ""));
    throw error;
  }
}
const node = (nodeArgs, cwd) => run(process.execPath, nodeArgs, cwd);

// npm as the one that started this script (npm_execpath, set by `npm run`),
// run by this node: no shell, and no "npm" to look up on PATH - on Windows
// that is npm.cmd, which a shell-less spawn refuses since Node 18.20/20.12.
// Started otherwise, the npm on PATH.
const npm = process.env.npm_execpath
  ? [process.execPath, process.env.npm_execpath]
  : ["npm"];
const runNpm = (args, cwd) => run(npm[0], [...npm.slice(1), ...args], cwd);

// An example as git has it - so never a local .env, node_modules or dist/ -
// without what only this repository's tests use
function copyExample(name, dest) {
  const example = `examples/${name}`;
  const files = run("git", ["ls-files", "-z", "--", example], root)
    .split("\0")
    .filter(Boolean);
  if (!files.length) {
    throw new Error(`build-bsp: git has no file in ${example}`);
  }
  for (const file of files) {
    const path = relative(example, file);
    if ((TESTS_ONLY[name] || []).includes(path)) continue;
    mkdirSync(dirname(join(dest, path)), { recursive: true });
    cpSync(join(root, file), join(dest, path));
  }
}

// The places delivery/README.md shows of an example, one each
function checkShown(name, dir) {
  const { dependencies = {} } = JSON.parse(
    readFileSync(join(dir, "package.json"), "utf8"),
  );
  if (!dependencies[pkg.name]) {
    throw new Error(`build-bsp: ${pkg.name} is no dependency of ${name}/`);
  }
  mustContain(join(dir, "ui5.yaml"), `- "${pkg.name}"`);
  mustContain(
    join(dir, "webapp", "manifest.json"),
    `"z2ui5.embed": "./${THIRDPARTY}"`,
  );
  for (const [file, text] of SHOWN[name]) mustContain(join(dir, file), text);
}

// The package the way any app gets it: npm install from the registry, in a
// folder of its own. The version main names - after a publish, the version
// just published (publish.yaml delivers right after it).
function installFromNpm(work) {
  const spec = `${pkg.name}@${pkg.version}`;
  const dir = join(work, "npm");
  mkdirSync(dir);
  writeFileSync(join(dir, "package.json"), '{ "private": true }\n');
  try {
    runNpm(
      [
        "install",
        spec,
        "--no-save",
        "--no-package-lock",
        "--no-audit",
        "--no-fund",
        "--ignore-scripts",
        // a version published a minute ago is not in a cached packument
        "--prefer-online",
      ],
      dir,
    );
  } catch {
    throw new Error(`build-bsp: npm has no ${spec} - is it published?`);
  }
  const installed = join(dir, "node_modules", pkg.name);
  const { version } = JSON.parse(
    readFileSync(join(installed, "package.json"), "utf8"),
  );
  if (version !== pkg.version) {
    throw new Error(`build-bsp: npm installed ${version} for ${spec}`);
  }
  return installed;
}

// One BSP: the example's webapp plus the control, through app2bsp, into
// tree/src/02, renamed to the BSP's own name. In a folder of its own under
// work/, because app2bsp writes to a fixed place relative to its cwd.
function buildBsp(tree, work, control, bsp) {
  const dir = join(work, `bsp-${bsp.name}`);
  // app2bsp's working-directory contract: .github/app2bsp next to
  // frontend/app/webapp, output in src/02
  cpSync(join(a2, "tools", "app2bsp"), join(dir, ".github", "app2bsp"), {
    recursive: true,
  });
  const source = join(work, "examples", bsp.example, "webapp");
  const left = (bsp.leaveOut || []).map((path) => join(source, path));
  for (const path of left) {
    if (!existsSync(path)) {
      throw new Error(
        `build-bsp: ${relative(work, path)} to leave out is gone`,
      );
    }
  }
  const webapp = join(dir, "frontend", "app", "webapp");
  cpSync(source, webapp, {
    recursive: true,
    filter: (path) => !left.some((l) => path === l || path.startsWith(l + "/")),
  });
  if (bsp.patch) {
    const [file, from, to] = bsp.patch;
    mustReplace(join(webapp, file), from, to);
  }
  cpSync(join(control, "src"), join(webapp, THIRDPARTY), { recursive: true });
  node([join(".github", "app2bsp", "run.js")], dir);

  const src02 = join(tree, "src", "02");
  mkdirSync(dirname(src02), { recursive: true });
  cpSync(join(dir, "src", "02"), src02, { recursive: true });

  // The texts an installer sees next to the objects, before the rename, which
  // leaves them alone: they say "abap2UI5 frontend", and this is not it.
  mustReplace(
    join(src02, "z2ui5.wapa.xml"),
    "<TEXT>abap2UI5 frontend (generated)</TEXT>",
    `<TEXT>${bsp.wapa}</TEXT>`,
  );
  mustReplace(
    join(src02, "package.devc.xml"),
    "<CTEXT>abap2UI5</CTEXT>",
    `<CTEXT>${bsp.devc}</CTEXT>`,
  );

  node(
    [
      join(a2, "tools", "bsp_rename", "rename-bsp.mjs"),
      bsp.name,
      "--yes",
      "--dir",
      join("src", "02"),
    ],
    tree,
  );

  // bsp_rename renames every z2ui5 token of the page directory, the z2ui5
  // segment of the pages' own paths included, and leaves the page files and
  // their content alone - so the directory would list pages under
  // thirdparty/<name>/ that the files and the manifest place under
  // thirdparty/z2ui5/. Put the paths back (abap2UI5's own BSP has no page
  // with z2ui5 in its path, so the tool never met one).
  const pages = join(src02, `${bsp.name}.wapa.xml`);
  const renamed = THIRDPARTY.replace("z2ui5", bsp.name);
  mustReplace(pages, renamed, THIRDPARTY);
  mustReplace(pages, renamed.toUpperCase(), THIRDPARTY.toUpperCase());

  // the description SICF shows for the two nodes, which the rename leaves
  // alone as well
  const nodes = readdirSync(src02).filter((f) => f.endsWith(".sicf.xml"));
  if (nodes.length !== 2) {
    throw new Error(`build-bsp: 2 ICF nodes expected, found ${nodes.length}`);
  }
  for (const file of nodes) {
    mustReplace(
      join(src02, file),
      "<ICF_DOCU>abap2UI5 - Frontend</ICF_DOCU>",
      `<ICF_DOCU>${bsp.icf}</ICF_DOCU>`,
    );
  }
}

// Built in a folder of its own and copied to out/ once complete, so a failed
// build leaves no tree behind that looks like a result.
rmSync(outRoot, { recursive: true, force: true });
const work = mkdtempSync(join(tmpdir(), "embed-control-bsp-"));
try {
  for (const name of EXAMPLES) {
    copyExample(name, join(work, "examples", name));
    checkShown(name, join(work, "examples", name));
  }

  const control = fromNpm ? installFromNpm(work) : workspace;
  mustContain(join(control, "ui5.yaml"), `/${THIRDPARTY}: ./src/`);

  // check-pages reads its trees from the out/ next to itself
  const checker = join(work, "check", "tools");
  mkdirSync(checker, { recursive: true });
  cpSync(join(a2, "tools", "check-pages.mjs"), join(checker, "check.mjs"));

  // The README every copy of a branch carries - samples-embed-control's
  // main has the same text without this first line (frontend_deploy.yaml).
  const readme =
    "> ⚙️ **Generated branch** - built in " +
    "[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) " +
    "from its examples and delivered by its `frontend_deploy` workflow; " +
    "`VERSION` names the commit and the version of the control. Do not " +
    "change it here.\n\n" +
    readFileSync(join(root, "delivery", "README.md"), "utf8");

  for (const [branch, def] of Object.entries(BRANCHES)) {
    const tree = join(work, "out", branch);
    for (const name of def.examples) {
      cpSync(join(work, "examples", name), join(tree, name), {
        recursive: true,
      });
    }
    if (def.abap) {
      const abap = join(work, "examples", def.abap.example, def.abap.dir);
      mustContain(join(abap, "package.devc.xml"), "<CTEXT>");
      cpSync(abap, join(tree, "src", "01"), { recursive: true });
    }
    buildBsp(tree, work, control, def.bsp);
    writeFileSync(join(tree, ".abapgit.xml"), abapgitXml(def.abapgit));
    writeFileSync(join(tree, "src", "package.devc.xml"), packageXml(def.devc));

    cpSync(join(tree, "src"), join(checker, "out", branch, "src"), {
      recursive: true,
    });
    node([join(checker, "check.mjs"), branch], work);

    writeFileSync(join(tree, "README.md"), readme);
    cpSync(join(root, "LICENSE"), join(tree, "LICENSE"));
  }

  cpSync(join(work, "out"), outRoot, { recursive: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}

for (const [branch, def] of Object.entries(BRANCHES)) {
  const parts = [
    ...def.examples.map((e) => `${e}/`),
    ...(def.abap ? [`the ABAP of ${def.abap.example}/${def.abap.dir}`] : []),
    `BSP ${def.bsp.name.toUpperCase()}`,
  ];
  console.log(`build-bsp: out/${branch}/ - ${parts.join(", ")}`);
}
console.log(
  `build-bsp: ${pkg.name}@${pkg.version} ` +
    (fromNpm ? "from npm" : "of this checkout"),
);
