// The gate in front of npm publish (publish.yaml). A published version can
// never be replaced, so what would otherwise only show after the publish is
// caught here:
//
// - the release tag has to be v<version> of the package
// - CHANGELOG.md has to carry that version, and nothing may be left under
//   "Unreleased" - or the notes of the release stay filed there for good
// - repository.url has to name the repository the workflow runs in: npm
//   refuses the provenance of a package that names another one, which is
//   what a renamed repository leads to
//
//   node scripts/release-check.mjs v0.2.0    a release: all of it
//   node scripts/release-check.mjs           the dry run: the repository only
//
// The repository comes from GITHUB_REPOSITORY and is checked only when that
// is set, so a local run checks tag and changelog alone.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKSPACE = "packages/embed-control";

const read = (file) => readFileSync(join(root, WORKSPACE, file), "utf8");
const pkg = JSON.parse(read("package.json"));
const tag = process.argv[2] || "";
const errors = [];

if (tag) {
  if (tag !== `v${pkg.version}`) {
    errors.push(
      `the release tag ${tag} does not name the version in ` +
        `${WORKSPACE}/package.json (${pkg.version}) - tag v${pkg.version}, ` +
        "or bump the version first",
    );
  }

  // "## 0.2.0" or "## 0.2.0 - 2026-10-01" - and "## 0.2.10" is no "0.2.1"
  const sections = read("CHANGELOG.md").split(/^## /m).slice(1);
  const title = (section) => section.split("\n")[0].trim();
  const unreleased = sections.find((s) => /^unreleased$/i.test(title(s)));
  const left = unreleased
    ? unreleased.slice(unreleased.indexOf("\n") + 1).trim()
    : "";
  if (left) {
    errors.push(
      'CHANGELOG.md still has entries under "## Unreleased" - move them ' +
        `under "## ${pkg.version}"`,
    );
  }
  const heading = new RegExp(`^${pkg.version.replace(/\./g, "\\.")}( |$)`);
  if (!sections.some((s) => heading.test(title(s)))) {
    errors.push(`CHANGELOG.md has no "## ${pkg.version}" section`);
  }
}

const repository = process.env.GITHUB_REPOSITORY;
if (repository) {
  const url = (pkg.repository && pkg.repository.url) || "";
  const expected = `git+https://github.com/${repository}.git`;
  if (url.toLowerCase() !== expected.toLowerCase()) {
    errors.push(
      `repository.url in ${WORKSPACE}/package.json is '${url}', but this ` +
        `runs in ${repository} - npm refuses the provenance. Set ` +
        `${expected}, and homepage and bugs with it`,
    );
  }
}

for (const error of errors) console.error(`::error::${error}`);
if (errors.length) process.exit(1);
console.log(
  tag
    ? `${tag}: ${repository ? "tag, version, changelog and repository" : "tag, version and changelog"} agree`
    : `dry run: ${repository ? "repository ok" : "nothing to check"} - ` +
        "tag, version and changelog are checked on a release",
);
