import type { ImportDataset } from "./workbookImport";
import { configurationErrors } from "./configurationValidation";
import { validISODate } from "@/utils/importDate";

const record = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const nonnegative = (v: unknown) => num(v) && v >= 0;
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");

/** Refuse un paquet incomplet ou altéré avant toute restauration du store. */
export function isImportDataset(v: unknown): v is ImportDataset {
  if (!record(v) || (v.schemaVersion !== 1 && v.schemaVersion !== 2) || !record(v.config) || !record(v.config.init)
    || v.config.balanceMode !== "direct" || !strings(v.config.comptes) || !v.config.comptes.length
    || !record(v.config.coverage) || !record(v.salary) || !record(v.budgets)) return false;
  const compatibility = v.config.compatibility;
  if (compatibility !== undefined && compatibility !== "legacy-dashboard-v1") return false;
  const { dateMin, dateMax } = v.config.coverage;
  if (typeof dateMin !== "string" || typeof dateMax !== "string" || !validISODate(dateMin) || !validISODate(dateMax) || dateMin > dateMax) return false;
  const accounts = v.config.comptes;
  const init = v.config.init;
  const kinds = v.config.accountKinds;
  if (!record(kinds) || accounts.some(a => !["Courant", "Épargne"].includes(String(kinds[a])))) return false;
  if (new Set(accounts).size !== accounts.length || Object.keys(init).length !== accounts.length
    || accounts.some(a => ["Total", "__proto__", "constructor", "prototype"].includes(a) || !num(init[a]))) return false;
  if (!Array.isArray(v.transactions) || !v.transactions.length || !v.transactions.every(t => record(t)
    && typeof t.date === "string" && validISODate(t.date) && t.date >= dateMin && t.date <= dateMax
    && t.monthKey === t.date.slice(0, 7) && num(t.montant)
    && (t.montant >= 0 || compatibility === "legacy-dashboard-v1") && t.bankAmount === undefined
    && (t.kpiRole === undefined || (compatibility === "legacy-dashboard-v1"
      && ["ordinary", "transfer", "loan-capital", "loan-interest"].includes(String(t.kpiRole))))
    && (t.transferId === undefined || (typeof t.transferId === "string" && t.transferId.length > 0))
    && typeof t.compte === "string" && (v.schemaVersion === 2 || accounts.includes(t.compte)) && ["Débit", "Crédit"].includes(String(t.dc))
    && ["label", "type", "cat1", "cat2", "cat3", "cat4", "ville"].every(k => typeof t[k] === "string"))) return false;
  if (!Array.isArray(v.salary.months) || !v.salary.months.every(s => record(s) && typeof s.mk === "string"
    && validISODate(`${s.mk}-01`)
    && typeof s.entreprise === "string" && ["brut", "net", "cotSal", "indem", "retenues"].every(k => nonnegative(s[k])))) return false;
  const tuples = (a: unknown) => Array.isArray(a) && a.every(t => Array.isArray(t) && t.length === 2 && typeof t[0] === "string" && num(t[1]));
  if (!tuples(v.salary.cotLast) || !tuples(v.salary.patronLast)) return false;
  if (!Array.isArray(v.budgets.budgets) || !v.budgets.budgets.every(b => record(b) && typeof b.cat2 === "string"
    && (b.target === null || nonnegative(b.target)) && typeof b.active === "boolean"
    && (b.updated_at === null || typeof b.updated_at === "string"))) return false;
  if (v.budgets.personalBudgets !== undefined && (!Array.isArray(v.budgets.personalBudgets) || !v.budgets.personalBudgets.every(b => record(b) && typeof b.cat2 === "string" && (b.target === null || nonnegative(b.target)) && typeof b.active === "boolean" && (b.updated_at === null || typeof b.updated_at === "string")))) return false;
  const loan = v.config.loan;
  if (loan !== undefined && (!record(loan) || !nonnegative(loan.principal) || !nonnegative(loan.payment)
    || !num(loan.terms) || !Number.isInteger(loan.terms) || loan.terms < 1 || loan.terms > 600
    || typeof loan.account !== "string" || (v.schemaVersion === 1 && !accounts.includes(loan.account)))) return false;
  if (v.schemaVersion === 2) {
    if (v.config.version !== 2 || configurationErrors(v.config as unknown as ImportDataset["config"], v.transactions as ImportDataset["transactions"]).length) return false;
    const cfg = v.config as unknown as ImportDataset["config"];
    if (cfg.accounts?.some(a => cfg.init[a.label] !== a.initialBalance || cfg.accountKinds?.[a.label] !== a.kind || !accounts.includes(a.label))) return false;
  }
  return true;
}
