import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBalances } from "@/hooks/useBalances";
import { useAvailableFeatures } from "@/hooks/useAvailableFeatures";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { loadImport, saveImport } from "@/services/importPersistence";
import { importDataset } from "../helpers/importFixture";
import { resetAllStores } from "../helpers/storeReset";
beforeEach(() => { localStorage.clear(); resetAllStores(); vi.restoreAllMocks(); });
function apply(salary = true, loan = true) {
  const data = importDataset(salary, loan);
  useDataStore.getState().setImportedDataset(data, "test.xlsx", "2026-09-15T12:00:00Z");
  saveImport({ ...data, storageVersion: 2, fileName: "test.xlsx", importedAt: "2026-09-15T12:00:00Z" });
  return data;
}
describe("Comportement du jeu personnel", () => {
  it.each([[true, true], [true, false], [false, true], [false, false]])("adapte les vues salaire=%s et prêt=%s", (salary, loan) => {
    apply(salary, loan);
    const { result } = renderHook(() => useAvailableFeatures());
    expect(result.current.hasSalary).toBe(salary); expect(result.current.hasLoan).toBe(loan);
    expect(result.current.hasInflation).toBe(false);
  });
  it("calcule les comptes libres sans division ni contrepartie implicite", () => {
    const data = apply(false, false);
    const { result } = renderHook(() => useBalances(data.transactions, ["2025-01", "2025-02"], data.config.init, data.config.comptes));
    expect(result.current.currentBalances).toEqual({ "Mon compte": 3450, "Mon livret": 500, Total: 3950 });
    expect(result.current.balanceChartData(["2025-02"])[0]).toMatchObject({ "Mon compte": 3450, "Mon livret": 500 });
  });
  it("compte un transfert vers un livret comme entrée d'épargne", () => {
    apply(false, false);
    const { result } = renderHook(() => useSavingsData());
    expect(result.current.kpis.totalEntrees).toBe(300); expect(result.current.kpis.totalRec).toBe(2800);
    act(() => useFilterStore.getState().setShowTransfers(true));
    expect(result.current.kpis.totalRec).toBe(2800);
  });
  it("mémorise les budgets personnels dans le même paquet sans écraser ceux de la démo", async () => {
    apply(); localStorage.setItem("budget-demo.budgets.v1", JSON.stringify({ budgets: [{ cat2: "Demo", target: 999 }] }));
    const { result } = renderHook(() => useBudgetData());
    await act(async () => { await result.current.updateBudget("Alimentation", 225); });
    expect(loadImport()?.budgets.budgets[0].target).toBe(225);
    expect(JSON.parse(localStorage.getItem("budget-demo.budgets.v1")!).budgets[0].target).toBe(999);
  });
});
