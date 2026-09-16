import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import * as XLSX from "xlsx";
import { resetAllStores } from "../helpers/storeReset";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useExpenseData } from "@/hooks/useExpenseData";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useSavingsData } from "@/hooks/useSavingsData";
import { useDataStore } from "@/stores/useDataStore";
import { isImportDataset } from "@/services/importValidation";
import { parseWorkbook } from "@/services/workbookImport";

function legacyWorkbook(): XLSX.WorkBook {
  const transactionRows: unknown[][] = Array.from({ length: 18 }, () => []);
  transactionRows[17] = ["Transaction", "Compte", "Type Dépense", "Date"];
  const transaction = (label: string, account: string, type: string, amount: number, dc: "Débit" | "Crédit") => {
    const row: unknown[] = Array(19).fill(null);
    [row[0], row[1], row[2], row[3], row[5], row[6], row[7], row[18]] =
      [label, account, type, "2025-01-15", amount, "Dépense Courante", "Catégorie test", dc];
    return row;
  };
  transactionRows.push(
    transaction("Achat", "Compte principal", "Courses", 100, "Débit"),
    transaction("Remboursement", "Compte principal", "Courses", -10, "Débit"),
    transaction("Versement principal", "Compte principal", "Epargne CA", 50, "Débit"),
    transaction("Versement secondaire", "Compte principal", "Epargne secondaire", 30, "Débit"),
    transaction("Capital", "Compte principal", "Crédit Immobilier", 20, "Débit"),
    transaction("Retrait", "Sortie Epargne", "Epargne secondaire", 10, "Débit"),
    transaction("Revenu", "Compte principal", "Salaire", 200, "Crédit"),
  );

  const visualisationRows: unknown[][] = Array.from({ length: 28 }, () => []);
  visualisationRows[12] = [null, null, null, null, "Solde du compte principal", 700];
  visualisationRows[23] = ["Comptes", "Compte principal", "Compte principal - Part commune", "Compte joint", "Carte repas", "Compte secondaire - Courant"];
  visualisationRows[27] = ["Restant M", 999, null, 800, 273.15, null];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(transactionRows), "Transactions 2025");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[""]]), "Fiche de Paie");
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(visualisationRows), "Visualisation");
  return workbook;
}

beforeEach(() => resetAllStores());

describe("compatibilité avec le dashboard historique", () => {
  it("reproduit ses règles sans modifier le classeur source", () => {
    const result = parseWorkbook(legacyWorkbook());
    expect(result.validation.ok, JSON.stringify(result.validation.issues)).toBe(true);
    expect(isImportDataset(result.dataset)).toBe(true);
    expect(result.dataset.config.compatibility).toBe("legacy-dashboard-v1");

    useDataStore.getState().setImportedDataset(result.dataset, "budget-historique.xlsx", "2026-09-16T00:00:00Z");
    const filtered = renderHook(() => useFilteredData());
    const balances = renderHook(() => useAccountBalances(filtered.result.current.allMonths));
    const expenses = renderHook(() => useExpenseData());
    const savings = renderHook(() => useSavingsData());
    const income = filtered.result.current.baseTx.filter(t => t.dc === "Crédit").reduce((sum, t) => sum + t.montant, 0);

    expect(balances.result.current.accounts).toEqual(["Compte principal", "Compte joint", "Carte repas", "Compte secondaire - Courant"]);
    expect(balances.result.current.currentBalances).toMatchObject({
      "Compte principal": 700,
      "Compte joint": 800,
      "Carte repas": 273.15,
      "Compte secondaire - Courant": 0,
      Total: 1773.15,
    });
    expect(expenses.result.current.detailTotal).toBe(140);
    expect(expenses.result.current.detailRows).toHaveLength(4);
    expect(income).toBe(200);
    expect(savings.result.current.kpis.totalEntrees).toBe(100);
    expect(savings.result.current.kpis.totalSorties).toBe(10);
    expect(savings.result.current.kpis.totalEp).toBe(90);
    expect(savings.result.current.kpis.nbTx).toBe(4);
    expect(result.dataset.config.accounts?.filter(account => account.includeInBalance === false)).toHaveLength(2);
  });

  it("conserve les budgets paramétrés lors de la réimportation du même fichier", () => {
    const dataset = parseWorkbook(legacyWorkbook()).dataset;
    const store = useDataStore.getState();
    store.setImportedDataset(dataset, "budget-historique.xlsx", "2026-09-16T00:00:00Z");
    store.setBudgets({ budgets: [{ cat2: "Alimentation", target: 300, active: true, updated_at: null }] });

    useDataStore.getState().setImportedDataset(dataset, "budget-historique.xlsx", "2026-09-16T01:00:00Z");
    expect(useDataStore.getState().budgets?.budgets).toHaveLength(1);

    useDataStore.getState().setImportedDataset(dataset, "autre-budget.xlsx", "2026-09-16T02:00:00Z");
    expect(useDataStore.getState().budgets?.budgets).toEqual([]);
  });
});
