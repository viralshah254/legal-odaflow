import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const addinEnv = {
  ...loadEnvFile(".env"),
  ...loadEnvFile(".env.local"),
};
const webEnv = loadEnvFile(path.join("..", "legal_web", ".env.local"));

function pick(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
    if (addinEnv[key]) return addinEnv[key];
    if (webEnv[key]) return webEnv[key];
  }
  return "";
}

const apiUrl = pick("VITE_API_URL") || "http://localhost:4000";
const webAppUrl = pick("VITE_WEB_APP_URL") || "http://localhost:3000";
const firebase = {
  apiKey: pick("VITE_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: pick("VITE_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: pick("VITE_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
};

function injectOfficeAuth(templatePath, outputPath) {
  let html = fs.readFileSync(templatePath, "utf8");
  html = html
    .replace(/__API_URL__/g, apiUrl)
    .replace(/__WEB_APP_URL__/g, webAppUrl)
    .replace(/__FIREBASE_API_KEY__/g, firebase.apiKey)
    .replace(/__FIREBASE_AUTH_DOMAIN__/g, firebase.authDomain)
    .replace(/__FIREBASE_PROJECT_ID__/g, firebase.projectId);
  fs.writeFileSync(outputPath, html);
  if (templatePath.includes("office-auth")) {
    const firebaseReady = Boolean(
      firebase.apiKey && firebase.authDomain && firebase.projectId,
    );
    console.log(
      `Wrote ${outputPath} (api: ${apiUrl}, firebase: ${firebaseReady ? "configured" : "missing"})`,
    );
  } else {
    console.log(`Wrote ${outputPath} (web app: ${webAppUrl})`);
  }
}

const publicDir = "public";
const distDir = "dist";

injectOfficeAuth(
  path.join(publicDir, "office-auth.html"),
  path.join(distDir, "office-auth.html"),
);

injectOfficeAuth(
  path.join(publicDir, "oauth-launch.html"),
  path.join(distDir, "oauth-launch.html"),
);

const bridgeTemplate = fs.readFileSync(path.join(publicDir, "auth-bridge.html"), "utf8");
fs.writeFileSync(path.join(distDir, "auth-bridge.html"), bridgeTemplate);
console.log("Wrote dist/auth-bridge.html");

const htmlFiles = [path.join(distDir, "src", "taskpane", "index.html")];

for (const htmlPath of htmlFiles) {
  if (!fs.existsSync(htmlPath)) continue;
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html
    .replace(/<script type="module"[^>]*>/g, '<script type="text/javascript">')
    .replace(/\scrossorigin/g, "");
  fs.writeFileSync(htmlPath, html);
  console.log(`Patched ${htmlPath} for Office WebView compatibility`);
}
