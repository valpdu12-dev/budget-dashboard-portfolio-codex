import { useCallback, useEffect, useRef, useState } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { persistCurrentImport } from "@/services/configurationPersistence";
import { isImportDataset } from "@/services/importValidation";
import type { ImportDataset, ValidationReport } from "@/services/workbookImport";
export type { ValidationReport } from "@/services/workbookImport";
export type UploadStatus = "idle" | "loading" | "success" | "error";
export interface ExcelWorkerState {
  status: UploadStatus;
  error: string | null;
  progressStep: string;
  progressPct: number;
  validation: ValidationReport | null;
  pendingData: ImportDataset | null;
  parse: (buffer: ArrayBuffer) => void;
  apply: (fileName?: string) => boolean;
  reset: () => void;
}
export function useExcelWorker(): ExcelWorkerState {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progressStep, setProgressStep] = useState("");
  const [progressPct, setProgressPct] = useState(0);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [pendingData, setPendingData] = useState<ImportDataset | null>(null);
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(new URL("@/components/upload/parseExcel.worker.ts", import.meta.url), { type: "module" });
      workerRef.current = w;
      w.onmessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.type === "progress") { setProgressStep(msg.step); setProgressPct(msg.pct); }
        else if (msg.type === "result") {
          setValidation(msg.validation);
          const valid = msg.validation?.ok && isImportDataset(msg.dataset);
          setPendingData(valid ? msg.dataset : null);
          setStatus(valid ? "success" : "error");
          setError(valid ? null : "Corrigez les erreurs indiquées avant d'appliquer le fichier.");
          setProgressStep("Analyse terminée"); setProgressPct(100);
        } else if (msg.type === "error") { setPendingData(null); setError(msg.message); setStatus("error"); }
      };
      w.onerror = ev => { setPendingData(null); setError(ev.message || "Erreur du lecteur Excel"); setStatus("error"); };
    }
    return workerRef.current;
  }, []);
  useEffect(() => () => { workerRef.current?.terminate(); workerRef.current = null; }, []);
  const reset = useCallback(() => {
    workerRef.current?.terminate(); workerRef.current = null;
    setStatus("idle"); setError(null); setProgressStep(""); setProgressPct(0); setValidation(null); setPendingData(null);
  }, []);
  const parse = useCallback((buffer: ArrayBuffer) => {
    reset(); setStatus("loading"); setProgressStep("Démarrage…");
    getWorker().postMessage({ type: "parse", buffer });
  }, [getWorker, reset]);
  const apply = useCallback((fileName = "") => {
    if (!pendingData || !validation?.ok) return false;
    const importedAt = new Date().toISOString();
    const state = useDataStore.getState();
    state.setImportedDataset(pendingData, fileName, importedAt);
    useFilterStore.getState().clearAllFilters();
    useFilterStore.setState({ cat1Filter: "all", showTransfers: false });
    // Persiste l'état réellement appliqué : pour un ancien classeur réimporté,
    // il peut contenir les objectifs budgétaires déjà paramétrés localement.
    const saved = persistCurrentImport();
    state.setStorageNotice(saved ? null : "Données affichées pour cette session. Le stockage local est indisponible ou saturé : elles ne seront pas conservées après fermeture.");
    return true;
  }, [pendingData, validation]);
  return { status, error, progressStep, progressPct, validation, pendingData, parse, apply, reset };
}
