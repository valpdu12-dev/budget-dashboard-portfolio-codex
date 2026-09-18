import * as XLSX from "xlsx";
import type { BudgetData, Config, SalaryData, Transaction } from "@/types";
import { validISODate } from "@/utils/importDate";
import { loanSchedule, closestLoanTerm } from "@/utils/loanRate";
import { validCatalogLabel, configurationErrors } from "./configurationValidation";
import { migrateDataset } from "./datasetMigration";
import { isLegacyWorkbook, parseLegacyWorkbook } from "./legacyWorkbookImport";

export interface ImportDataset {
  schemaVersion: 1 | 2;
  transactions: Transaction[];
  salary: SalaryData;
  config: Config;
  budgets: BudgetData;
}
export interface ImportIssue {
  severity: "error" | "warning";
  sheet: string;
  row: number;
  column: string;
  message: string;
}
export interface ValidationReport {
  ok: boolean;
  nbTransactions: number;
  dateMin: string;
  dateMax: string;
  nbMois: number;
  comptes: string[];
  totalDebits: number;
  totalCredits: number;
  net: number;
  nbSalaryMonths: number;
  lastSalaryMonth: string;
  lastNetSalary: number;
  issues: ImportIssue[];
  sheets: string[];
  hasLoan: boolean;
  hasInflation: boolean;
}
const text = (v: unknown) => v == null ? "" : String(v).replace(/\u00a0/g, " ").trim();
const round = (v: number) => Math.round(v * 100) / 100;
function dateValue(v: unknown, date1904: boolean): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v, { date1904 });
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return text(v);
}
/** Une cellule vide ou du texte ne devient jamais un montant nul. */
export function parseWorkbook(wb: XLSX.WorkBook): { dataset: ImportDataset; validation: ValidationReport } {
  if (isLegacyWorkbook(wb)) return parseLegacyWorkbook(wb);
  const issues: ImportIssue[] = [];
  const issue = (sheet: string, row: number, column: string, message: string, severity: ImportIssue["severity"] = "error") => {
    issues.push({ sheet, row, column, message, severity });
  };
  const date1904 = Boolean(wb.Workbook?.WBProps?.date1904);
  for (const name of wb.SheetNames.filter(n => n !== "Notice")) {
    for (const [address, cell] of Object.entries(wb.Sheets[name])) {
      if (!address.startsWith("!") && cell.f) issue(name, XLSX.utils.decode_cell(address).r + 1, address.replace(/\d/g, ""), "Saisissez une valeur, sans formule. Collez les valeurs de votre source.");
    }
  }
  function rows(name: string, headers: string[], required = false): unknown[][] {
    const sheet = wb.Sheets[name];
    if (!sheet) {
      if (required) issue(name, 1, "", "Feuille obligatoire absente. Téléchargez le modèle Budget v1.");
      return [];
    }
    const data = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
    if (headers.some((h, i) => text(data[0]?.[i]) !== h)) {
      issue(name, 1, "", `En-têtes attendus : ${headers.join(" / ")}.`);
      return [];
    }
    return data.slice(1);
  }
  function money(v: unknown, sheet: string, row: number, col: string, negative = false): number {
    if (typeof v !== "number" || !Number.isFinite(v) || (!negative && v < 0) || Math.abs(v) > 1e12) {
      issue(sheet, row, col, `Nombre ${negative ? "" : "positif ou nul "}obligatoire, saisi comme nombre Excel.`);
      return NaN;
    }
    if (Math.abs(v - round(v)) > 1e-7) issue(sheet, row, col, "Deux décimales maximum.");
    return round(v);
  }
  const active = (r: unknown[]) => r.some(v => v != null && text(v) !== "");
  const txSheets = wb.SheetNames.filter(n => /^Transactions(?: \d{4})?$/.test(n));
  for (const n of wb.SheetNames) {
    if (!["Notice", "Paramètres", "Comptes", "Salaires", "Inflation", "Budgets", "Prêt", ...txSheets].includes(n)) issue(n, 1, "", "Feuille non reconnue : son contenu ne sera pas importé.");
  }
  const settings = new Map<string, unknown>();
  rows("Paramètres", ["Paramètre", "Valeur"], true).forEach((r, i) => {
    if (!active(r)) return;
    const k = text(r[0]);
    if (!["Version", "Début couverture", "Fin couverture"].includes(k) || settings.has(k)) issue("Paramètres", i + 2, "Paramètre", "Paramètre inconnu ou présent plusieurs fois.");
    settings.set(k, r[1]);
  });
  if (settings.get("Version") !== 1) issue("Paramètres", 2, "Version", "Version prise en charge : 1 (nombre).");
  const dateMin = dateValue(settings.get("Début couverture"), date1904);
  const dateMax = dateValue(settings.get("Fin couverture"), date1904);
  if (!validISODate(dateMin) || !validISODate(dateMax) || dateMin > dateMax) issue("Paramètres", 1, "Valeur", "Déclarez des bornes valides YYYY-MM-DD, dans l'ordre chronologique.");
  const init: Record<string, number> = Object.create(null);
  const accountKinds: Record<string, "Courant" | "Épargne"> = Object.create(null);
  rows("Comptes", ["Compte", "Solde initial", "Nature"], true).forEach((r, i) => {
    if (!active(r)) return;
    const name = text(r[0]);
    if (!validCatalogLabel(name) || name in init) issue("Comptes", i + 2, "Compte", "Nom obligatoire et unique (100 caractères maximum), sans nom technique réservé : Total, monthKey, label, name, mk, __proto__, constructor, prototype ou préfixe prev_.");
    else init[name] = money(r[1], "Comptes", i + 2, "Solde initial", true);
    const kind = text(r[2]);
    if (kind !== "Courant" && kind !== "Épargne") issue("Comptes", i + 2, "Nature", "Valeurs admises : Courant ou Épargne.");
    else accountKinds[name] = kind;
  });
  if (!Object.keys(init).length) issue("Comptes", 2, "Compte", "Déclarez au moins un compte et son solde avant le début de couverture.");
  const transactions: Transaction[] = [];
  const transfers = new Map<string, { tx: Transaction; sheet: string; row: number }[]>();
  const seen = new Set<string>();
  if (!txSheets.length) issue("Transactions", 1, "", "Feuille Transactions absente.");
  txSheets.forEach(name => rows(name, ["Date", "Libellé", "Compte", "Sens", "Montant", "Type", "Catégorie", "Sous-catégorie", "Transfert"]).forEach((r, i) => {
    if (!active(r)) return;
    const row = i + 2;
    const date = dateValue(r[0], date1904);
    if (!validISODate(date) || date < dateMin || date > dateMax) issue(name, row, "Date", "Date invalide ou hors couverture déclarée.");
    if (name !== "Transactions" && date.slice(0, 4) !== name.slice(-4)) issue(name, row, "Date", "L'année de la date diffère de celle de la feuille.");
    const label = text(r[1]), compte = text(r[2]), dc = text(r[3]), transfer = text(r[8]);
    if (!label) issue(name, row, "Libellé", "Libellé obligatoire.");
    if (!(compte in init)) issue(name, row, "Compte", "Compte absent de la feuille Comptes.");
    if (!["Débit", "Crédit"].includes(dc)) issue(name, row, "Sens", "Valeurs admises : Débit ou Crédit.");
    const montant = money(r[4], name, row, "Montant");
    const type = transfer ? "Transfert interne" : text(r[5]);
    if (!validCatalogLabel(type)) issue(name, row, "Type", "Type obligatoire (100 caractères maximum), sans nom technique réservé ni préfixe prev_.");
    if (!transfer && type === "Transfert interne") issue(name, row, "Transfert", "Identifiant commun aux deux mouvements obligatoire.");
    const cat1 = transfer ? "" : text(r[6]);
    if (dc === "Débit" && cat1 && !["Dépense Fixe", "Dépense Courante", "Dépense Occasionnelle"].includes(cat1)) issue(name, row, "Catégorie", "Catégorie inconnue. Utilisez la liste du modèle.");
    if (dc === "Débit" && !transfer && !text(r[7])) issue(name, row, "Sous-catégorie", "Sous-catégorie obligatoire pour les dépenses.");
    const tx = { date, label, compte, dc, montant, type, cat1, cat2: transfer ? "" : text(r[7]), cat3: label, cat4: "", ville: "", monthKey: date.slice(0, 7), ...(transfer ? { transferId: transfer } : {}) };
    const fingerprint = JSON.stringify(tx);
    if (seen.has(fingerprint)) issue(name, row, "", "Mouvement identique déjà présent. Vérifiez un éventuel doublon.", "warning");
    seen.add(fingerprint);
    transactions.push(tx);
    if (transfer) transfers.set(transfer, [...(transfers.get(transfer) ?? []), { tx, sheet: name, row }]);
  }));
  if (!transactions.length) issue("Transactions", 2, "", "Au moins une transaction est nécessaire.");
  transfers.forEach(group => {
    const a = group[0], b = group[1];
    if (group.length !== 2 || a.tx.compte === b?.tx.compte || a.tx.dc === b?.tx.dc || a.tx.date !== b?.tx.date || a.tx.montant !== b?.tx.montant) issue(a.sheet, a.row, "Transfert", "Deux mouvements de même date et montant, sur deux comptes différents et de sens opposés, sont requis.");
  });
  const salary: SalaryData = { months: [], cotLast: [], patronLast: [] };
  const salaryKeys = new Set<string>();
  rows("Salaires", ["Mois", "Employeur", "Brut", "Net", "Cotisations", "Indemnités", "Retenues"]).forEach((r, i) => {
    if (!active(r)) return;
    const row = i + 2, mk = text(r[0]), entreprise = text(r[1]);
    if (!validISODate(`${mk}-01`) || mk < dateMin.slice(0, 7) || mk > dateMax.slice(0, 7)) issue("Salaires", row, "Mois", "Mois YYYY-MM obligatoire, dans la couverture déclarée.");
    if (!entreprise || salaryKeys.has(mk)) issue("Salaires", row, "Employeur", "Employeur obligatoire et une seule ligne de salaire par mois.");
    salaryKeys.add(mk);
    const [brut, net, cotSal, indem, retenues] = r.slice(2, 7).map((v, j) => money(v, "Salaires", row, ["Brut", "Net", "Cotisations", "Indemnités", "Retenues"][j]));
    salary.months.push({ mk, entreprise, brut, net, cotSal, indem, retenues });
  });
  salary.months.sort((a, b) => a.mk.localeCompare(b.mk));
  salary.lastMonth = salary.months[salary.months.length - 1]?.mk;
  const inflationYears = new Set<string>();
  rows("Inflation", ["Année", "Inflation annuelle", "Alimentation", "Services", "Énergie", "Transports", "Produits manufacturés", "SMIC net mensuel", "Date effet SMIC"]).forEach((r, i) => {
    if (!active(r)) return;
    const row = i + 2, year = text(r[0]);
    if (!/^\d{4}$/.test(year) || inflationYears.has(year)) issue("Inflation", row, "Année", "Année obligatoire et unique au format AAAA.");
    inflationYears.add(year);
    const [rateAnnual, alimentation, services, energie, transports, produitsManufactures] = r.slice(1, 7).map((v, j) => money(v, "Inflation", row, ["Inflation annuelle", "Alimentation", "Services", "Énergie", "Transports", "Produits manufacturés"][j], true));
    const netMonthly = money(r[7], "Inflation", row, "SMIC net mensuel");
    const dateEffective = text(r[8]);
    if (dateEffective && !/^\d{2}\/\d{2}\/\d{4}$/.test(dateEffective)) issue("Inflation", row, "Date effet SMIC", "Date obligatoire au format JJ/MM/AAAA.");
    salary.inflation ??= [];
    salary.inflationByCategory ??= [];
    salary.smic ??= [];
    salary.inflation.push({ year, rate_annual: rateAnnual, rate_alimentation: alimentation, rate_services: services, rate_energie: energie, rate_transports: transports, rate_produits_manufactures: produitsManufactures });
    salary.inflationByCategory.push({ year, rate_annual: rateAnnual, rate_alimentation: alimentation, rate_services: services, rate_energie: energie, rate_transports: transports, rate_produits_manufactures: produitsManufactures });
    salary.smic.push({ year, net_monthly: netMonthly, date_effective: dateEffective });
  });
  const budgets: BudgetData = { budgets: [] };
  const cats = new Set<string>();
  rows("Budgets", ["Sous-catégorie", "Budget mensuel"]).forEach((r, i) => {
    if (!active(r)) return;
    const cat2 = text(r[0]);
    if (!cat2 || cats.has(cat2)) issue("Budgets", i + 2, "Sous-catégorie", "Sous-catégorie obligatoire et unique.");
    cats.add(cat2);
    budgets.budgets.push({ cat2, target: money(r[1], "Budgets", i + 2, "Budget mensuel"), active: true, updated_at: null });
  });
  const config: Config = { init, comptes: Object.keys(init), accountKinds, balanceMode: "direct", transfers: ["Transfert interne"], coverage: { dateMin, dateMax } };
  const loanRows = rows("Prêt", ["Compte", "Capital initial", "Mensualité", "Nombre échéances"]).map((r, i) => ({ r, row: i + 2 })).filter(({ r }) => active(r));
  if (loanRows.length > 1) issue("Prêt", loanRows[1].row, "", "Un seul prêt est pris en charge dans le modèle v1.");
  if (loanRows[0]) {
    const { r, row } = loanRows[0];
    const account = text(r[0]), principal = money(r[1], "Prêt", row, "Capital initial"), payment = money(r[2], "Prêt", row, "Mensualité"), terms = r[3];
    if (!(account in init)) issue("Prêt", row, "Compte", "Compte du prêt non déclaré.");
    if (typeof terms !== "number" || !Number.isInteger(terms) || terms < 1 || terms > 600 || principal <= 0 || payment <= 0 || payment * Number(terms) <= principal) issue("Prêt", row, "", "Prêt amortissable à mensualité constante et taux positif requis. Durée : 1 à 600 échéances.");
    else config.loan = { account, principal, payment, terms };
    const payments = new Map<string, { capital: number; interest: number; capitalCount: number; interestCount: number }>();
    transactions.filter(t => t.type === "Crédit Immobilier" || t.type === "Intérêt du prêt").forEach(t => {
      if (t.compte !== account || t.dc !== "Débit") issue("Prêt", row, "Compte", "Les mouvements de prêt doivent être des débits du compte déclaré.");
      const p = payments.get(t.monthKey) ?? { capital: 0, interest: 0, capitalCount: 0, interestCount: 0 };
      if (t.type === "Crédit Immobilier") { p.capital += t.montant; p.capitalCount++; }
      else { p.interest += t.montant; p.interestCount++; }
      payments.set(t.monthKey, p);
    });
    if (!payments.size) issue("Prêt", row, "", "Ajoutez les mouvements Crédit Immobilier et Intérêt du prêt pour activer le suivi.");
    const schedule = config.loan ? loanSchedule(principal, payment, Number(terms)) : [];
    let previous: { month: number; index: number } | null = null;
    [...payments.entries()].sort(([a], [b]) => a.localeCompare(b)).forEach(([mk, p]) => {
      if (p.capitalCount !== 1 || p.interestCount !== 1 || p.capital <= 0 || p.interest <= 0 || Math.abs(p.capital + p.interest - payment) > 0.021) issue("Prêt", row, "Mensualité", `${mk} : une part capital et une part intérêts sont requises, leur somme doit égaler la mensualité.`);
      if (schedule.length) {
        const index = closestLoanTerm(schedule, p.interest), expected = schedule[index];
        if (Math.abs(p.interest - expected.interet) > 0.031 || Math.abs(p.capital - expected.capital) > 0.031) issue("Prêt", row, "Mensualité", `${mk} : capital ou intérêts incompatibles avec l'échéancier constant. Vérifiez les paramètres, la part d'assurance et les types de mouvements.`);
        const month = Number(mk.slice(0, 4)) * 12 + Number(mk.slice(5, 7));
        if (previous && index - previous.index !== month - previous.month) issue("Prêt", row, "", `${mk} : progression des échéances incompatible avec un prêt mensuel constant.`);
        previous = { month, index };
      }
    });
  } else if (transactions.some(t => t.type === "Crédit Immobilier" || t.type === "Intérêt du prêt")) issue("Prêt", 2, "", "Mouvements de prêt présents sans paramètres : le suivi du prêt restera masqué.", "warning");
  const total = (dc: string) => round(transactions.filter(t => t.dc === dc && Number.isFinite(t.montant)).reduce((sum, t) => sum + t.montant, 0));
  const totalDebits = total("Débit"), totalCredits = total("Crédit");
  const dataset: ImportDataset = { schemaVersion: 1, transactions, salary, config, budgets };
  if (!issues.some(i => i.severity === "error")) {
    const migrated = migrateDataset(dataset);
    configurationErrors(migrated.config, migrated.transactions).forEach(message => issue("Paramètres", 1, "", message));
  }
  return { dataset, validation: {
    ok: !issues.some(i => i.severity === "error"), issues, sheets: txSheets, hasLoan: Boolean(config.loan), hasInflation: Boolean(salary.inflation?.length && salary.smic?.length),
    nbTransactions: transactions.length, dateMin, dateMax, nbMois: new Set(transactions.map(t => t.monthKey)).size,
    comptes: config.comptes ?? [], totalDebits, totalCredits, net: round(totalCredits - totalDebits),
    nbSalaryMonths: salary.months.length, lastSalaryMonth: salary.lastMonth ?? "", lastNetSalary: salary.months[salary.months.length - 1]?.net ?? 0,
  } };
}
