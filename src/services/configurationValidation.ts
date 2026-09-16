import type { Config, Transaction } from "@/types";
import { cents } from "@/utils/businessRules";
import { closestLoanTerm, loanSchedule } from "@/utils/loanRate";

const roles = ["ordinary", "transfer", "loan-capital", "loan-interest"];
const finiteMoney = (n: number) => Number.isFinite(n) && Math.abs(n) <= 1e12 && Math.abs(n - cents(n)) < 1e-6;
const validId = (s: string) => typeof s === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(s) && !["Total", "__proto__", "prototype", "constructor"].includes(s);
export const validCatalogLabel = (s: string) => typeof s === "string" && s === s.trim() && s.length > 0 && s.length <= 100
  && !["Total", "__proto__", "prototype", "constructor", "monthKey", "label", "name", "mk"].includes(s) && !s.startsWith("prev_");

/** Même contrôle pour l'écran de paramètres et la restauration locale. */
export function configurationErrors(config: Config, transactions: Transaction[]): string[] {
  const errors: string[] = [];
  const accounts = config.accounts, types = config.types;
  if (!Array.isArray(accounts) || !accounts.length || !Array.isArray(types) || !types.length) return ["Catalogues de comptes et de types manquants."];
  if (accounts.some(a => !a || !validId(a.id) || !validCatalogLabel(a.label) || !["Courant", "Épargne"].includes(a.kind)
    || !finiteMoney(a.initialBalance) || !Number.isFinite(a.share) || a.share < 0 || a.share > 100 || Math.abs(a.share - cents(a.share)) > 1e-6
    || (a.includeInBalance !== undefined && typeof a.includeInBalance !== "boolean"))) errors.push("Chaque compte doit avoir un nom valide, un solde en centimes et une quote-part entre 0 et 100 % (deux décimales maximum).");
  if (types.some(t => !t || !validId(t.id) || !validCatalogLabel(t.label) || !roles.includes(t.role))) errors.push("Chaque type doit avoir un nom et un rôle valides.");
  if (new Set(accounts.map(a => a.id)).size !== accounts.length || new Set(accounts.map(a => a.label)).size !== accounts.length
    || new Set(types.map(t => t.id)).size !== types.length || new Set(types.map(t => t.label)).size !== types.length) errors.push("Les identifiants et les noms doivent être uniques dans chaque catalogue.");
  if (!["bank", "personal"].includes(config.perspective ?? "bank")) errors.push("Perspective de calcul inconnue.");
  if (config.compatibility !== undefined && config.compatibility !== "legacy-dashboard-v1") errors.push("Mode de compatibilité inconnu.");
  if (errors.length) return errors;
  const accountIds = new Set(accounts.map(a => a.id));
  const roleById = new Map(types.map(t => [t.id, t.role]));
  if (transactions.some(t => !accountIds.has(t.accountId ?? "") || !roleById.has(t.typeId ?? "") || !finiteMoney(t.montant)
    || (t.montant < 0 && config.compatibility !== "legacy-dashboard-v1")
    || (t.kpiRole !== undefined && (config.compatibility !== "legacy-dashboard-v1" || !roles.includes(t.kpiRole)))
    || t.bankAmount !== undefined)) errors.push("Une transaction référence un compte/type absent, ou son montant bancaire est invalide.");
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) {
    if (roleById.get(t.typeId ?? "") !== "transfer") continue;
    if (!t.transferId) { errors.push("Chaque transfert interne doit relier deux mouvements. Pour créer ces liens, renseignez la colonne Transfert du classeur ; une paire unique de même date et montant peut aussi être reconnue automatiquement."); break; }
    const group = groups.get(t.transferId) ?? []; group.push(t); groups.set(t.transferId, group);
  }
  for (const group of groups.values()) {
    const [a, b] = group;
    if (group.length !== 2 || a.accountId === b?.accountId || a.dc === b?.dc || a.date !== b?.date || a.montant !== b?.montant) { errors.push("Un transfert doit contenir exactement deux mouvements opposés, de même date et montant, sur deux comptes différents."); break; }
  }
  const loan = config.loan;
  if (loan) {
    if (!accountIds.has(loan.account ?? "") || !finiteMoney(loan.principal) || loan.principal <= 0 || !finiteMoney(loan.payment) || loan.payment <= 0
      || !Number.isInteger(loan.terms) || loan.terms < 1 || loan.terms > 600 || loan.payment * loan.terms <= loan.principal) errors.push("Le prêt doit désigner un compte et des paramètres positifs permettant un échéancier avec intérêts (1 à 600 échéances).");
    else {
      const months = new Map<string, { capital: number; interest: number; nc: number; ni: number }>();
      for (const t of transactions) {
        const role = roleById.get(t.typeId ?? "");
        if (role !== "loan-capital" && role !== "loan-interest") continue;
        if (t.accountId !== loan.account || t.dc !== "Débit") { errors.push("Les opérations de prêt doivent être des débits du compte choisi."); break; }
        const p = months.get(t.monthKey) ?? { capital: 0, interest: 0, nc: 0, ni: 0 };
        if (role === "loan-capital") { p.capital += t.montant; p.nc++; } else { p.interest += t.montant; p.ni++; }
        months.set(t.monthKey, p);
      }
      const schedule = loanSchedule(loan.principal, loan.payment, loan.terms);
      let previous: { month: string; index: number } | null = null;
      for (const [month, p] of [...months].sort(([a], [b]) => a.localeCompare(b))) {
        const index = closestLoanTerm(schedule, p.interest);
        const expected = schedule[index];
        const monthNumber = (mk: string) => Number(mk.slice(0, 4)) * 12 + Number(mk.slice(5, 7));
        if (p.nc !== 1 || p.ni !== 1 || Math.abs(p.capital + p.interest - loan.payment) > .021 || !expected
          || Math.abs(p.capital - expected.capital) > .031 || Math.abs(p.interest - expected.interet) > .031
          || (previous && index - previous.index !== monthNumber(month) - monthNumber(previous.month))) {
          errors.push(`Les rôles et paramètres de prêt ne correspondent pas à l'échéance ${month}.`); break;
        }
        previous = { month, index };
      }
      if (!months.size) errors.push("Un prêt activé nécessite des opérations de capital et d'intérêts. Désactivez le suivi si ces données ne sont pas disponibles.");
    }
  }
  return [...new Set(errors)];
}
