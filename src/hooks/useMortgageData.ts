/**
 * useMortgageData — Hook de la page Prêt Immobilier (Session 3A, Phase 3).
 *
 * Reconstruit le suivi complet du prêt à partir des transactions :
 *   - type "Crédit Immobilier" → part capital de la mensualité ;
 *   - type "Intérêt du prêt"   → part intérêts de la mensualité.
 * Les données réelles débutent en nov. 2024 ; les mois antérieurs sont
 * reconstitués via le tableau d'amortissement théorique.
 *
 * Les intérêts observés identifient l'échéance la plus proche dans le tableau
 * théorique. Le solde affiché provient de cet échéancier : cela évite
 * d'amplifier l'arrondi au centime des intérêts par une division par le taux.
 *
 * Consomme : useDataStore (transactions et config.loan). Le prêt est facultatif.
 *
 * @returns status, hasData, kpis (capital restant/remboursé, échéances, intérêts),
 *   historyData (capital/intérêts mensuels réels), projectionData (capital restant
 *   dû jusqu'à la fin), donutData (remboursé vs restant), dateFin, currentMonth,
 *   et simulate(extra) — simulateur what-if de remboursement anticipé mensuel.
 */

import { useMemo, useCallback } from "react";
import { useDashboardTransactions } from "./useDashboardTransactions";
import { transactionRole } from "@/utils/businessRules";
import { useDataStore } from "@/stores/useDataStore";
import { solveMonthlyRate, loanSchedule, closestLoanTerm } from "@/utils/loanRate";
import { mkLabel } from "@/utils/formatters";

// ─── Paramètres du prêt ────────────────────────────────────────────────
// Références fictives pour les tests de la démo. Le hook lit config.loan.
export const LOAN_PRINCIPAL = 180000;    // Montant initial fictif
export const LOAN_PAYMENT = 932.19;      // Mensualité fictive (capital + intérêts)
export const LOAN_TERMS = 240;           // Nombre total d'échéances (20 ans)


export interface MortgageKPIs {
  principal: number;        // Montant initial
  capitalRestant: number;   // Capital restant dû
  capitalRembourse: number; // Capital déjà remboursé
  avancement: number;       // Ratio 0..1 (capital remboursé / principal)
  echeancesPayees: number;
  echeancesRestantes: number;
  mensualite: number;
  tauxAnnuel: number;       // Taux nominal annuel (ratio, ex: 0.013)
  interetsPayes: number;    // Intérêts cumulés payés (théoriques)
  interetsRestants: number; // Intérêts restant à payer
  coutTotalInterets: number;// Coût total des intérêts sur la durée
}

export interface MortgageHistoryPoint {
  monthKey: string;
  label: string;
  capital: number;
  interets: number;
  total: number;
}

export interface MortgageProjectionPoint {
  monthKey: string;
  label: string;
  echeance: number;
  capitalRestant: number;
  isProjection: boolean;
}

export interface DonutSlice {
  name: string;
  value: number;
}

export interface SimulationResult {
  extra: number;            // Remboursement anticipé mensuel simulé
  dateFin: string;          // monthKey de fin
  moisGagnes: number;       // Mois économisés vs scénario actuel
  economieInterets: number; // Intérêts économisés (€)
  echeancesRestantes: number;
}

