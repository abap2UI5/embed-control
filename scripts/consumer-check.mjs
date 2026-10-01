// The package the way a consumer gets it: packed, installed from the tarball
// into an app outside this workspace, and built there with the UI5 CLI - once
// for every CLI major a consumer may have.
//
// The example app shows neither. It takes the package through the workspace
// link, where a file left out of "files" in package.json still exists, and it
// builds with the one CLI this repository uses. UI5 CLI 3 reads specVersion
// up to 3.2 and refuses a dependency with 4.0 - which is why the package's
// ui5.yaml stays at 3.0, and why this builds with both.
//
//   npm run consumer:check          UI5 CLI 3 and 4
//   npm run consumer:check -- 4     only the majors named

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = "packages/embed-control";
const NAME = "@abap2ui5/embed-control";
// where includeDependency puts the control: thirdparty/, not resources/
const TARGET = "dist/thirdparty/z2ui5/embed";
const FILES = ["Container.js", "Container.css"];

const majors = process.argv.length > 2 ? process.argv.slice(2) : ["3", "4"];

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// npm as the one that started this script (npm_execpath, set by `npm run`),
// run by this node: no shell, and no "npm" to look up on PATH - on Windows
// that is npm.cmd, which a shell-less spawn refuses since Node 18.20/20.12.
// Started otherwise, the npm on PATH.
const npm = process.env.npm_execpath
  ? [process.execPath, process.env.npm_execpath]
  : ["npm"];
const runNpm = (args, cwd) => run(npm[0], [...npm.slice(1), ...args], cwd);

// The smallest app that takes the package the way the README says: the
// dependency, includeDependency in ui5.yaml, the resourceRoot in the
// manifest. No framework section - nothing of UI5 itself is downloaded.
function writeConsumer(app, tarball, major) {
  mkdirSync(join(app, "webapp"), { recursive: true });
  const json = (file, value) =>
    writeFileSync(join(app, file), `${JSON.stringify(value, null, 2)}\n`);
  json("package.json", {
    name: "consumer",
    version: "1.0.0",
    private: true,
    dependencies: { [NAME]: `file:${tarball}` },
    devDependencies: { "@ui5/cli": `^${major}` },
  });
  writeFileSync(
    join(app, "ui5.yaml"),
    [
      'specVersion: "3.0"',
      "metadata:",
      "  name: consumer",
      "type: application",
      "builder:",
      "  settings:",
      "    includeDependency:",
      `      - "${NAME}"`,
      "",
    ].join("\n"),
  );
  json("webapp/manifest.json", {
    _version: "1.12.0",
    "sap.app": { id: "consumer", type: "application" },
    "sap.ui5": {
      resourceRoots: { "z2ui5.embed": "./thirdparty/z2ui5/embed/" },
    },
  });
  writeFileSync(
    join(app, "webapp/Component.js"),
    'sap.ui.define(["sap/ui/core/UIComponent"], (UIComponent) =>\n' +
      '  UIComponent.extend("consumer.Component", {\n' +
      '    metadata: { manifest: "json" },\n' +
      "  }),\n" +
      ");\n",
  );
}

// the CLI's own entry point, run by this node - no shell, no .bin shim
function ui5(app, args) {
  const cli = join(app, "node_modules/@ui5/cli/bin/ui5.cjs");
  return run(process.execPath, [cli, ...args], app);
}

const work = mkdtempSync(join(tmpdir(), "embed-control-consumer-"));
let failed = false;
try {
  const [{ filename }] = JSON.parse(
    runNpm(
      ["pack", "--json", "--workspace", WORKSPACE, "--pack-destination", work],
      root,
    ),
  );
  const tarball = join(work, filename);

  for (const major of majors) {
    const app = join(work, `ui5-cli-${major}`);
    try {
      writeConsumer(app, tarball, major);
      runNpm(["install", "--no-audit", "--no-fund"], app);
      const version = ui5(app, ["--version"]).split(" ")[0].trim();
      ui5(app, ["build", "--clean-dest"]);
      const missing = FILES.filter((f) => !existsSync(join(app, TARGET, f)));
      if (missing.length) {
        throw new Error(`${missing.join(", ")} missing in ${TARGET}/`);
      }
      if (existsSync(join(app, "dist/resources"))) {
        throw new Error("the build wrote dist/resources/");
      }
      console.log(`ok    UI5 CLI ${version}: ${filename} -> ${TARGET}/`);
    } catch (error) {
      failed = true;
      console.error(`FAIL  UI5 CLI ${major}: ${error.message}`);
      if (error.stdout) console.error(error.stdout);
      if (error.stderr) console.error(error.stderr);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
process.exitCode = failed ? 1 : 0;
