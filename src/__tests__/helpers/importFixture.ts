import * as XLSX from "xlsx";
import { parseWorkbook } from "@/services/workbookImport";
export const TX_HEADERS = ["Date", "Libellé", "Compte", "Sens", "Montant", "Type", "Catégorie", "Sous-catégorie", "Transfert"];
export function importWorkbook(salary = true, loan = true) {
  const wb = XLSX.utils.book_new();
  const add = (name: string, data: unknown[][]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), name);
  add("Paramètres", [["Paramètre", "Valeur"], ["Version", 1], ["Début couverture", "2025-01-01"], ["Fin couverture", "2025-02-28"]]);
  add("Comptes", [["Compte", "Solde initial", "Nature"], ["Mon compte", 1000, "Courant"], ["Mon livret", 200, "Épargne"]]);
  add("Transactions", [TX_HEADERS,
    ["2025-01-10", "Courses", "Mon compte", "Débit", 50, "CB", "Dépense Courante", "Alimentation", null],
    ["2025-02-25", "Revenu", "Mon compte", "Crédit", 2800, "Virement", null, "Revenus", null],
    ["2025-02-20", "Épargne", "Mon compte", "Débit", 300, "Transfert interne", null, null, "v1"],
    ["2025-02-20", "Épargne", "Mon livret", "Crédit", 300, "Transfert interne", null, null, "v1"],
    ...(loan ? [
      ["2025-02-15", "Capital", "Mon compte", "Débit", 594.46, "Crédit Immobilier", "Dépense Fixe", "Logement", null],
      ["2025-02-15", "Intérêts", "Mon compte", "Débit", 337.73, "Intérêt du prêt", "Dépense Fixe", "Logement", null],
    ] : []),
  ]);
  if (salary) add("Salaires", [["Mois", "Employeur", "Brut", "Net", "Cotisations", "Indemnités", "Retenues"], ["2025-02", "Mon employeur", 3500, 2800, 700, 0, 0]]);
  if (loan) add("Prêt", [["Compte", "Capital initial", "Mensualité", "Nombre échéances"], ["Mon compte", 180000, 932.19, 240]]);
  add("Budgets", [["Sous-catégorie", "Budget mensuel"], ["Alimentation", 150]]);
  return wb;
}
export function importDataset(salary = true, loan = true) { return parseWorkbook(importWorkbook(salary, loan)).dataset; }
