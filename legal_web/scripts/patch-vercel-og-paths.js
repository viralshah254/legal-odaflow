/**
 * Patch @vercel/og bundled in Next.js for Windows path resolution.
 *
 * path.join(import.meta.url, "../file") produces invalid URLs on Windows;
 * use new URL("./file", import.meta.url) instead.
 *
 * Upstream fix: https://github.com/vercel/next.js/pull/77650 (Next.js 15.3+)
 */
const fs = require("fs")
const path = require("path")

const OG_INDEX = path.join(
  __dirname,
  "..",
  "node_modules",
  "next",
  "dist",
  "compiled",
  "@vercel",
  "og",
  "index.node.js",
)

const REPLACEMENTS = [
  [
    'fileURLToPath(join(import.meta.url, "../noto-sans-v27-latin-regular.ttf"))',
    'fileURLToPath(new URL("./noto-sans-v27-latin-regular.ttf", import.meta.url))',
  ],
  [
    'fileURLToPath(join(import.meta.url, "../yoga.wasm"))',
    'fileURLToPath(new URL("./yoga.wasm", import.meta.url))',
  ],
  [
    'fileURLToPath(join(import.meta.url, "../resvg.wasm"))',
    'fileURLToPath(new URL("./resvg.wasm", import.meta.url))',
  ],
]

function main() {
  if (!fs.existsSync(OG_INDEX)) {
    console.log("[patch-vercel-og-paths] Skipping: Next.js @vercel/og bundle not found")
    return
  }

  let source = fs.readFileSync(OG_INDEX, "utf8")
  let patched = false

  for (const [from, to] of REPLACEMENTS) {
    if (source.includes(from)) {
      source = source.replace(from, to)
      patched = true
    }
  }

  if (!patched) {
    console.log("[patch-vercel-og-paths] Already patched or upstream fix applied")
    return
  }

  fs.writeFileSync(OG_INDEX, source, "utf8")
  console.log("[patch-vercel-og-paths] Patched @vercel/og Windows path resolution")
}

main()
