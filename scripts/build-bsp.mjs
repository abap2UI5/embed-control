// Builds the branch abap2UI5/frontend-embed-control delivers: the example app
// of this repository the way an app takes @abap2ui5/embed-control from npm -
// as the UI5 project in app/, and built from it as the BSP Z2UI5_HOST, to
// install with abapGit and try the control on a real system. No copy of the
// abap2UI5 frontend in either: the control loads it from the system's
// /sap/bc/z2ui5?z2ui5-bundle, as in any other app.
//
//   ABAP2UI5_DIR=../abap2UI5 npm run bsp                  the control of this checkout
//   ABAP2UI5_DIR=../abap2UI5 npm run bsp -- --from-npm    the control from npm
//
// The tree lands in the git-ignored out/standard/ and is everything the
// branch carries:
//   app/          examples/host-app as git has it, without ui5-1.71.yaml (the
//                 second UI5 release of the e2e tests): a plain UI5 project
//                 with the package as an npm dependency
//   src/          the package and the BSP - what abapGit pulls: app/webapp
//                 plus the control in thirdparty/z2ui5/embed/, where
//                 `ui5 build` puts it in any app that names the package under
//                 includeDependency. Neither is patched
//   .abapgit.xml, README.md (delivery/README.md), LICENSE
// frontend_deploy.yaml writes it into frontend-embed-control's main as
// result/standard, and the deliver workflow over there makes the branch of it.
//
// Where the control comes from:
//   default     packages/embed-control of this checkout - the pull-request
//               check (ci.yaml, job bsp): does this commit still build?
//   --from-npm  the registry, in the version packages/embed-control/package.json
//               names, installed with npm like in any app - the delivery. So
//               the branch carries the published package and never a state
//               of main that npm does not have, and src/ has the control
//               app/ gets with `npm install`.
//
// The BSP is made by abap2UI5's own tools, the ones that build its frontend
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
const out = join(root, "out", "standard");

// The deployment identity: BSP Z2UI5_HOST with the SICF nodes
// /sap/bc/ui5_ui5/sap/z2ui5_host and /sap/bc/bsp/sap/z2ui5_host. Its own, so
// it installs next to the Z2UI5 BSP of abap2UI5/frontend without touching it.
const NAME = "z2ui5_host";

// the one place of the control in the app - the package serves it there (its
// ui5.yaml) and the app registers it there (its manifest); if either moves,
// this build has to follow instead of delivering a page that finds nothing
const THIRDPARTY = "thirdparty/z2ui5/embed/";

// the example, and what of it stays here: the 1.71 project of the e2e tests
const EXAMPLE = "examples/host-app";
const TESTS_ONLY = ["ui5-1.71.yaml"];

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

const ABAPGIT_XML = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
 <asx:values>
  <DATA>
   <NAME>abap2UI5-frontend-embed-control</NAME>
   <MASTER_LANGUAGE>E</MASTER_LANGUAGE>
   <STARTING_FOLDER>/src/</STARTING_FOLDER>
   <FOLDER_LOGIC>PREFIX</FOLDER_LOGIC>
  </DATA>
 </asx:values>
</asx:abap>
`;

const PACKAGE_XML = `\uFEFF<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="LCL_OBJECT_DEVC" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
   <DEVC>
    <CTEXT>abap2UI5 - embed control example</CTEXT>
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

