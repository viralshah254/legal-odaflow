#!/usr/bin/env node
/** Copy pdfjs worker to public/ so Next.js does not bundle pdf.worker.mjs. */
const fs = require("fs")
const path = require("path")

const dest = path.join(__dirname, "../public/pdf.worker.min.mjs")

try {
  const src = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs")
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log("Copied pdf.worker.min.mjs → public/")
} catch (err) {
  console.error("Failed to copy pdfjs worker:", err)
  process.exit(1)
}