/** Ajoute n mois à un monthKey "YYYY-MM". */
function addMonths(mk: string, n: number): string {
  const y = parseInt(mk.slice(0, 4), 10);
  const m = parseInt(mk.slice(5, 7), 10);
  const total = (y * 12 + (m - 1)) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function useMortgageData() {
  const { status, config } = useDataStore();
  const transactions = useDashboardTransactions("bank");
  const principal = config?.loan?.principal ?? 0;
  const payment = config?.loan?.payment ?? 0;
  const terms = config?.loan?.terms ?? 0;

  // ─── Taux périodique dérivé des paramètres du prêt ────────────────
  const rate = useMemo(
    () => solveMonthlyRate(principal, payment, terms),
    [principal, payment, terms]
  );

  // ─── Échéancier théorique complet (240 lignes) ────────────────────
  // amort[k] = { interet, capital, solde } pour l'échéance k (1-indexé via k-1)
  const schedule = useMemo(() => loanSchedule(principal, payment, terms), [principal, payment, terms]);

  // ─── Historique mensuel réel (capital + intérêts) ─────────────────
  const historyData = useMemo<MortgageHistoryPoint[]>(() => {
    const map = new Map<string, { capital: number; interets: number }>();
    for (const t of transactions) {
      if (!["loan-capital", "loan-interest"].includes(transactionRole(t))) continue;
      if (config?.loan?.account && (t.accountId ?? t.compte) !== config.loan.account) continue;
      const cur = map.get(t.monthKey) ?? { capital: 0, interets: 0 };
      if (transactionRole(t) === "loan-capital") cur.capital += t.montant;
      else cur.interets += t.montant;
      map.set(t.monthKey, cur);
    }
    return Array.from(map.entries())
      .map(([monthKey, v]) => ({
        monthKey,
        label: mkLabel(monthKey),
        capital: Math.round(v.capital * 100) / 100,
        interets: Math.round(v.interets * 100) / 100,
        total: Math.round((v.capital + v.interets) * 100) / 100,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [transactions, config?.loan?.account]);

  const hasData = Boolean(config?.loan) && historyData.some(p => p.capital > 0 && p.interets > 0) && rate > 0;

  // ─── Nombre d'échéances restantes pour un solde donné ─────────────
  const remainingTerms = useCallback(
    (balance: number, periodicPayment = payment) => {
      if (balance <= 0 || rate <= 0) return 0;
      const x = 1 - (balance * rate) / periodicPayment;
      if (x <= 0) return terms; // mensualité ne couvre pas les intérêts
      return Math.round((-Math.log(x) / Math.log(1 + rate)) * 1e6) / 1e6;
    },
    [rate, payment, terms]
  );

  // ─── Reconstitution de l'état courant à partir du dernier mois réel ─
  const current = useMemo(() => {
    // Dernier mois disposant d'intérêts ET de capital
    const last = [...historyData]
      .reverse()
      .find((p) => p.interets > 0 && p.capital > 0);
    if (!last) {
      return { monthKey: "", echeance: 0, capitalRestant: principal };
    }
    if (!schedule.length) return { monthKey: "", echeance: 0, capitalRestant: principal };
    const index = closestLoanTerm(schedule, last.interets);
    const capitalRestant = schedule[index].solde;
    const echeance = index + 1;
    return { monthKey: last.monthKey, echeance, capitalRestant };
  }, [historyData, principal, schedule]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo<MortgageKPIs>(() => {
    const capitalRestant = current.capitalRestant;
    const capitalRembourse = principal - capitalRestant;
    const echeancesPayees = Math.max(0, current.echeance);
    const echeancesRestantes = terms - echeancesPayees;
    const coutTotalInterets = payment * terms - principal;
    // Intérêts payés = somme des intérêts théoriques des échéances passées
    const interetsPayes = schedule
      .slice(0, echeancesPayees)
      .reduce((s, r) => s + r.interet, 0);
    return {
      principal: principal,
      capitalRestant,
      capitalRembourse,
      avancement: principal > 0 ? capitalRembourse / principal : 0,
      echeancesPayees,
      echeancesRestantes,
      mensualite: payment,
      tauxAnnuel: rate * 12,
      interetsPayes,
      interetsRestants: coutTotalInterets - interetsPayes,
      coutTotalInterets,
    };
  }, [current, schedule, rate, principal, payment, terms]);

  // ─── Projection du capital restant dû (historique + futur) ────────
  const projectionData = useMemo<MortgageProjectionPoint[]>(() => {
    if (!hasData || !current.monthKey) return [];
    // Échéance #1 = dernier mois réel − (echeance − 1) mois
    const firstMonth = addMonths(current.monthKey, -(current.echeance - 1));
    return schedule.map((r, idx) => {
      const monthKey = addMonths(firstMonth, idx);
      return {
        monthKey,
        label: mkLabel(monthKey),
        echeance: idx + 1,
        capitalRestant: Math.round(r.solde),
        isProjection: monthKey > current.monthKey,
      };
    });
  }, [hasData, current, schedule]);

  // ─── Donut remboursé / restant ────────────────────────────────────
  const donutData = useMemo<DonutSlice[]>(
    () => [
      { name: "Capital remboursé", value: Math.round(kpis.capitalRembourse) },
      { name: "Capital restant", value: Math.round(kpis.capitalRestant) },
    ],
    [kpis]
  );

  // ─── Date de fin au rythme actuel ─────────────────────────────────
  const dateFin = useMemo(() => {
    if (!current.monthKey) return "";
    return addMonths(current.monthKey, kpis.echeancesRestantes);
  }, [current.monthKey, kpis.echeancesRestantes]);

  // ─── Simulateur what-if (remboursement anticipé mensuel) ──────────
  const simulate = useCallback(
    (extra: number): SimulationResult => {
      const B = current.capitalRestant;
      const baseRem = remainingTerms(B);
      if (!hasData || B <= 0) {
        return { extra, dateFin, moisGagnes: 0, economieInterets: 0, echeancesRestantes: 0 };
      }
      if (extra <= 0) {
        return {
          extra: 0,
          dateFin,
          moisGagnes: 0,
          economieInterets: 0,
          echeancesRestantes: Math.ceil(baseRem),
        };
      }
      const newPayment = payment + extra;
      const newRem = remainingTerms(B, newPayment);
      const interetsBase = payment * baseRem - B;
      const interetsNew = newPayment * newRem - B;
      return {
        extra,
        dateFin: addMonths(current.monthKey, Math.ceil(newRem)),
        moisGagnes: Math.round(Math.ceil(baseRem) - Math.ceil(newRem)),
        economieInterets: Math.max(0, interetsBase - interetsNew),
        echeancesRestantes: Math.ceil(newRem),
      };
    },
    [current, remainingTerms, hasData, dateFin, payment]
  );

  return {
    status,
    hasData,
    kpis,
    historyData,
    projectionData,
    donutData,
    dateFin,
    currentMonth: current.monthKey,
    simulate,
  };
}
