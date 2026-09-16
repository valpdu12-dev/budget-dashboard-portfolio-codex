// ── Hook de calcul des soldes (optimisé V2 : groupBy Map au lieu de filter) ──
//
// Logique Banque Horizon - Courant multi-comptes (V1 fidèle) :
//   Banque Horizon - Courant      Crédit → + sur Banque Horizon - Courant
//   Banque Horizon - Courant      Débit  → - sur Banque Horizon - Courant
//   Retrait épargne                 (tout dc) → + sur Banque Horizon - Courant
//   Cagnotte commune        Débit  → - sur Banque Horizon - Courant
//   Banque Horizon - Dépenses partagées Débit  → - sur Banque Horizon - Courant
//   Banque Nova - Compte joint       Crédit (sauf Virement extérieur) → - sur Banque Horizon - Courant
//   Banque Équilibre - Compte joint Crédit (sauf Virement extérieur) → - sur Banque Horizon - Courant
//
// Comptes à solde propre (Banque Nova - Compte joint, Banque Équilibre - Compte
// joint, Carte repas - Titres restaurant, Banque Nova - Épargne) : Crédit → +, Débit → -
//
// ⚠️ Comparaison par ÉGALITÉ STRICTE uniquement : deux comptes commencent par
// « Banque Nova » et deux par « Banque Horizon ». Aucun startsWith / includes.
//
// FIX PERF : V1 faisait transactions.filter(t => t.monthKey === mk) dans une
// boucle forEach(allMonths) → O(n×m). V2 pré-indexe dans un Map → O(n) + O(m).

import { useMemo } from "react";
import type { Transaction } from "@/types";
import { COMPTES_REELS } from "@/config/constants";

interface BalancesResult {
  balancesByMonth: Record<string, Record<string, number>>;
  currentBalances: Record<string, number>;
  balanceChartData: (monthsInRange: string[]) => Array<Record<string, number | string>>;
}

export function useBalances(
  transactions: Transaction[],
  allMonths: string[],
  initBalances: Record<string, number>,
  directAccounts?: string[]
): BalancesResult {
  const accounts = directAccounts ?? COMPTES_REELS;

  // ── Étape 1 : Pré-indexer les transactions par monthKey (1 seul pass) ──
  const txByMonth = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of transactions) {
      const arr = map.get(t.monthKey);
      if (arr) arr.push(t);
      else map.set(t.monthKey, [t]);
    }
    return map;
  }, [transactions]);

  // ── Étape 2 : Calcul des soldes cumulatifs mois par mois ──────────────
  const balancesByMonth = useMemo(() => {
    const result: Record<string, Record<string, number>> = {};
    const running: Record<string, number> = {};

    // Initialisation des soldes de départ
    for (const compte of accounts) {
      running[compte] = initBalances[compte] ?? 0;
    }

    for (const mk of allMonths) {
      const monthTx = txByMonth.get(mk) ?? []; // O(1) au lieu de O(n)

      for (const t of monthTx) {
        const m = t.montant;
        if (directAccounts) {
          running[t.compte] = Math.round(((running[t.compte] ?? 0) + (t.dc === "Crédit" ? m : -m)) * 100) / 100;
          continue;
        }

        // ─── Règle Banque Horizon - Courant (multi-comptes) ──────
        if (t.compte === "Banque Horizon - Courant") {
          if (t.dc === "Crédit") running["Banque Horizon - Courant"] += m;
          else running["Banque Horizon - Courant"] -= m;
        }
        if (t.compte === "Retrait épargne") {
          running["Banque Horizon - Courant"] += m;
        }
        if (t.compte === "Cagnotte commune" && t.dc === "Débit") {
          running["Banque Horizon - Courant"] -= m;
        }
        if (t.compte === "Banque Horizon - Dépenses partagées" && t.dc === "Débit") {
          running["Banque Horizon - Courant"] -= m;
        }
        if (t.compte === "Banque Nova - Compte joint" && t.dc === "Crédit" && t.type !== "Virement extérieur") {
          running["Banque Horizon - Courant"] -= m;
        }
        if (t.compte === "Banque Équilibre - Compte joint" && t.dc === "Crédit" && t.type !== "Virement extérieur") {
          running["Banque Horizon - Courant"] -= m;
        }

        // ─── Règles simples : comptes à solde propre ──────────────
        if (t.compte === "Banque Nova - Compte joint") {
          if (t.dc === "Crédit") running["Banque Nova - Compte joint"] += m;
          else running["Banque Nova - Compte joint"] -= m;
        }
        if (t.compte === "Banque Équilibre - Compte joint") {
          if (t.dc === "Crédit") running["Banque Équilibre - Compte joint"] += m;
          else running["Banque Équilibre - Compte joint"] -= m;
        }
        if (t.compte === "Carte repas - Titres restaurant") {
          if (t.dc === "Crédit") running["Carte repas - Titres restaurant"] += m;
          else running["Carte repas - Titres restaurant"] -= m;
        }
        if (t.compte === "Banque Nova - Épargne") {
          if (t.dc === "Crédit") running["Banque Nova - Épargne"] += m;
          else running["Banque Nova - Épargne"] -= m;
        }
      }

      // Snapshot du mois avec Total
      const total = Math.round(accounts.reduce((sum, c) => sum + (running[c] ?? 0), 0) * 100) / 100;
      result[mk] = { ...running, Total: total };
    }

    return result;
  }, [txByMonth, allMonths, initBalances, accounts, directAccounts]);

  // ── Étape 3 : Soldes du dernier mois (= soldes actuels) ───────────────
  const currentBalances = useMemo(() => {
    if (!allMonths.length) {
      const empty: Record<string, number> = { Total: 0 };
      for (const c of accounts) empty[c] = initBalances[c] ?? 0;
      return empty;
    }
    return balancesByMonth[allMonths[allMonths.length - 1]] ?? {};
  }, [balancesByMonth, allMonths, accounts, initBalances]);

  // ── Étape 4 : Données pour le LineChart (mémoïsé via useMemo) ─────────
  // V1 renvoyait une fonction brute recréée à chaque render.
  // V2 : on retourne une fonction stable mais les données internes sont mémoïsées.
  const balanceChartData = useMemo(() => {
    return (monthsInRange: string[]) =>
      monthsInRange.map((mk) => ({
        monthKey: mk,
        ...Object.fromEntries(accounts.map(c => [c, Math.round(balancesByMonth[mk]?.[c] ?? 0)])),
        Total: Math.round(balancesByMonth[mk]?.["Total"] ?? 0),
      }));
  }, [balancesByMonth, accounts]);

  return {
    balancesByMonth,
    currentBalances,
    balanceChartData,
  };
}
