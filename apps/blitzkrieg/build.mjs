import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const source = fileURLToPath(new URL("./src/", import.meta.url));
const root = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("../../public/hubs/blitzkrieg/", import.meta.url));
const toolRoot = process.env.BLITZKRIEG_TOOL_ROOT || root;
const require = createRequire(resolve(toolRoot, "package.json"));
const { build } = require("esbuild");
const { compile } = require("@tailwindcss/node");
const { Scanner } = require("@tailwindcss/oxide");

await build({
  absWorkingDir: source,
  entryPoints: ["main.tsx"],
  outfile: resolve(output, "game.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  charset: "utf8",
});

const stylesheet = await compile(readFileSync(resolve(source, "styles.css"), "utf8"), {
  base: toolRoot,
  onDependency() {},
});
const scanner = new Scanner({ sources: [{ base: source, pattern: "**/*.tsx", negated: false }] });
writeFileSync(resolve(output, "game.css"), stylesheet.build(scanner.scan()));
