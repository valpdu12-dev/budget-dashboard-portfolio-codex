import type { ImportDataset } from "./workbookImport";
import { isImportDataset } from "./importValidation";
import { migrateDataset } from "./datasetMigration";

const KEY = "budget-demo.import.v3";
const PREVIOUS_KEY = "budget-demo.import.v2";
const OLD_KEY = "budget-demo.import.v1";
export interface ImportMemorise extends ImportDataset {
  storageVersion: 2 | 3;
  fileName: string;
  importedAt: string;
}
const validMeta = (data: ImportMemorise) => typeof data.fileName === "string" && typeof data.importedAt === "string" && Number.isFinite(Date.parse(data.importedAt));
export function saveImport(input: ImportMemorise): boolean {
  if (!isImportDataset(input) || !validMeta(input)) return false;
  const data = { ...migrateDataset(input), storageVersion: 3, fileName: input.fileName, importedAt: input.importedAt };
  if (!isImportDataset(data)) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    localStorage.removeItem(PREVIOUS_KEY); localStorage.removeItem(OLD_KEY);
    return true;
  } catch {
    try { localStorage.removeItem(KEY); localStorage.removeItem(PREVIOUS_KEY); localStorage.removeItem(OLD_KEY); } catch { /* stockage inaccessible */ }
    return false;
  }
}
export function restoreImport(): { data: ImportMemorise | null; notice: string | null } {
  try {
    const current = localStorage.getItem(KEY), previous = current ? null : localStorage.getItem(PREVIOUS_KEY);
    const raw = current ?? previous;
    if (!raw) return { data: null, notice: localStorage.getItem(OLD_KEY) ? "Un ancien import incomplet a été détecté. Réimportez vos données avec le modèle v1. La démo est affichée." : null };
    const input: unknown = JSON.parse(raw);
    if (!isImportDataset(input) || !validMeta(input as ImportMemorise)
      || (current ? (input as ImportMemorise).storageVersion !== 3 || input.schemaVersion !== 2 : (input as ImportMemorise).storageVersion !== 2)) {
      return { data: null, notice: "L'import mémorisé est incomplet ou incompatible. Réimportez le classeur. La démo est affichée." };
    }
    const data: ImportMemorise = { ...migrateDataset(input), storageVersion: 3,
      fileName: (input as ImportMemorise).fileName, importedAt: (input as ImportMemorise).importedAt };
    if (!isImportDataset(data)) return { data: null, notice: "L'import mémorisé est incompatible avec les paramètres actuels. Réimportez le classeur. La démo est affichée." };
    if (previous) {
      try { localStorage.setItem(KEY, JSON.stringify(data)); localStorage.removeItem(PREVIOUS_KEY); }
      catch { return { data, notice: "Votre ancien import a été repris pour cette session. La migration n'a pas pu être mémorisée ; le fichier précédent reste conservé." }; }
    }
    return { data, notice: null };
  } catch { return { data: null, notice: "Le stockage local ne peut pas être relu. La démo est affichée." }; }
}
export function loadImport(): ImportMemorise | null { return restoreImport().data; }
export function clearImport(): boolean {
  try { localStorage.removeItem(KEY); localStorage.removeItem(PREVIOUS_KEY); localStorage.removeItem(OLD_KEY); return true; }
  catch { return false; }
}
