import * as XLSX from "xlsx";
import type { Config, SalaryData, Transaction, TransactionRole } from "@/types";
import { configurationErrors } from "./configurationValidation";
import type { ImportDataset, ImportIssue, ValidationReport } from "./workbookImport";

const LEGACY_TX_SHEET = /^Transactions \d{4}$/;
const LEGACY_TX_HEADERS = ["Transaction", "Compte", "Type Dépense", "Date"];
const PRIMARY_SAVINGS_TYPE = "Epargne CA";
const SAVINGS_EXIT_ACCOUNT = "Sortie Epargne";
const CREDIT_TYPES = new Set(["Salaire", "Ticket Restaurant", "Dépense Budget", "Virement extérieur"]);
const FIXED_TYPES = new Set([
  "Impôt sur Revenu", "Autres (Amendes, …)", "Assurance prêt", "Assurance habitation",
  "Assurance auto", "Frais de Copropriété", "Electricité", "Internet et Forfait téléphone",
  "Frais Bancaires", "Intérêt du prêt", "Abonnement Navigo",
]);
const CURRENT_TYPES = new Set(["courses", "cantine", "Essence", "Médecin", "Pharmacie", "Vêtement courant"]);
const CAT1_EXCLUDE = new Set(["", "Salaire", "Epargne CA", "Virement extérieur"]);

type LegacyTransaction = Omit<Transaction, "accountId" | "typeId">;

const clean = (value: unknown) => value == null ? "" : String(value).trim().replace(/\u00a0/g, "");
const round = (value: number) => Math.round(value * 100) / 100;
const isSharedAccount = (account: string) => /(?:^| - )Part commune$/i.test(account);
const isHalfAccount = (account: string) => isSharedAccount(account) || /(?:^| - )Compte joint$/i.test(account);
const isSavingsType = (type: string) => /^Epargne\s+/i.test(type);
const isTransferType = (type: string) => /^Transfert\s+.+\s+vers\s+.+$/i.test(type) || isSavingsType(type);
const isTransferCreditType = (type: string) => /^Transfert\s+.+\s+vers\s+.+$/i.test(type);

function excelDate(value: unknown, date1904: boolean): string {
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value, { date1904 });
    if (!parsed) return "";
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  return clean(value).slice(0, 10);
}

function fallbackCategory(type: string, label: string): string {
  if (!label || CAT1_EXCLUDE.has(type)) return "";
  if (CURRENT_TYPES.has(type)) return "Dépense Courante";
  if (FIXED_TYPES.has(type)) return "Dépense Fixe";
  return "Dépense Occasionnelle";
}

function transactionSheetNames(workbook: XLSX.WorkBook): string[] {
  return workbook.SheetNames.filter(name => LEGACY_TX_SHEET.test(name));
}

/** Reconnaît uniquement l'ancien classeur Budget, sans élargir le modèle public. */
export function isLegacyWorkbook(workbook: XLSX.WorkBook): boolean {
  if (!workbook.Sheets["Fiche de Paie"]) return false;
  return transactionSheetNames(workbook).some(name => {
    const sheet = workbook.Sheets[name];
    return LEGACY_TX_HEADERS.every((header, index) => clean(sheet[XLSX.utils.encode_cell({ r: 17, c: index })]?.v) === header);
  });
}

function parseLegacyTransactions(workbook: XLSX.WorkBook, issues: ImportIssue[]): { transactions: LegacyTransaction[]; sheets: string[] } {
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const transactions: LegacyTransaction[] = [];
  const sheets = transactionSheetNames(workbook);

  for (const name of sheets) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1, range: 17, raw: true, defval: null, blankrows: true,
    });
    if (!LEGACY_TX_HEADERS.every((header, index) => clean(rows[0]?.[index]) === header)) continue;

    rows.slice(1).forEach((row, index) => {
      const excelRow = index + 19;
      const label = clean(row[0]);
      if (!label) return;
      if (clean(row[10]).toLowerCase() === "x") return;
      const compte = clean(row[1]);
      const type = clean(row[2]);
      const date = excelDate(row[3], date1904);
      if (!compte || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        issues.push({ severity: "error", sheet: name, row: excelRow, column: !compte ? "B" : "D", message: "Compte ou date illisible dans l'ancien format." });
        return;
      }

      // L'ancien dashboard additionnait la valeur calculée de la colonne F
      // telle quelle. Certains remboursements y sont négatifs : les passer en
      // valeur absolue changeait deux fois leur effet dans les dépenses.
      let montant: number | null = typeof row[5] === "number" && Number.isFinite(row[5]) ? round(row[5]) : null;
      if (montant == null && typeof row[4] === "number" && Number.isFinite(row[4])) {
        montant = round(row[4] / (isHalfAccount(compte) ? 2 : 1));
      }
      if (montant == null) {
        issues.push({ severity: "error", sheet: name, row: excelRow, column: "F", message: "Montant réel illisible dans l'ancien format." });
        return;
      }

      const cachedDc = clean(row[18]);
      const dc = cachedDc === "Débit" || cachedDc === "Crédit" ? cachedDc : CREDIT_TYPES.has(type) || isTransferCreditType(type) ? "Crédit" : "Débit";
      const cachedCat1 = clean(row[6]);
      const normalizeOptional = (value: unknown) => clean(value) === "x" ? "" : clean(value);
      transactions.push({
        label, compte, type, date, montant,
        cat1: cachedCat1 && cachedCat1 !== "x" ? cachedCat1 : fallbackCategory(type, label),
        cat2: normalizeOptional(row[7]), cat3: normalizeOptional(row[8]), cat4: normalizeOptional(row[9]),
        ville: normalizeOptional(row[13]), dc, monthKey: date.slice(0, 7),
      });
    });
  }
  return { transactions, sheets };
}

