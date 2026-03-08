#!/usr/bin/env bun

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [version] = process.argv.slice(2);

if (!version) {
  console.error("Usage: bun scripts/update-release-metadata.mjs <version>");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function updateJson(relativePath, updater) {
  const filePath = path.join(root, relativePath);
  const current = JSON.parse(readFileSync(filePath, "utf8"));
  const next = updater(current);
  writeFileSync(filePath, `${JSON.stringify(next, null, 2)}\n`);
}

updateJson(".claude-plugin/plugin.json", (plugin) => ({
  ...plugin,
  version,
}));

updateJson(".claude-plugin/marketplace.json", (marketplace) => ({
  ...marketplace,
  metadata:
    marketplace.metadata && typeof marketplace.metadata === "object"
      ? { ...marketplace.metadata, version }
      : marketplace.metadata,
  plugins: Array.isArray(marketplace.plugins)
    ? marketplace.plugins.map((plugin) => ({
        ...plugin,
        version,
        source:
          plugin.source && plugin.source.npm && typeof plugin.source.npm === "object"
            ? {
                ...plugin.source,
                npm: { ...plugin.source.npm, version },
              }
            : plugin.source,
      }))
    : marketplace.plugins,
}));
