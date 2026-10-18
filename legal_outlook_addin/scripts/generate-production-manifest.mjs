#!/usr/bin/env node
/**
 * Patch production Office add-in manifest URLs.
 * Usage: ADDIN_BASE_URL=https://addins.umbrella.okaylegal.ai node scripts/generate-production-manifest.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const baseUrl = (process.env.ADDIN_BASE_URL ?? "https://addins.umbrella.okaylegal.ai").replace(
  /\/$/,
  "",
);

const manifestPath = join(__dirname, "../manifest.xml");
let xml = readFileSync(manifestPath, "utf8");
xml = xml.replace(/https:\/\/your-addin-domain\.com/g, baseUrl);

const outPath = join(__dirname, "../manifest.production.xml");
writeFileSync(outPath, xml, "utf8");
console.log(`Wrote ${outPath} with base URL ${baseUrl}`);