function parseLegacySalary(workbook: XLSX.WorkBook): SalaryData {
  const sheet = workbook.Sheets["Fiche de Paie"];
  const salary: SalaryData = { months: [], cotLast: [], patronLast: [] };
  if (!sheet) return salary;
  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: 11, raw: true, defval: null, blankrows: true });
  const months = new Map<string, {
    mk: string; entreprise: string; brut: number; cotSal: number; indem: number; retenues: number;
    cotDetails: [string, number][]; patronDetails: [string, number][];
  }>();

  rows.slice(1).forEach(row => {
    const entreprise = clean(row[1]);
    const date = excelDate(row[6], date1904);
    if (!entreprise || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const mk = date.slice(0, 7);
    const current = months.get(mk) ?? { mk, entreprise, brut: 0, cotSal: 0, indem: 0, retenues: 0, cotDetails: [], patronDetails: [] };
    current.entreprise = entreprise;
    const detail = clean(row[2]), qui = clean(row[3]), category = clean(row[4]).toUpperCase(), designation = clean(row[5]);
    const amount = typeof row[7] === "number" && Number.isFinite(row[7]) ? round(row[7]) : 0;
    if (category.startsWith("SALAIRE") && detail === "Salaire") current.brut += amount;
    else if (category.startsWith("*COTISAT.SALARIALES") && detail === "Somme" && qui === "Salarié") current.cotSal += Math.abs(amount);
    else if (category.startsWith("*COTISAT.SALARIALES") && detail === "Détail" && qui === "Salarié") current.cotDetails.push([designation, Math.abs(amount)]);
    else if (category.startsWith("*INDEM") && detail === "Somme" && qui === "Salarié") current.indem += amount;
    else if (category.startsWith("*AUTRES RETENUES") && detail === "Somme" && qui === "Salarié") current.retenues += Math.abs(amount);
    else if (category.startsWith("*COTISAT.PATRONALES") && detail === "Détail" && qui === "Employeur") current.patronDetails.push([designation, Math.abs(amount)]);
    months.set(mk, current);
  });

  salary.months = [...months.values()].sort((a, b) => a.mk.localeCompare(b.mk)).map(month => {
    const brut = round(month.brut), cotSal = round(month.cotSal), indem = round(month.indem), retenues = round(month.retenues);
    return { mk: month.mk, entreprise: month.entreprise, brut, cotSal, indem, retenues, net: round(brut - cotSal + indem - retenues) };
  });
  const last = salary.months[salary.months.length - 1]?.mk ?? "";
  salary.lastMonth = last;
  salary.cotLast = months.get(last)?.cotDetails ?? [];
  salary.patronLast = months.get(last)?.patronDetails ?? [];
  return salary;
}

function inferMainAccount(source: LegacyTransaction[], preferredAccounts: string[]): string {
  const scores = new Map<string, number>();
  const frequencies = new Map<string, number>();
  for (const transaction of source) {
    if (isSharedAccount(transaction.compte) || transaction.compte === SAVINGS_EXIT_ACCOUNT) continue;
    frequencies.set(transaction.compte, (frequencies.get(transaction.compte) ?? 0) + 1);
    if (transaction.type === PRIMARY_SAVINGS_TYPE) scores.set(transaction.compte, (scores.get(transaction.compte) ?? 0) + 10);
    else if (isSavingsType(transaction.type)) scores.set(transaction.compte, (scores.get(transaction.compte) ?? 0) + 3);
  }
  const scored = [...scores.keys()].sort((a, b) =>
    (scores.get(b) ?? 0) - (scores.get(a) ?? 0) || (frequencies.get(b) ?? 0) - (frequencies.get(a) ?? 0),
  );
  if (scored[0]) return scored[0];
  const preferred = preferredAccounts.find(account => !isSharedAccount(account) && account !== SAVINGS_EXIT_ACCOUNT);
  if (preferred) return preferred;
  return [...frequencies.keys()].sort((a, b) => (frequencies.get(b) ?? 0) - (frequencies.get(a) ?? 0))[0] ?? "Compte principal";
}

