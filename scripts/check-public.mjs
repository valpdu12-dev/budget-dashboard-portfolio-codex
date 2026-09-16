import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skippedDirectories = new Set([".git", "node_modules", "plan", "coverage"]);
const skippedFiles = new Set([path.join("scripts", "check-public.mjs")]);
const textExtensions = new Set([
  ".css", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".svg", ".ts", ".tsx", ".txt", ".webmanifest", ".yml", ".yaml",
]);
const forbiddenFilePatterns = [
  /(^|\/)\.env(?:\.|$)/,
  /\.sql$/i,
  /\.xlsx?$/i,
];
const genericContentPatterns = [
  { label: "URL de Worker", regex: /[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/i },
  { label: "route d'API privée", regex: /\/api\//i },
  { label: "nom de variable de jeton", regex: /(?:api|proxy|auth)[_-]?token/i },
  { label: "jeton Bearer", regex: /bearer\s+[a-z0-9._-]{12,}/i },
  { label: "IBAN potentiel", regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/ },
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && skippedDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else files.push(fullPath);
  }
  return files;
}

async function loadPrivateDenylist() {
  const denylistPath = path.join(projectRoot, "plan", "DENYLIST_LOT_A.txt");
  try {
    return (await readFile(denylistPath, "utf8"))
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

const approvedWorkbookHash = "11a6df1a4d506af8cd41fadf31f3e60d9ee6855f226d877b85dc33c091f82af8";
const approvedWorkbookPaths = new Set(["public/modeles/Budget_v1.xlsx", "dist/modeles/Budget_v1.xlsx"]);

const findings = [];
const privateTerms = await loadPrivateDenylist();
const files = await walk(projectRoot);

for (const fullPath of files) {
  const relativePath = path.relative(projectRoot, fullPath);
  if (skippedFiles.has(relativePath)) continue;
  if (approvedWorkbookPaths.has(relativePath)) {
    const digest = createHash("sha256").update(await readFile(fullPath)).digest("hex");
    if (digest !== approvedWorkbookHash) findings.push(`${relativePath}: modèle modifié, vérification requise`);
    continue;
  }
  if (forbiddenFilePatterns.some((pattern) => pattern.test(relativePath))) {
    findings.push(`${relativePath}: type de fichier interdit dans une copie publique`);
    continue;
  }

  const extension = path.extname(relativePath).toLowerCase();
  const fileStats = await stat(fullPath);
  if (!textExtensions.has(extension) || fileStats.size > 2_000_000) continue;
  const content = await readFile(fullPath, "utf8");

  for (const pattern of genericContentPatterns) {
    if (pattern.regex.test(content)) findings.push(`${relativePath}: ${pattern.label}`);
  }
  for (const term of privateTerms) {
    if (content.toLocaleLowerCase("fr").includes(term.toLocaleLowerCase("fr"))) {
      findings.push(`${relativePath}: terme de la liste privée détecté`);
    }
  }
}

if (findings.length > 0) {
  console.error("Contrôle public refusé :");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`Contrôle public réussi : ${files.length} fichiers examinés, aucune fuite détectée.`);
}
