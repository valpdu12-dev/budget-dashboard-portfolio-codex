import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseWorkbook } from "@/services/workbookImport";
import { isImportDataset } from "@/services/importValidation";
import { importWorkbook, TX_HEADERS } from "../helpers/importFixture";

describe("Modèle Budget v1", () => {
  it("les anciens noms fictifs peuvent servir de types courants sans définir un transfert", () => {
    const wb = importWorkbook(false, false); wb.Sheets.Transactions.F2.v = "Épargne Horizon";
    const parsed = parseWorkbook(wb);
    expect(parsed.validation.ok).toBe(true);
  });
  it("signale les libellés incompatibles au niveau de leur ligne avant application", () => {
    const wb = importWorkbook(false, false); wb.Sheets.Transactions.F2.v = "prev_Total";
    expect(parseWorkbook(wb).validation.issues).toContainEqual(expect.objectContaining({ sheet: "Transactions", row: 2, column: "Type", severity: "error" }));
  });
  it.each([[true, true], [true, false], [false, true], [false, false]])("accepte salaire=%s et prêt=%s", (salary, loan) => {
    const { dataset, validation } = parseWorkbook(importWorkbook(salary, loan));
    expect(validation.issues).toEqual([]); expect(validation.ok).toBe(true);
    expect(isImportDataset(dataset)).toBe(true);
    expect(Boolean(dataset.salary.months.length)).toBe(salary); expect(Boolean(dataset.config.loan)).toBe(loan);
  });
  it.each([null, "12,50", -12, Infinity, 12.345])("refuse le montant %s sans le convertir en zéro", value => {
    const wb = importWorkbook(); wb.Sheets.Transactions.E2 = { t: typeof value === "number" ? "n" : "s", v: value } as XLSX.CellObject;
    const { validation } = parseWorkbook(wb);
    expect(validation.ok).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({ sheet: "Transactions", row: 2, column: "Montant", severity: "error" }));
  });
  it("refuse une date impossible et une date hors couverture", () => {
    const wb = importWorkbook(); wb.Sheets.Transactions.A2.v = "2025-02-30"; wb.Sheets.Transactions.A3.v = "2026-01-01";
    expect(parseWorkbook(wb).validation.issues.filter(i => i.column === "Date")).toHaveLength(2);
  });
  it("refuse un compte ou un solde initial manquant", () => {
    const wb = importWorkbook(); wb.Sheets.Comptes.B2.v = null; wb.Sheets.Transactions.C2.v = "Autre compte";
    expect(parseWorkbook(wb).validation.ok).toBe(false);
  });
  it("refuse les formules même avec un résultat numérique en cache", () => {
    const wb = importWorkbook(); wb.Sheets.Transactions.E2.f = "20+30";
    expect(parseWorkbook(wb).validation.issues).toContainEqual(expect.objectContaining({ row: 2, message: expect.stringContaining("sans formule") }));
  });
  it("rapproche les deux mouvements de chaque transfert", () => {
    const wb = importWorkbook(); wb.Sheets.Transactions.E5.v = 301;
    expect(parseWorkbook(wb).validation.issues).toContainEqual(expect.objectContaining({ column: "Transfert", severity: "error" }));
  });
  it("lit toutes les années sans omettre une feuille", () => {
    const wb = importWorkbook(false, false);
    wb.Sheets['Paramètres'].B3.v = "2024-01-01";
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TX_HEADERS, ["2024-06-01", "Ancien revenu", "Mon compte", "Crédit", 10, "Virement", null, "Revenus", null]]), "Transactions 2024");
    const parsed = parseWorkbook(wb);
    expect(parsed.validation.ok).toBe(true); expect(parsed.dataset.transactions.some(t => t.date.startsWith("2024"))).toBe(true);
    expect(parsed.validation.sheets).toEqual(["Transactions", "Transactions 2024"]);
  });
  it("signale les doublons sans supprimer un mouvement silencieusement", () => {
    const wb = importWorkbook(false, false);
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Transactions, { header: 1 });
    rows.push(rows[1]); wb.Sheets.Transactions = XLSX.utils.aoa_to_sheet(rows);
    const result = parseWorkbook(wb);
    expect(result.validation.ok).toBe(true); expect(result.validation.issues[0].severity).toBe("warning");
    expect(result.dataset.transactions).toHaveLength(5);
  });
  it("refuse les anciens formats et les feuilles inconnues avec une indication", () => {
    const wb = importWorkbook(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1]]), "Fiche de Paie");
    expect(parseWorkbook(wb).validation.ok).toBe(false);
  });
  it("convertit correctement les dates Excel, y compris le calendrier 1904", () => {
    for (const [date1904, serial] of [[false, 45667], [true, 44205]] as const) {
      const wb = importWorkbook(); wb.Workbook = { WBProps: { date1904 } }; wb.Sheets.Transactions.A2 = { t: "n", v: serial };
      expect(parseWorkbook(wb).dataset.transactions[0].date).toBe("2025-01-10");
    }
  });
  it("refuse un net de salaire incohérent et un prêt sans intérêts", () => {
    const wb = importWorkbook(); wb.Sheets.Salaires.D2.v = 3000; wb.Sheets.Transactions.E7.v = 0;
    expect(parseWorkbook(wb).validation.issues.filter(i => i.severity === "error").length).toBeGreaterThanOrEqual(2);
  });
});
