import { useDataStore } from "@/stores/useDataStore";
import { decodeTransactions } from "@/utils/decode";
import { declareDataCoverage } from "@/utils/dataCoverage";
import { migrateDataset, linkTransfers } from "./datasetMigration";
import { restoreDemoConfiguration } from "./configurationPersistence";
import { restoreImport } from "@/services/importPersistence";
import { loadLocalBudgets } from "@/services/budgetPersistence";
import type { BudgetData, Config, RawTransactionsJSON, SalaryData } from "@/types";

const dataUrl = (fileName: string) => `${import.meta.env.BASE_URL}data/${fileName}`;

async function fetchJson<T>(fileName: string): Promise<T> {
  const url = dataUrl(fileName);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${url}`);
  return response.json() as Promise<T>;
}

/**
 * Charge exclusivement les fichiers versionnés de la démonstration.
 * Restaure d'abord un import complet. À défaut, charge la démo statique.
 */
export async function loadDashboardData(): Promise<void> {
  const { setLoading, setData, setImportedDataset, setBudgets, setError, setStorageNotice } = useDataStore.getState();
  const { data: memorisedImport, notice } = restoreImport();
  if (memorisedImport) {
    setImportedDataset(memorisedImport, memorisedImport.fileName, memorisedImport.importedAt);
    setStorageNotice(notice);
    return;
  }

  setLoading();
  try {
    const [rawTransactions, salary, config, defaultBudgets] = await Promise.all([
      fetchJson<RawTransactionsJSON>("transactions.json"),
      fetchJson<SalaryData>("salary.json"),
      fetchJson<Config>("config.json"),
      fetchJson<BudgetData>("budgets.json"),
    ]);

    let transactions = decodeTransactions(rawTransactions);
    let currentConfig = config;
    if (config.balanceMode === "direct" && config.comptes?.length) {
      const migrated = migrateDataset({ schemaVersion: 1, transactions, config, salary, budgets: defaultBudgets });
      transactions = migrated.transactions;
      currentConfig = migrated.config;
      currentConfig.accounts?.forEach(a => { if (a.label.includes("Compte joint")) a.share = 50; });
    }
    const declaredCoverage = config.coverage
      ? declareDataCoverage(config.coverage.dateMin, config.coverage.dateMax)
      : undefined;

    setData(transactions, salary, currentConfig, {
      origin: "static",
      coverage: declaredCoverage,
    });
    setBudgets(loadLocalBudgets(defaultBudgets));
    if (currentConfig.accounts) {
      const restored = restoreDemoConfiguration(currentConfig);
      const roles = new Map(restored.config.types?.map(t => [t.id, t.role]));
      useDataStore.getState().setConfiguration(restored.config, linkTransfers(transactions, roles));
      setStorageNotice([notice, restored.notice].filter(Boolean).join(" ") || null);
    } else setStorageNotice(notice);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
}
