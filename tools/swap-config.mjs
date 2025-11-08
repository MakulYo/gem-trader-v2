import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = (process.argv[2] || "").toLowerCase();
if (!["dev", "prod"].includes(env)) {
  console.error("Usage: node tools/swap-config.mjs <dev|prod>");
  process.exit(1);
}

const src = resolve(__dirname, `../web/config/firebase-config.${env}.js`);
const dst = resolve(__dirname, "../web/firebase-config.js");
await mkdir(dirname(dst), { recursive: true });
await copyFile(src, dst);

console.log(`[swap-config] Wrote ${env} config -> web/firebase-config.js`);
