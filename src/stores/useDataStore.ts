// ── Store Zustand pour les données chargées ──────────────────────────────
import { create } from "zustand";
import type {
  Transaction, SalaryData, Config, BudgetData, DataCoverage, DataOrigin,
} from "@/types";
import { emptyDataCoverage, inferDataCoverage } from "@/utils/dataCoverage";
import { declareDataCoverage } from "@/utils/dataCoverage";
import { migrateDataset } from "@/services/datasetMigration";
import type { ImportDataset } from "@/services/workbookImport";

type Status = "idle" | "loading" | "success" | "error";

interface DataMeta {
  origin?: DataOrigin;
  coverage?: DataCoverage;
  fileName?: string;
  importedAt?: string;
}

interface DataState {
  transactions: Transaction[];
  salary: SalaryData | null;
  config: Config | null;
  budgets: BudgetData | null;
  status: Status;
  error: string | null;
  isFromUpload: boolean;
  /** Origine fonctionnelle du jeu actuellement affiché. */
  dataOrigin: DataOrigin;
  /** Bornes et mois utilisables pour les comparaisons mensuelles. */
  coverage: DataCoverage;
  /** Date de l'import affiché (ISO), ou null pour les données de démonstration. */
  importedAt: string | null;
  /** Nom du classeur importé, pour l'affichage du bandeau. */
  importFileName: string | null;
  storageNotice: string | null;

  // Actions
  setLoading: () => void;
  setData: (tx: Transaction[], sal: SalaryData, cfg: Config, meta?: DataMeta) => void;
  setUploadData: (tx: Transaction[], sal: SalaryData, meta?: DataMeta) => void;
  setImportedDataset: (dataset: ImportDataset, fileName: string, importedAt: string) => void;
  setStorageNotice: (notice: string | null) => void;
  setBudgets: (budgets: BudgetData) => void;
  setConfiguration: (config: Config, transactions: Transaction[]) => void;
  setError: (msg: string) => void;
  reset: () => void;
}

export const useDataStore = create<DataState>((set) => ({
  transactions: [],
  salary: null,
  config: null,
  budgets: null,
  status: "idle",
  error: null,
  isFromUpload: false,
  dataOrigin: "unknown",
  coverage: emptyDataCoverage(),
  importedAt: null,
  importFileName: null,
  storageNotice: null,

  setLoading: () => set({ status: "loading", error: null }),
  // `setData` remet importedAt/importFileName à null : un chargement statique
  // efface la trace de l'import précédent, sans quoi le bandeau annoncerait
  // une origine que les données affichées n'ont plus.
  setData: (tx, sal, cfg, meta) => set({
    transactions: tx, salary: sal, config: cfg,
    status: "success", error: null, isFromUpload: false,
    dataOrigin: meta?.origin ?? "unknown",
    coverage: meta?.coverage ?? inferDataCoverage(tx),
    importedAt: null, importFileName: null,
  }),
  setUploadData: (tx, sal, meta) => set({
    transactions: tx, salary: sal,
    config: null, budgets: { budgets: [] },
    status: "success", error: null, isFromUpload: true,
    dataOrigin: "upload",
    coverage: meta?.coverage ?? inferDataCoverage(tx),
    importedAt: meta?.importedAt ?? new Date().toISOString(),
    importFileName: meta?.fileName ?? null,
  }),
  setImportedDataset: (input, fileName, importedAt) => {
    const dataset = migrateDataset(input);
    set({
    transactions: dataset.transactions, salary: dataset.salary, config: dataset.config, budgets: dataset.budgets,
    status: "success", error: null, isFromUpload: true, dataOrigin: "upload",
    coverage: dataset.config.coverage ? declareDataCoverage(dataset.config.coverage.dateMin, dataset.config.coverage.dateMax) : inferDataCoverage(dataset.transactions),
    importedAt, importFileName: fileName, storageNotice: null,
  }); },
  setStorageNotice: (storageNotice) => set({ storageNotice }),
  setBudgets: (budgets) => set({ budgets }),
  setConfiguration: (config, transactions) => set({ config, transactions }),
  setError: (msg) => set({ status: "error", error: msg }),
  reset: () => set({
    transactions: [], salary: null, config: null, budgets: null,
    status: "idle", error: null, isFromUpload: false,
    dataOrigin: "unknown", coverage: emptyDataCoverage(),
    importedAt: null, importFileName: null, storageNotice: null,
  }),
}));
