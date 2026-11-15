// Frontend sanity checks (no dependencies): node frontend/tests/check.js
// 1. every script referenced by index.html exists
// 2. every statically used t("key") exists in EN, IT and DE
// 3. the three languages define exactly the same keys
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let ok = true;
const fail = (msg) => { ok = false; console.error("FAIL", msg); };

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
for (const m of html.matchAll(/src="([^"?:]+)(\?[^"]*)?"/g)) {
  if (!fs.existsSync(path.join(root, m[1]))) fail(`index.html references missing file ${m[1]}`);
}

const window = {};
const React = { createContext: () => ({}), useContext: () => ({}) };
new Function("window", "React", fs.readFileSync(path.join(root, "translations.jsx"), "utf8"))(window, React);
const T = window.TRANSLATIONS;
const LANGS = ["en", "it", "de"];

const files = ["app.jsx", "ui.jsx", ...fs.readdirSync(path.join(root, "screens")).map(f => `screens/${f}`)];
const used = new Map();
for (const f of files) {
  const code = fs.readFileSync(path.join(root, f), "utf8");
  for (const m of code.matchAll(/\b(?:t|tr|t_app)\(\s*['"]([a-zA-Z0-9_.-]+)['"]\s*\)/g)) used.set(m[1], f);
}
// Keys that app.jsx / candidate.jsx build dynamically.
for (const s of ["org", "profile", "setup", "invite", "recap"]) { used.set(`wizard.${s}.title`, "app.jsx"); used.set(`wizard.${s}.sub`, "app.jsx"); }
for (const k of ["analysis", "pipeline", "interviews", "team", "reviews"]) { used.set(`login.feature.${k}`, "app.jsx"); used.set(`login.feature.${k}.desc`, "app.jsx"); }
for (const r of ["pipeline", "candidates", "roles", "employees", "interviews", "inbox", "reports"]) used.set(`nav.${r}`, "app.jsx");
for (const s of ["pending", "in_progress", "completed", "expired"]) used.set(`candidate.video.status.${s}`, "screens/candidate.jsx");

for (const [key, file] of used) for (const lang of LANGS) if (!(key in T[lang])) fail(`${lang} is missing "${key}" (used in ${file})`);
for (const lang of LANGS.slice(1)) {
  for (const key of Object.keys(T.en)) if (!(key in T[lang])) fail(`${lang} is missing "${key}" (defined in en)`);
  for (const key of Object.keys(T[lang])) if (!(key in T.en)) fail(`en is missing "${key}" (defined in ${lang})`);
}

console.log(ok ? `OK — ${used.size} keys used, ${Object.keys(T.en).length} per language, ${files.length} files` : "FAILED");
process.exit(ok ? 0 : 1);