// app/: the example as git has it - so never a local .env, node_modules or
// dist/ - without what only this repository's tests use
function copyExample(app) {
  const files = run("git", ["ls-files", "-z", "--", EXAMPLE], root)
    .split("\0")
    .filter(Boolean);
  if (!files.length) {
    throw new Error(`build-bsp: git has no file in ${EXAMPLE}`);
  }
  for (const file of files) {
    const path = relative(EXAMPLE, file);
    if (TESTS_ONLY.includes(path)) continue;
    mkdirSync(dirname(join(app, path)), { recursive: true });
    cpSync(join(root, file), join(app, path));
  }
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
    run(
      "npm",
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

// Built in a folder of its own and copied to out/standard/ once complete, so
// a failed build leaves no tree behind that looks like a result.
rmSync(out, { recursive: true, force: true });
const work = mkdtempSync(join(tmpdir(), "embed-control-bsp-"));
try {
  const tree = join(work, "standard");
  const app = join(tree, "app");
  copyExample(app);

  // What delivery/README.md shows of app/, one place each - if one of them
  // moves, the README would point at nothing
  const { dependencies = {} } = JSON.parse(
    readFileSync(join(app, "package.json"), "utf8"),
  );
  if (!dependencies[pkg.name]) {
    throw new Error(`build-bsp: ${pkg.name} is no dependency of app/`);
  }
  mustContain(join(app, "ui5.yaml"), `- "${pkg.name}"`);
  mustContain(
    join(app, "webapp", "manifest.json"),
    `"z2ui5.embed": "./${THIRDPARTY}"`,
  );
  mustContain(
    join(app, "webapp", "view", "Main.view.xml"),
    'xmlns:z2ui5="z2ui5.embed"',
  );

  const control = fromNpm ? installFromNpm(work) : workspace;
  mustContain(join(control, "ui5.yaml"), `/${THIRDPARTY}: ./src/`);

  // app2bsp's working-directory contract: .github/app2bsp next to
  // frontend/app/webapp, output in src/02
  cpSync(join(a2, "tools", "app2bsp"), join(work, ".github", "app2bsp"), {
    recursive: true,
  });
  const webapp = join(work, "frontend", "app", "webapp");
  cpSync(join(app, "webapp"), webapp, { recursive: true });
  cpSync(join(control, "src"), join(webapp, THIRDPARTY), { recursive: true });
  node([join(".github", "app2bsp", "run.js")], work);

  const src02 = join(tree, "src", "02");
  mkdirSync(dirname(src02), { recursive: true });
  cpSync(join(work, "src", "02"), src02, { recursive: true });
  writeFileSync(join(tree, ".abapgit.xml"), ABAPGIT_XML);
  writeFileSync(join(tree, "src", "package.devc.xml"), PACKAGE_XML);

  // The texts an installer sees next to the objects, before the rename, which
  // leaves them alone: they say "abap2UI5 frontend", and this is not it.
  mustReplace(
    join(src02, "z2ui5.wapa.xml"),
    "<TEXT>abap2UI5 frontend (generated)</TEXT>",
    "<TEXT>abap2UI5 embed control example (generated)</TEXT>",
  );
  mustReplace(
    join(src02, "package.devc.xml"),
    "<CTEXT>abap2UI5</CTEXT>",
    "<CTEXT>abap2UI5 - embed control example, BSP</CTEXT>",
  );

  node(
    [
      join(a2, "tools", "bsp_rename", "rename-bsp.mjs"),
      NAME,
      "--yes",
      "--dir",
      join("src", "02"),
    ],
    tree,
  );

  // bsp_rename renames every z2ui5 token of the page directory, the z2ui5
  // segment of the pages' own paths included, and leaves the page files and
  // their content alone - so the directory would list pages under
  // thirdparty/z2ui5_host/ that the files and the manifest place under
  // thirdparty/z2ui5/. Put the paths back (abap2UI5's own BSP has no page
  // with z2ui5 in its path, so the tool never met one).
  const pages = join(src02, `${NAME}.wapa.xml`);
  const renamed = THIRDPARTY.replace("z2ui5", NAME);
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
      "<ICF_DOCU>abap2UI5 - embed control example</ICF_DOCU>",
    );
  }

  // check-pages reads its trees from the out/ next to itself
  const checker = join(work, "check", "tools");
  mkdirSync(checker, { recursive: true });
  cpSync(join(a2, "tools", "check-pages.mjs"), join(checker, "check.mjs"));
  cpSync(join(tree, "src"), join(checker, "out", "standard", "src"), {
    recursive: true,
  });
  node([join(checker, "check.mjs"), "standard"], work);

  // The README every copy of the branch carries - frontend-embed-control's
  // main has the same text without this first line (frontend_deploy.yaml).
  writeFileSync(
    join(tree, "README.md"),
    "> ⚙️ **Generated branch** - built in " +
      "[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) " +
      "from its example app and delivered by its `frontend_deploy` workflow; " +
      "`VERSION` names the commit and the version of the control. Do not " +
      "change it here.\n\n" +
      readFileSync(join(root, "delivery", "README.md"), "utf8"),
  );
  cpSync(join(root, "LICENSE"), join(tree, "LICENSE"));

  cpSync(tree, out, { recursive: true });
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log(
  `build-bsp: ${relative(root, out)}/ - app/ and BSP ${NAME.toUpperCase()}, ` +
    `${pkg.name}@${pkg.version} ` +
    (fromNpm ? "from npm" : "of this checkout"),
);