function normalizeLegacyTransactions(source: LegacyTransaction[], mainAccount: string): { transactions: LegacyTransaction[]; savingsAccounts: Set<string> } {
  const normalized: LegacyTransaction[] = [];
  const savingsAccounts = new Set<string>();
  const savingsByType = new Map<string, string>();
  let transferIndex = 0;
  const pair = (
    first: LegacyTransaction,
    secondAccount: string,
    secondDc: "Débit" | "Crédit",
    firstKpiRole: TransactionRole = "transfer",
    secondKpiRole: TransactionRole = "transfer",
  ) => {
    const transferId = `legacy-transfer-${++transferIndex}`;
    normalized.push({ ...first, kpiRole: firstKpiRole, transferId });
    normalized.push({ ...first, label: `Contrepartie — ${first.label}`, compte: secondAccount, dc: secondDc, cat1: "", cat2: "", cat3: "", cat4: "", ville: "", kpiRole: secondKpiRole, transferId });
  };
  const savingsAccountFor = (type: string) => {
    const existing = savingsByType.get(type);
    if (existing) return existing;
    const account = `Épargne historique ${savingsByType.size + 1}`;
    savingsByType.set(type, account);
    savingsAccounts.add(account);
    return account;
  };

  for (const transaction of source) {
    if (isTransferCreditType(transaction.type)) {
      pair({ ...transaction, dc: "Crédit" }, mainAccount, "Débit");
    } else if (isSavingsType(transaction.type) && transaction.compte === SAVINGS_EXIT_ACCOUNT) {
      pair({ ...transaction, compte: mainAccount, dc: "Crédit" }, savingsAccountFor(transaction.type), "Débit");
    } else if (isSavingsType(transaction.type)) {
      // Historiquement, seul le type d'épargne principal était retiré des
      // dépenses. Les autres versements restaient des dépenses, tandis que
      // leur contrepartie ne devait pas devenir une recette.
      pair(
        { ...transaction, compte: mainAccount, dc: "Débit" },
        savingsAccountFor(transaction.type),
        "Crédit",
        transaction.type === PRIMARY_SAVINGS_TYPE ? "transfer" : "ordinary",
        "transfer",
      );
    } else {
      normalized.push({ ...transaction, compte: isSharedAccount(transaction.compte) ? mainAccount : transaction.compte });
    }
  }
  return { transactions: normalized, savingsAccounts };
}

function workbookEndingBalances(workbook: XLSX.WorkBook): { balances: Record<string, number>; accounts: string[]; mainBalance?: number; row: number } {
  const sheet = workbook.Sheets.Visualisation;
  if (!sheet) return { balances: {}, accounts: [], row: 1 };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null, blankrows: true });
  const headerIndex = rows.findIndex(row => clean(row[0]) === "Comptes");
  const balanceIndex = rows.findIndex(row => clean(row[0]) === "Restant M");
  if (headerIndex < 0 || balanceIndex < 0) return { balances: {}, accounts: [], row: 1 };
  const balances: Record<string, number> = {};
  const accounts: string[] = [];
  rows[headerIndex].forEach((value, column) => {
    const account = clean(value);
    const balance = rows[balanceIndex]?.[column];
    if (column === 0 || !account || isSharedAccount(account) || account === SAVINGS_EXIT_ACCOUNT) return;
    accounts.push(account);
    balances[account] = typeof balance === "number" && Number.isFinite(balance) ? round(balance) : 0;
  });
  let mainBalance: number | undefined;
  for (const row of rows) {
    for (let column = 0; column < row.length - 1; column++) {
      if (!/^Solde du compte\b/i.test(clean(row[column]))) continue;
      const value = row[column + 1];
      if (typeof value === "number" && Number.isFinite(value)) mainBalance = round(value);
    }
  }
  return { balances, accounts, mainBalance, row: balanceIndex + 1 };
}

function roleForType(type: string): TransactionRole {
  if (isTransferType(type)) return "transfer";
  if (type === "Crédit Immobilier") return "loan-capital";
  if (type === "Intérêt du prêt") return "loan-interest";
  return "ordinary";
}

