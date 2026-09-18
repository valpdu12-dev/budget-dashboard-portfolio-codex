import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import * as XLSX from "xlsx";
import { decodeTransactions } from "@/utils/decode";
import { useDataStore } from "@/stores/useDataStore";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useAvailableFeatures } from "@/hooks/useAvailableFeatures";
import { applyConfiguration, restoreDemoConfiguration } from "@/services/configurationPersistence";
import { migrateDataset } from "@/services/datasetMigration";
import { configurationErrors } from "@/services/configurationValidation";
import { parseWorkbook } from "@/services/workbookImport";
import type { ImportDataset } from "@/services/workbookImport";
import type { Config } from "@/types";
const json = (name: string) => JSON.parse(readFileSync(`public/data/${name}.json`, "utf8"));
const clone = (cfg: Config) => structuredClone(cfg);
beforeEach(() => { useDataStore.getState().reset(); localStorage.clear(); });
describe("Jeux fictifs livrés avec C", () => {
  it("rapproche chaque transfert et conserve le total bancaire de la démo", () => {
    const dataset: ImportDataset = { schemaVersion: 1, transactions: decodeTransactions(json("transactions")), config: json("config"), salary: json("salary"), budgets: json("budgets") };
    const migrated = migrateDataset(dataset);
    expect(configurationErrors(migrated.config, migrated.transactions)).toEqual([]);
    useDataStore.getState().setData(migrated.transactions, migrated.salary, migrated.config, { origin: "static" });
    const months = Array.from(new Set(migrated.transactions.map(t => t.monthKey))).sort();
    expect(renderHook(() => useAccountBalances(months)).result.current.currentBalances.Total).toBeCloseTo(46670.44, 2);
    expect(renderHook(() => useAvailableFeatures()).result.current).toMatchObject({ hasSalary: true, hasInflation: true, hasSavings: true, hasLoan: true });
    const cfg = clone(migrated.config); cfg.accounts![1].label = "Compte démo partagé";
    expect(applyConfiguration(cfg).saved).toBe(true);
    expect(restoreDemoConfiguration(migrated.config).config.accounts![1].label).toBe("Compte démo partagé");
  });
  it("le modèle v1 reproduit les données et les fonctionnalités de la démo", () => {
    const file = readFileSync("public/modeles/Budget_v1.xlsx");
    const buffer = new ArrayBuffer(file.length); new Uint8Array(buffer).set(file);
    const result = parseWorkbook(XLSX.read(buffer, { type: "array", cellDates: false, cellFormula: true }));
    expect(result.validation.ok).toBe(true);
    expect(result.validation.issues).toEqual([]);
    const demoTransactions = decodeTransactions(json("transactions"));
    const demoSalary = json("salary");
    const demoConfig = json("config");
    const demoBudgets = json("budgets");
    expect(result.dataset.transactions).toHaveLength(demoTransactions.length);
    const demoTransfers = new Set<string>(demoConfig.transfers);
    const comparableTransaction = (transaction: typeof demoTransactions[number], fromDemo: boolean) => ({
      date: transaction.date, label: transaction.label, compte: transaction.compte, dc: transaction.dc, montant: transaction.montant,
      type: fromDemo && demoTransfers.has(transaction.type) ? "Transfert interne" : transaction.type,
      cat1: fromDemo && demoTransfers.has(transaction.type) ? "" : transaction.cat1,
      cat2: fromDemo && demoTransfers.has(transaction.type) ? "" : transaction.cat2,
    });
    expect(result.dataset.transactions.map(transaction => comparableTransaction(transaction, false)))
      .toEqual(demoTransactions.map(transaction => comparableTransaction(transaction, true)));
    expect(Object.entries(result.dataset.config.init)).toEqual(Object.entries(demoConfig.init));
    expect(Object.entries(result.dataset.config.accountKinds ?? {})).toEqual(Object.entries(demoConfig.accountKinds));
    expect(result.dataset.config.loan).toEqual(demoConfig.loan);
    expect(result.dataset.salary.months).toEqual(demoSalary.months);
    expect(result.dataset.salary.inflation).toEqual(demoSalary.inflation);
    expect(result.dataset.salary.inflationByCategory).toEqual(demoSalary.inflationByCategory);
    expect(result.dataset.salary.smic).toEqual(demoSalary.smic);
    expect(result.dataset.budgets).toEqual(demoBudgets);
    useDataStore.getState().setImportedDataset(result.dataset, "Budget_v1.xlsx", "2026-09-15T12:00:00Z");
    const months = Array.from(new Set(result.dataset.transactions.map(t => t.monthKey))).sort();
    expect(renderHook(() => useAccountBalances(months)).result.current.currentBalances.Total).toBeCloseTo(46670.44, 2);
    expect(renderHook(() => useAvailableFeatures()).result.current).toMatchObject({ hasSalary: true, hasInflation: true, hasSavings: true, hasLoan: true });
    const cfg = clone(useDataStore.getState().config!); cfg.accounts![0].share = 50; cfg.perspective = "personal";
    expect(applyConfiguration(cfg).ok).toBe(true);
    expect(renderHook(() => useAccountBalances(months)).result.current.currentBalances.Total).toBeCloseTo(37216.94, 2);
  });
});
