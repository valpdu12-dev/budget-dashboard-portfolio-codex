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
  it("accepte les formules lorsque leur résultat est enregistré dans le classeur", () => {
    const wb = importWorkbook(); wb.Sheets.Transactions.E2.f = "20+30";
    expect(parseWorkbook(wb).validation.ok).toBe(true);
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
  it("ignore les feuilles de suivi reconnues mais signale les feuilles réellement inconnues", () => {
    const wb = importWorkbook(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1]]), "Fiche de Paie");
    expect(parseWorkbook(wb).validation.ok).toBe(true);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[1]]), "Inconnue");
    expect(parseWorkbook(wb).validation.ok).toBe(false);
  });
  it("convertit correctement les dates Excel, y compris le calendrier 1904", () => {
    for (const [date1904, serial] of [[false, 45667], [true, 44205]] as const) {
      const wb = importWorkbook(); wb.Workbook = { WBProps: { date1904 } }; wb.Sheets.Transactions.A2 = { t: "n", v: serial };
      expect(parseWorkbook(wb).dataset.transactions[0].date).toBe("2025-01-10");
    }
  });
  it("accepte les rubriques salariales copiées du bulletin et refuse un prêt sans intérêts", () => {
    const wb = importWorkbook(); wb.Sheets.Salaires.D2.v = 3000; wb.Sheets.Transactions.E7.v = 0;
    const issues = parseWorkbook(wb).validation.issues;
    expect(issues.some(i => i.sheet === "Salaires" && i.column === "Net")).toBe(false);
    expect(issues.some(i => i.sheet === "Prêt" && i.severity === "error")).toBe(true);
  });
  it("importe les indices d’inflation et le SMIC quand l’onglet est présent", () => {
    const wb = importWorkbook();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Année", "Inflation annuelle", "Alimentation", "Services", "Énergie", "Transports", "Produits manufacturés", "SMIC net mensuel", "Date effet SMIC"],
      ["2025", 1, 1.3, 2.2, -2.5, 1.1, -0.4, 1426.3, "01/01/2025"],
    ]), "Inflation");
    const parsed = parseWorkbook(wb);
    expect(parsed.validation.ok).toBe(true);
    expect(parsed.validation.hasInflation).toBe(true);
    expect(parsed.dataset.salary.inflation?.[0]).toMatchObject({ year: "2025", rate_annual: 1 });
    expect(parsed.dataset.salary.smic?.[0]).toMatchObject({ year: "2025", net_monthly: 1426.3 });
  });
  it("préserve les paramètres de compatibilité, comptes techniques et rôles KPI", () => {
    const wb = importWorkbook(false, false);
    XLSX.utils.sheet_add_aoa(wb.Sheets["Paramètres"], [["Compatibilité", "legacy-dashboard-v1"]], { origin: "A5" });
    XLSX.utils.sheet_add_aoa(wb.Sheets.Comptes, [["Inclure dans le solde"], ["Non"]], { origin: "D1" });
    XLSX.utils.sheet_add_aoa(wb.Sheets.Transactions, [["Rôle KPI"], ["ordinary"]], { origin: "J1" });
    wb.Sheets.Transactions.E2.v = -12;
    const parsed = parseWorkbook(wb);
    expect(parsed.validation.ok).toBe(true);
    expect(parsed.dataset.config.compatibility).toBe("legacy-dashboard-v1");
    expect(parsed.dataset.config.accounts?.[0].includeInBalance).toBe(false);
    expect(parsed.dataset.transactions[0]).toMatchObject({ montant: -12, kpiRole: "ordinary" });
  });
});

describe("Compatibilité avec l'ancien classeur Budget", () => {
  function legacyWorkbook() {
    const wb = XLSX.utils.book_new();
    const salaryRows: unknown[][] = Array.from({ length: 11 }, () => []);
    salaryRows.push(["Ordre", "Entreprise", "Détail", "Qui", "Catégorie", "Designation", "Date", "Montant"]);
    salaryRows.push([1, "Employeur", "Salaire", "Salarié", "SALAIRE", "Rémunération brute", 45658, 3500]);
    salaryRows.push([2, "Employeur", "Somme", "Salarié", "*COTISAT.SALARIALES.(2)", "Cotisations", 45658, 700]);
    salaryRows.push([3, "Employeur", "Somme", "Salarié", "*AUTRES RETENUES....(4)", "Retenues", 45658, 100]);
    const salary = XLSX.utils.aoa_to_sheet(salaryRows);
    salary.H13.f = "1000+2500";
    XLSX.utils.book_append_sheet(wb, salary, "Fiche de Paie");

    const txRows: unknown[][] = Array.from({ length: 17 }, () => []);
    txRows.push(["Transaction", "Compte", "Type Dépense", "Date", "Montant", "Montant réel", "Catégorie 1", "Catégorie 22", "Catégorie 3", "Catégorie 4", "Prévisionnel", null, "Pays", "Ville", null, null, null, null, "Débit/Crédit"]);
    txRows.push(["Courses partagées", "Compte familial - Part commune", "Courses", 45658, 100, 50, "Dépense Courante", "Alimentation", "Marchand", "", "", "", "France", "Paris", null, null, null, null, "Débit"]);
    txRows.push(["Transfert", "Compte commun", "Transfert principal vers commun", 45659, 200, 100, "Dépense Occasionnelle", "", "", "", "", "", "France", "Paris", null, null, null, null, "Crédit"]);
    txRows.push(["Prévision", "Compte principal - Courant", "Courses", 45660, 10, 10, "Dépense Courante", "Alimentation", "", "", "x", "", "France", "Paris", null, null, null, null, "Débit"]);
    const tx = XLSX.utils.aoa_to_sheet(txRows);
    tx.E19.v = -100;
    tx.F19.v = -50;
    tx.F19.f = "E19/2";
    XLSX.utils.book_append_sheet(wb, tx, "Transactions 2025");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Comptes", "Compte principal - Courant", "Compte commun"],
      ["Restant M", 900, 300],
    ]), "Visualisation");
    return wb;
  }

  it("lit les valeurs calculées, adapte les comptes techniques et reconstruit les transferts", () => {
    const result = parseWorkbook(legacyWorkbook());
    expect(result.validation.ok).toBe(true);
    expect(result.validation.nbTransactions).toBe(2);
    expect(result.validation.issues).toEqual([expect.objectContaining({ severity: "warning", message: expect.stringContaining("Ancien format reconnu") })]);
    expect(result.dataset.transactions.filter(transaction => transaction.transferId)).toHaveLength(2);
    expect(result.dataset.transactions.find(transaction => transaction.label === "Courses partagées")?.compte).toBe("Compte principal - Courant");
    expect(result.dataset.salary.months[0]).toEqual(expect.objectContaining({ brut: 3500, net: 2700 }));
    expect(isImportDataset(result.dataset)).toBe(true);
  });

  it("accepte aussi les formules enregistrées dans le modèle public", () => {
    const wb = importWorkbook();
    wb.Sheets.Transactions.E2.f = "20+30";
    expect(parseWorkbook(wb).validation.ok).toBe(true);
  });
});
