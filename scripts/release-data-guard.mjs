import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", ".next", "node_modules"]);
const ignoredFiles = new Set(["package-lock.json"]);
const scannedExtensions = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx", ".json", ".md", ".toml", ".prisma"]);

const forbiddenPatterns = [
  /\bUAT\b/i,
  /\bdemo\b/i,
  /\bdummy\b/i,
  /\btest data\b/i,
  /\bsample data\b/i,
  /ABC Private Limited/i,
  /Mehta Traders/i,
  /Sunrise LLP/i,
  /Kapoor Family Office/i,
  /Ananya Shah/i,
  /Rohit Mehra/i,
  /Priya Nair/i,
  /Aman Verma/i,
  /@avantage\.example/i,
];

function extensionOf(file) {
  const index = file.lastIndexOf(".");
  return index === -1 ? "" : file.slice(index);
}

function collectFiles(dir) {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return ignoredDirs.has(entry) ? [] : collectFiles(fullPath);
    if (ignoredFiles.has(entry)) return [];
    return scannedExtensions.has(extensionOf(entry)) ? [fullPath] : [];
  });
}

const failures = [];

for (const file of collectFiles(root)) {
  const rel = relative(root, file);
  if (rel === "scripts\\release-data-guard.mjs" || rel === "scripts/release-data-guard.mjs") continue;
  const content = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) failures.push(`${rel}: matched ${pattern}`);
  }
}

const workspaceData = readFileSync(join(root, "src", "lib", "workspace-data.ts"), "utf8");
const emptySeedChecks = [
  ["initialClients", /export const initialClients: Client\[\] = \[\];/],
  ["initialTasks", /export const initialTasks: Task\[\] = \[\];/],
  ["initialActivityEvents", /export const initialActivityEvents: ActivityEvent\[\] = \[\];/],
];

for (const [name, pattern] of emptySeedChecks) {
  if (!pattern.test(workspaceData)) failures.push(`src/lib/workspace-data.ts: ${name} must remain an empty array for production releases`);
}

if (failures.length > 0) {
  console.error("Release data guard failed. Remove demo/test/UAT data before release:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release data guard passed: no demo/test/UAT seed data found.");
