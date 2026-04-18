#!/usr/bin/env node
// Reads `registry.template.json`, queries npm for the latest stable version of
// every entry in each item's `dependencies` array, and writes the result to
// `registry.json` with `<pkg>@^<latest>` ranges baked in.
//
// Run by the `prebuild` npm script. Means every fresh `shadcn add` installs
// the current-day latest of each peer dep, not a months-stale caret range.
//
// Pass `--dry-run` to print the resolved registry without writing.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");

const TEMPLATE_PATH = path.join(REPO_ROOT, "registry.template.json");
const OUTPUT_PATH = path.join(REPO_ROOT, "registry.json");

const dryRun = process.argv.includes("--dry-run");

function resolveLatest(pkg) {
  // `npm view` returns the version published with the `latest` dist-tag, which
  // for ~all packages is the latest stable (excluding prereleases).
  const out = execSync(`npm view ${JSON.stringify(pkg)} version`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  if (!/^\d+\.\d+\.\d+/.test(out)) {
    throw new Error(`Unexpected npm view output for ${pkg}: ${out}`);
  }
  return out;
}

function pinDep(spec) {
  // Spec is either bare `wagmi` or already-pinned `wagmi@^2.12.0`. Either way,
  // resolve to current latest and re-pin with caret.
  const at = spec.startsWith("@") ? spec.indexOf("@", 1) : spec.indexOf("@");
  const pkg = at === -1 ? spec : spec.slice(0, at);
  const latest = resolveLatest(pkg);
  return `${pkg}@^${latest}`;
}

function main() {
  const tpl = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
  const resolved = { ...tpl, items: [] };

  for (const item of tpl.items) {
    const deps = Array.isArray(item.dependencies) ? item.dependencies : [];
    const pinnedDeps = [];
    for (const dep of deps) {
      const pinned = pinDep(dep);
      pinnedDeps.push(pinned);
      console.log(`  ${dep}\t→ ${pinned}`);
    }
    resolved.items.push({ ...item, dependencies: pinnedDeps });
  }

  const json = JSON.stringify(resolved, null, 2) + "\n";
  if (dryRun) {
    console.log("\n--- registry.json (dry-run) ---");
    console.log(json);
    return;
  }
  writeFileSync(OUTPUT_PATH, json);
  console.log(`\nWrote ${OUTPUT_PATH}`);
}

main();
