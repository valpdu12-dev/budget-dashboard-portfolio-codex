import { useDataStore } from "@/stores/useDataStore";
import type { Config } from "@/types";
import { saveLocalBudgets } from "./budgetPersistence";
import { saveImport } from "./importPersistence";
import { linkTransfers, materializeConfig } from "./datasetMigration";
import { configurationErrors } from "./configurationValidation";

const KEY = "budget-demo.config.v2";
export function clearDemoConfiguration(): boolean {
  try { localStorage.removeItem(KEY); return true; } catch { return false; }
}
export function restoreDemoConfiguration(defaultConfig: Config): { config: Config; notice: string | null } {
  const state = useDataStore.getState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { config: defaultConfig, notice: null };
    const parsed = JSON.parse(raw) as Config;
    if (!Array.isArray(parsed.accounts) || !Array.isArray(parsed.types)
      || parsed.accounts.length !== defaultConfig.accounts?.length || parsed.types.length !== defaultConfig.types?.length
      || parsed.accounts.some(a => !defaultConfig.accounts?.some(d => d.id === a?.id))
      || parsed.types.some(t => !defaultConfig.types?.some(d => d.id === t?.id))
      || configurationErrors(parsed, linkTransfers(state.transactions, new Map(parsed.types.map(t => [t.id, t.role])))).length) {
      return { config: defaultConfig, notice: "Les paramètres de démonstration mémorisés sont invalides. Les paramètres fictifs initiaux sont utilisés." };
    }
    return { config: materializeConfig(parsed), notice: null };
  } catch { return { config: defaultConfig, notice: "Les paramètres de démonstration ne peuvent pas être relus. Les valeurs initiales sont utilisées." }; }
}
export function persistCurrentImport(): boolean {
  const state = useDataStore.getState();
  if (!state.salary || !state.config || !state.budgets) return false;
  return saveImport({ schemaVersion: 2, transactions: state.transactions, salary: state.salary,
    config: state.config, budgets: state.budgets, storageVersion: 3,
    fileName: state.importFileName ?? "", importedAt: state.importedAt ?? new Date().toISOString() });
}
export function applyConfiguration(input: Config): { ok: boolean; errors: string[]; saved: boolean } {
  const state = useDataStore.getState();
  const config = materializeConfig(input);
  const roles = new Map(config.types?.map(t => [t.id, t.role]));
  const transactions = linkTransfers(state.transactions.map(t => ({ ...t,
    role: roles.get(t.typeId ?? ""),
    compte: config.accounts?.find(a => a.id === t.accountId)?.label ?? t.compte,
    type: config.types?.find(p => p.id === t.typeId)?.label ?? t.type,
    transferId: roles.get(t.typeId ?? "") === "transfer" ? t.transferId : undefined,
  })), roles);
  const errors = configurationErrors(config, transactions);
  if (config.accounts?.some(a => !state.config?.accounts?.some(d => d.id === a.id))
    || config.accounts?.length !== state.config?.accounts?.length || config.types?.some(t => !state.config?.types?.some(d => d.id === t.id))
    || config.types?.length !== state.config?.types?.length) errors.push("Le catalogue doit conserver les identifiants existants. Pour ajouter un compte ou un type, réimportez un classeur complet.");
  if (errors.length) return { ok: false, errors, saved: false };
  state.setConfiguration(config, transactions);
  let saved = false;
  if (state.dataOrigin === "upload") saved = persistCurrentImport();
  else { try { localStorage.setItem(KEY, JSON.stringify(config)); saved = state.budgets ? saveLocalBudgets(state.budgets) : true; } catch { try { localStorage.removeItem(KEY); } catch { /* inaccessible */ } } }
  state.setStorageNotice(saved ? null : "Paramètres appliqués pour cette session. Le stockage local n'a pas pu être mis à jour.");
  return { ok: true, errors: [], saved };
}