export function parseLegacyWorkbook(workbook: XLSX.WorkBook): { dataset: ImportDataset; validation: ValidationReport } {
  const issues: ImportIssue[] = [];
  const parsed = parseLegacyTransactions(workbook, issues);
  const sourceTransactions = parsed.transactions;
  if (!sourceTransactions.length) issues.push({ severity: "error", sheet: parsed.sheets[0] ?? "Transactions", row: 19, column: "A", message: "Aucune transaction exploitable dans l'ancien format." });
  const ending = workbookEndingBalances(workbook);
  const mainAccount = inferMainAccount(sourceTransactions, ending.accounts);
  if (ending.mainBalance !== undefined) ending.balances[mainAccount] = ending.mainBalance;
  const normalizedResult = normalizeLegacyTransactions(sourceTransactions, mainAccount);
  const normalized = normalizedResult.transactions;
  const salary = parseLegacySalary(workbook);
  const dates = sourceTransactions.map(transaction => transaction.date).sort();
  const dateMin = dates[0] ?? "", dateMax = dates[dates.length - 1] ?? "";

  const detectedAccounts = [...new Set(normalized.map(transaction => transaction.compte))];
  const visibleAccountLabels = ending.accounts.length
    ? [mainAccount, ...ending.accounts.filter(account => account !== mainAccount)]
    : [mainAccount, ...detectedAccounts.filter(account => account !== mainAccount && !normalizedResult.savingsAccounts.has(account)).sort()];
  const accountLabels = [...visibleAccountLabels, ...detectedAccounts.filter(account => !visibleAccountLabels.includes(account)).sort()];
  const visibleAccounts = new Set(visibleAccountLabels);
  const movement = Object.fromEntries(accountLabels.map(account => [account, 0])) as Record<string, number>;
  normalized.forEach(transaction => { movement[transaction.compte] = round((movement[transaction.compte] ?? 0) + (transaction.dc === "Crédit" ? transaction.montant : -transaction.montant)); });
  const init = Object.fromEntries(accountLabels.map(account => [account, account in ending.balances ? round(ending.balances[account] - movement[account]) : 0]));
  const accountKinds = Object.fromEntries(accountLabels.map(account => [account, normalizedResult.savingsAccounts.has(account) ? "Épargne" : "Courant"])) as Record<string, "Courant" | "Épargne">;
  const accounts = accountLabels.map((label, index) => ({
    id: `legacy-account-${String(index + 1).padStart(3, "0")}`,
    label,
    initialBalance: init[label],
    kind: accountKinds[label],
    share: 100,
    includeInBalance: visibleAccounts.has(label),
  }));
  const typeLabels = [...new Set(normalized.map(transaction => transaction.type))];
  const types = typeLabels.map((label, index) => ({ id: `legacy-type-${String(index + 1).padStart(3, "0")}`, label, role: roleForType(label) }));
  const accountByLabel = new Map(accounts.map(account => [account.label, account]));
  const typeByLabel = new Map(types.map(type => [type.label, type]));
  const transactions: Transaction[] = normalized.map(transaction => {
    const account = accountByLabel.get(transaction.compte)!;
    const type = typeByLabel.get(transaction.type)!;
    return { ...transaction, accountId: account.id, typeId: type.id, role: type.role };
  });
  const config: Config = {
    version: 2, accounts, types, perspective: "bank", compatibility: "legacy-dashboard-v1", init, accountKinds,
    balanceMode: "direct", comptes: accountLabels, transfers: typeLabels.filter(isTransferType),
    coverage: { dateMin, dateMax },
  };
  const dataset: ImportDataset = { schemaVersion: 2, transactions, salary, config, budgets: { budgets: [] } };

  issues.push({
    severity: "warning", sheet: "Visualisation", row: ending.row, column: "",
    message: "Ancien format reconnu : les valeurs calculées ont été lues et les comptes techniques ont été adaptés automatiquement.",
  });
  if (!Object.keys(ending.balances).length) issues.push({
    severity: "warning", sheet: "Visualisation", row: 1, column: "",
    message: "Aucun solde final exploitable : les comptes commencent à zéro et peuvent être ajustés dans Paramètres.",
  });
  configurationErrors(config, transactions).forEach(message => issues.push({ severity: "error", sheet: "Paramètres", row: 1, column: "", message }));

  const total = (dc: string) => round(sourceTransactions.filter(transaction => transaction.dc === dc).reduce((sum, transaction) => sum + transaction.montant, 0));
  const totalDebits = total("Débit"), totalCredits = total("Crédit");
  return {
    dataset,
    validation: {
      ok: !issues.some(issue => issue.severity === "error"), issues,
      sheets: ["Fiche de Paie", ...parsed.sheets], hasLoan: false, hasInflation: false,
      nbTransactions: sourceTransactions.length, dateMin, dateMax,
      nbMois: new Set(sourceTransactions.map(transaction => transaction.monthKey)).size,
      comptes: visibleAccountLabels, totalDebits, totalCredits, net: round(totalCredits - totalDebits),
      nbSalaryMonths: salary.months.length, lastSalaryMonth: salary.lastMonth ?? "",
      lastNetSalary: salary.months[salary.months.length - 1]?.net ?? 0,
    },
  };
}
