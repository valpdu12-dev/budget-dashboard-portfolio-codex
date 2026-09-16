import * as XLSX from "xlsx";
import { parseWorkbook } from "@/services/workbookImport";

self.onmessage = (event: MessageEvent) => {
  if (event.data.type !== "parse") return;
  try {
    self.postMessage({ type: "progress", step: "Lecture du modèle Excel…", pct: 10 });
    const workbook = XLSX.read(event.data.buffer, { type: "array", cellDates: false, cellFormula: true });
    self.postMessage({ type: "progress", step: "Contrôle des lignes et rapprochement…", pct: 60 });
    const { dataset, validation } = parseWorkbook(workbook);
    self.postMessage({ type: "result", dataset, validation });
  } catch {
    self.postMessage({ type: "error", message: "Impossible de lire ce classeur. Choisissez un fichier .xlsx valide au format Budget v1." });
  }
};
