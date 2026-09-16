import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { importDataset } from "../helpers/importFixture";
import { resetAllStores } from "../helpers/storeReset";
import { migrateDataset } from "@/services/datasetMigration";
import { applyConfiguration, persistCurrentImport } from "@/services/configurationPersistence";
import { configurationErrors } from "@/services/configurationValidation";
import { clearImport, restoreImport } from "@/services/importPersistence";
import { isImportDataset } from "@/services/importValidation";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useMortgageData } from "@/hooks/useMortgageData";
import { useAvailableFeatures } from "@/hooks/useAvailableFeatures";
import { useNavigationTabs } from "@/hooks/useNavigationTabs";
import { projectTransactions } from "@/utils/businessRules";
import type { Config } from "@/types";

const months = ["2025-01", "2025-02"];
const copy = (config: Config) => structuredClone(config);
function setup(loan = false) {
  const dataset = importDataset(loan, loan);
  useDataStore.getState().setImportedDataset(dataset, "budget.xlsx", "2026-09-15T12:00:00Z");
  persistCurrentImport();
  return useDataStore.getState().config!;
}
beforeEach(() => { resetAllStores(); localStorage.clear(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("Lot C — migration et validation", () => {
  it("migre un import B sans modifier les montants, objectifs, salaire ou couverture", () => {
    const old = importDataset();
    old.transactions.forEach(t => { delete t.transferId; });
    const migrated = migrateDataset(old);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.transactions.map(t => t.montant)).toEqual(old.transactions.map(t => t.montant));
    expect(migrated.salary).toEqual(old.salary); expect(migrated.budgets).toEqual(old.budgets);
    expect(migrated.config.coverage).toEqual(old.config.coverage);
    expect(migrated.config.accounts?.map(a => a.share)).toEqual([100, 100]);
    expect(migrated.transactions.filter(t => t.role === "transfer").map(t => t.transferId)).toEqual(["migrated-transfer-1", "migrated-transfer-1"]);
    expect(migrated.config.loan?.account).toBe("account-001"); expect(isImportDataset(migrated)).toBe(true);
    expect(migrateDataset(migrated)).toBe(migrated);
  });
  it("restaure et mémorise automatiquement l'ancien stockage v2 sans charger la démo", () => {
    const old = importDataset(); old.transactions.forEach(t => { delete t.transferId; });
    localStorage.setItem("budget-demo.import.v2", JSON.stringify({ ...old, storageVersion: 2, fileName: "ancien.xlsx", importedAt: "2026-09-14T12:00:00Z" }));
    const result = restoreImport();
    expect(result.data?.schemaVersion).toBe(2); expect(result.data?.fileName).toBe("ancien.xlsx");
    expect(result.notice).toBeNull(); expect(localStorage.getItem("budget-demo.import.v2")).toBeNull();
    expect(JSON.parse(localStorage.getItem("budget-demo.import.v3")!).storageVersion).toBe(3);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("conserve l'ancien stockage si la migration dépasse le quota", () => {
    localStorage.setItem("budget-demo.import.v2", JSON.stringify({ ...importDataset(), storageVersion: 2, fileName: "ancien.xlsx", importedAt: "2026-09-14T12:00:00Z" }));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(restoreImport().data?.config.accounts).toHaveLength(2);
    expect(restoreImport().notice).toContain("précédent reste conservé");
    expect(localStorage.getItem("budget-demo.import.v2")).not.toBeNull();
  });
  it.each([NaN, -1, 101, 33.333])("refuse une quote-part invalide %s sans modifier le jeu", share => {
    const before = setup(); const config = copy(before); config.accounts![0].share = share;
    expect(applyConfiguration(config).ok).toBe(false); expect(useDataStore.getState().config).toBe(before);
  });
  it("refuse les noms dupliqués, les identifiants modifiés et les soldes invalides", () => {
    const before = setup(); const cfg = copy(before); cfg.accounts![0].label = cfg.accounts![1].label;
    expect(applyConfiguration(cfg).ok).toBe(false);
    cfg.accounts![0].label = "Compte"; cfg.accounts![0].id = "nouveau"; expect(applyConfiguration(cfg).ok).toBe(false);
    cfg.accounts![0].id = before.accounts![0].id; cfg.accounts![0].initialBalance = 12.345; expect(applyConfiguration(cfg).ok).toBe(false);
  });
  it("refuse un type courant changé en transfert sans deux mouvements associés", () => {
    const cfg = copy(setup()); cfg.types![0].role = "transfer";
    expect(applyConfiguration(cfg).errors.join(" ")).toContain("relier deux mouvements");
  });
  it("refuse un transfert altéré dans le stockage normalisé", () => {
    setup(); const data = restoreImport().data!; data.transactions.find(t => t.role === "transfer")!.montant += 1;
    expect(isImportDataset(data)).toBe(false);
  });
  it("efface les trois versions d'import", () => {
    setup(); localStorage.setItem("budget-demo.import.v2", "ancien"); localStorage.setItem("budget-demo.import.v1", "ancien");
    expect(clearImport()).toBe(true); expect(localStorage.length).toBe(0);
  });
});

describe("Lot C — comptes, quote-part et types", () => {
  it("conserve le solde bancaire et calcule la quote-part sans division supplémentaire", () => {
    const cfg = copy(setup()); cfg.accounts![0].share = 50;
    applyConfiguration(cfg);
    const balances = renderHook(() => useAccountBalances(months));
    expect(balances.result.current.currentBalances.Total).toBe(3950);
    const flow = renderHook(() => useExpenseData());
    expect(flow.result.current.detailTotal).toBe(50);
    act(() => { applyConfiguration({ ...cfg, perspective: "personal" }); });
    expect(balances.result.current.currentBalances).toEqual({ "Mon compte": 1725, "Mon livret": 500, Total: 2225 });
    expect(flow.result.current.detailTotal).toBe(25);
    expect(useDataStore.getState().transactions[0].montant).toBe(50);
    const tx = projectTransactions(useDataStore.getState().transactions, useDataStore.getState().config);
    expect(projectTransactions(tx, useDataStore.getState().config)[0].montant).toBe(25);
  });
  it("calcule les soldes personnels depuis le solde bancaire pour éviter les dérives d'arrondi", () => {
    const cfg = copy(setup()); cfg.accounts![0].share = 33.33; cfg.perspective = "personal";
    applyConfiguration(cfg);
    const { result } = renderHook(() => useAccountBalances(months));
    expect(result.current.currentBalances["Mon compte"]).toBe(1149.89);
  });
  it("le renommage d'un compte et d'un type conserve les filtres et les totaux", () => {
    const cfg = copy(setup());
    useFilterStore.setState({ selType: cfg.types![0].id, selOrg: cfg.accounts![0].id });
    const { result } = renderHook(() => useExpenseData());
    expect(result.current.detailTotal).toBe(50);
    cfg.accounts![0].label = "Compte partagé"; cfg.types![0].label = "Achats";
    act(() => { expect(applyConfiguration(cfg).ok).toBe(true); });
    expect(result.current.detailTotal).toBe(50); expect(result.current.detailRows[0].compte).toBe("Compte partagé");
    expect(result.current.expByType[0]).toMatchObject({ id: cfg.types![0].id, fullName: "Achats", value: 50 });
    expect(result.current.expMonthlyLines[0][cfg.accounts![0].id]).toBe(50);
    expect(result.current.organismes[0].label).toBe("Compte partagé");
    expect(restoreImport().data?.config.accounts![0].label).toBe("Compte partagé"); expect(fetch).not.toHaveBeenCalled();
  });
  it("un libellé de transfert donné à une opération courante ne change pas son rôle", () => {
    const cfg = copy(setup()); cfg.types![0].label = "Épargne Horizon";
    expect(applyConfiguration(cfg).ok).toBe(true);
    const { result } = renderHook(() => useExpenseData()); expect(result.current.detailTotal).toBe(50);
  });
  it("les transferts renommés restent neutres dans les dépenses et recettes, même affichés", () => {
    const cfg = copy(setup()); cfg.types!.find(t => t.role === "transfer")!.label = "Versements entre comptes";
    cfg.accounts![0].share = 50; cfg.perspective = "personal"; applyConfiguration(cfg);
    useFilterStore.setState({ showTransfers: true });
    const expense = renderHook(() => useExpenseData()); expect(expense.result.current.detailTotal).toBe(25);
    const savings = renderHook(() => useSavingsData());
    expect(savings.result.current.kpis.totalRec).toBe(1400); expect(savings.result.current.kpis.totalEntrees).toBe(300);
    expect(configurationErrors(useDataStore.getState().config!, useDataStore.getState().transactions)).toEqual([]);
  });
  it("isole les objectifs personnels des objectifs bancaires après rechargement", async () => {
    const cfg = copy(setup()); cfg.perspective = "personal"; cfg.accounts![0].share = 50; applyConfiguration(cfg);
    const { result } = renderHook(() => useBudgetData());
    expect(result.current.rows[0].target).toBeNull();
    await act(async () => { await result.current.updateBudget("Alimentation", 80); });
    expect(result.current.rows[0].target).toBe(80); expect(result.current.rows[0].averageMonthly).toBe(12.5);
    const restored = restoreImport().data!; expect(restored.budgets.budgets[0].target).toBe(150);
    expect(restored.budgets.personalBudgets![0].target).toBe(80); expect(restored.config.perspective).toBe("personal");
    act(() => { applyConfiguration({ ...useDataStore.getState().config!, perspective: "bank" }); });
    expect(result.current.rows[0].target).toBe(150); expect(result.current.rows[0].averageMonthly).toBe(25);
  });
  it("permet un compte à quote-part nulle", () => {
    const cfg = copy(setup()); cfg.perspective = "personal"; cfg.accounts![0].share = 0; applyConfiguration(cfg);
    const { result } = renderHook(() => useAccountBalances(months)); expect(result.current.currentBalances.Total).toBe(500);
    expect(projectTransactions(useDataStore.getState().transactions, cfg)[0].montant).toBe(0);
  });
  it("renomme capital/intérêts/compte du prêt sans changer le suivi contractuel", () => {
    const cfg = copy(setup(true)); const { result } = renderHook(() => useMortgageData());
    const before = result.current.historyData;
    cfg.accounts![0].label = "Logement partagé"; cfg.accounts![0].share = 50; cfg.perspective = "personal";
    cfg.types!.filter(t => t.role.startsWith("loan-")).forEach(t => { t.label = `Mon ${t.role}`; });
    act(() => { expect(applyConfiguration(cfg).ok).toBe(true); });
    expect(result.current.historyData).toEqual(before); expect(result.current.historyData[0].total).toBe(932.19);
    expect(renderHook(() => useAvailableFeatures()).result.current.hasLoan).toBe(true);
  });
  it("refuse une modification de prêt qui ne correspond pas aux opérations", () => {
    const cfg = copy(setup(true)); cfg.loan!.payment = 950;
    expect(applyConfiguration(cfg).ok).toBe(false);
  });
  it("un compte courant sans paie, prêt ni épargne masque les rubriques facultatives", () => {
    const old = importDataset(false, false);
    old.transactions = old.transactions.filter(t => t.type !== "Transfert interne");
    old.config.comptes = ["Mon compte"]; old.config.init = { "Mon compte": 1000 }; old.config.accountKinds = { "Mon compte": "Courant" };
    useDataStore.getState().setImportedDataset(old, "simple.xlsx", "2026-09-15T12:00:00Z");
    const { result } = renderHook(() => useAvailableFeatures());
    expect(result.current).toMatchObject({ hasSalary: false, hasLoan: false, hasSavings: false });
    expect(renderHook(() => useNavigationTabs()).result.current.some(t => t.id === "patrimoine")).toBe(false);
    const tx = renderHook(() => useFilteredData()); expect(tx.result.current.allMonths).toEqual(months);
  });
  it("la rubrique épargne dépend de la nature du compte et reste présente sur une période vide", () => {
    const cfg = copy(setup());
    const { result } = renderHook(() => useAvailableFeatures()); expect(result.current.hasSavings).toBe(true);
    act(() => { cfg.accounts![1].kind = "Courant"; applyConfiguration(cfg); });
    expect(result.current.hasSavings).toBe(false);
  });
});
