// Builds src/ into dist/: content-hashed JS and CSS under dist/site-assets/, every page with the hashed
// names substituted, and static/ copied as-is. The hashed names let nginx serve /site-assets/* as
// immutable for a year while the pages are revalidated on every visit.
//
//   node scripts/build.mjs                  into dist/
//   node scripts/build.mjs --outdir <dir>   into <dir> instead (relative to the repository root)

import * as esbuild from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const i = process.argv.indexOf("--outdir");
const out = resolve(root, i > 0 ? process.argv[i + 1] : "dist");

/** The site's pages. A project with its own repository (the self-defending cluster) is not here. */
const PAGES = [
  { src: "src/landing.html", out: "index.html" },
  { src: "src/lab.html", out: "lab/index.html" },
];

await rm(out, { recursive: true, force: true });
await mkdir(join(out, "site-assets"), { recursive: true });

const result = await esbuild.build({
  absWorkingDir: root,
  entryPoints: ["src/landing.ts", "src/lab-page.ts", "src/theme.ts", "src/styles.css"],
  outdir: join(out, "site-assets"),
  entryNames: "[name]-[hash]",
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2022", "chrome110", "firefox110", "safari16"],
  metafile: true,
  legalComments: "none",
  logLevel: "warning",
});

const names = {};
for (const [file, meta] of Object.entries(result.metafile.outputs)) {
  if (!meta.entryPoint) continue;
  const ext = file.endsWith(".css") ? "css" : "js";
  names[`${basename(meta.entryPoint).replace(/\.(ts|css)$/, "")}.${ext}`] = basename(file);
}
for (const p of PAGES) {
  const html = (await readFile(join(root, p.src), "utf8")).replace(/\{\{([\w.-]+)\}\}/g, (_, key) => {
    if (!names[key]) throw new Error(`${p.src} references {{${key}}} but no such entry was built`);
    return names[key];
  });
  await mkdir(dirname(join(out, p.out)), { recursive: true });
  await writeFile(join(out, p.out), html);
}
await cp(join(root, "static"), out, { recursive: true });
console.log(`built: ${Object.values(names).join(", ")}`);
