// Builds the branch abap2UI5/frontend-cc delivers: the example app of this
// repository as the BSP Z2UI5_HOST, to install with abapGit and try the
// control on a real system. The host app and the control, and no copy of the
// abap2UI5 frontend - the control loads that from the system's
// /sap/bc/z2ui5?z2ui5-bundle, as in any other app.
//
//   ABAP2UI5_DIR=../abap2UI5 npm run bsp
//
// The tree lands in the git-ignored out/standard/ and is everything the
// branch carries: .abapgit.xml, src/ (the package and the BSP), README.md,
// LICENSE. frontend_cc_deploy.yaml writes it into frontend-cc's main as
// result/standard, and frontend-cc's deliver workflow makes the branch of it.
//
// The BSP is made by abap2UI5's own tools, the ones that build its frontend
// BSP for abap2UI5/frontend, taken from the checkout ABAP2UI5_DIR names:
//   tools/app2bsp          webapp -> BSP pages (lines a page can carry, the
//                          page directory, the ui5_ui5 and bsp nodes)
//   tools/bsp_rename       Z2UI5 -> Z2UI5_HOST (BSP, nodes, file names)
//   tools/check-pages.mjs  the page invariants, on the result
//
// The webapp is examples/host-app/webapp plus the control in
// thirdparty/z2ui5/embed/ - where `ui5 build` puts it in any app that names
// the package under includeDependency. Neither is patched.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
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

const host = join(root, "examples", "host-app", "webapp");
const control = join(root, "packages", "embed-control");

const a2 = process.env.ABAP2UI5_DIR && resolve(process.env.ABAP2UI5_DIR);
const TOOLS = [
  "tools/app2bsp/run.js",
  "tools/bsp_rename/rename-bsp.mjs",
  "tools/check-pages.mjs",
];
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
   <NAME>abap2UI5-frontend-cc</NAME>
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
function node(args, cwd) {
  try {
    execFileSync(process.execPath, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    process.stderr.write(String(error.stdout ?? ""));
    process.stderr.write(String(error.stderr ?? ""));
    throw error;
  }
}

mustContain(join(control, "ui5.yaml"), `/${THIRDPARTY}: ./src/`);
mustContain(join(host, "manifest.json"), `"z2ui5.embed": "./${THIRDPARTY}"`);

const work = mkdtempSync(join(tmpdir(), "embed-control-bsp-"));
try {
  // app2bsp's working-directory contract: .github/app2bsp next to
  // frontend/app/webapp, output in src/02
  cpSync(join(a2, "tools", "app2bsp"), join(work, ".github", "app2bsp"), {
    recursive: true,
  });
  const webapp = join(work, "frontend", "app", "webapp");
  cpSync(host, webapp, { recursive: true });
  cpSync(join(control, "src"), join(webapp, THIRDPARTY), { recursive: true });
  node([join(".github", "app2bsp", "run.js")], work);

  rmSync(out, { recursive: true, force: true });
  const src02 = join(out, "src", "02");
  mkdirSync(dirname(src02), { recursive: true });
  cpSync(join(work, "src", "02"), src02, { recursive: true });
  writeFileSync(join(out, ".abapgit.xml"), ABAPGIT_XML);
  writeFileSync(join(out, "src", "package.devc.xml"), PACKAGE_XML);

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
    out,
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
  cpSync(join(out, "src"), join(checker, "out", "standard", "src"), {
    recursive: true,
  });
  node([join(checker, "check.mjs"), "standard"], work);
} finally {
  rmSync(work, { recursive: true, force: true });
}

// The README every copy of the branch carries - frontend-cc's main has the
// same text without this first line (frontend_cc_deploy.yaml).
writeFileSync(
  join(out, "README.md"),
  "> ⚙️ **Generated branch** - built in " +
    "[abap2UI5/embed-control](https://github.com/abap2UI5/embed-control) " +
    "from its example app and delivered by its `frontend_cc_deploy` " +
    "workflow; `VERSION` names the commit. Do not change it here.\n\n" +
    readFileSync(join(root, "delivery", "README.md"), "utf8"),
);
cpSync(join(root, "LICENSE"), join(out, "LICENSE"));

console.log(`build-bsp: ${relative(root, out)}/ - BSP ${NAME.toUpperCase()}`);
