/**
 * useBudgetData — Hook de la page Budget Mensuel (Session 2A, Phase 2).
 *
 * Agrège les dépenses par sous-catégorie (Cat2) et les compare aux budgets
 * cibles. Ne retient pour la moyenne que les mois déclarés complets par la
 * source, ou inférés prudemment entre les deux mois de bord. Les sparklines
 * couvrent en revanche tous les mois de la plage.
 *
 * Consomme : useDataStore (budgets) + useFilteredData (transactions filtrées par période).
 *
 * @param topThreshold - Seuil €/mois au-dessus duquel un poste apparaît dans `topRows` (défaut 50).
 * @returns {UseBudgetDataReturn} rows (lignes Cat2 budget vs réel), kpis (totaux/conformité),
 *   topRows (postes au-dessus du seuil), isLoading, et updateBudget(cat2, target) qui persiste
 *   un budget cible dans le navigateur puis rafraîchit le store.
 */

import { useMemo, useCallback } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { useFilteredData } from "@/hooks/useFilteredData";
import { saveLocalBudgets } from "@/services/budgetPersistence";
import { persistCurrentImport } from "@/services/configurationPersistence";
import { isTransfer, cents } from "@/utils/businessRules";
import type {
  BudgetTarget, DataCoverage, DataOrigin,
} from "@/types";

// ─── Types de retour ────────────────────────────────────────────────────

/** Ligne du tableau budget par Cat2 */
export interface BudgetCat2Row {
  cat2: string;
  averageMonthly: number | null; // null quand aucun mois comparable n'est connu
  target: number | null;       // Budget cible (€, null si non défini)
  ecartValue: number | null;   // Écart en € (positif = dépassement)
  ecartPct: number | null;     // Écart en % (positif = dépassement)
  status: "ok" | "warning" | "over" | "no-budget" | "insufficient-data";
  monthlyData: SparklinePoint[]; // Évolution mensuelle pour sparkline
}

/** Point de sparkline (1 mois) */
export interface SparklinePoint {
  mk: string;                 // "2025-01"
  actual: number;             // Dépense réelle du mois
  target: number | null;      // Budget cible (constant)
}

/** KPIs agrégés de la page Budget */
export interface BudgetKPIs {
  totalBudgeted: number;       // Somme des budgets cibles actifs
  totalActual: number | null;  // null quand aucun mois comparable n'est connu
  overrunCount: number;        // Nombre de Cat2 en dépassement
  /**
   * % de Cat2 dans le budget (0-100), ou `null` quand AUCUNE catégorie n'est
   * comparable — faute de budget cible défini, ou faute de budgets chargés.
   *
   * Valait 100 dans ce cas jusqu'au 11/08/2026. Valeur par défaut défendable
   * pour un tableau vide, trompeuse en KPI : « Taux de conformité : 100 % »
   * se lit comme un succès alors qu'il ne repose sur rien.
   */
  complianceRate: number | null;
  balance: number | null;      // totalBudgeted - totalActual
}

/** Retour complet du hook */
export interface UseBudgetDataReturn {
  rows: BudgetCat2Row[];
  kpis: BudgetKPIs;
  topRows: BudgetCat2Row[];    // Postes > seuil (défaut 50€/mois)
  isLoading: boolean;
  dataOrigin: DataOrigin;
  coverage: DataCoverage;
  comparableMonths: string[];
  updateBudget: (cat2: string, target: number) => Promise<void>;
}

// ─── Constantes ─────────────────────────────────────────────────────────

const DEFAULT_TOP_THRESHOLD = 50; // €/mois

// ─── Helpers purs (testables, hors hook) ────────────────────────────────

/**
 * Détermine le statut visuel d'un poste budget.
 */
export function getBudgetStatus(
  actual: number | null,
  target: number | null
): BudgetCat2Row["status"] {
  if (actual === null) return "insufficient-data";
  if (target === null || target === 0) return "no-budget";
  const ratio = actual / target;
  if (ratio <= 1) return "ok";
  if (ratio <= 1.2) return "warning";
  return "over";
}

// ─── Hook principal ─────────────────────────────────────────────────────

export function useBudgetData(
  topThreshold: number = DEFAULT_TOP_THRESHOLD
): UseBudgetDataReturn {
  const { budgets, config, status, dataOrigin, coverage } = useDataStore();
  const { baseTx, allMonthsInRange } = useFilteredData();

  const isLoading = status === "loading";

  // Map des budgets cibles indexé par cat2
  const budgetMap = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    const targets = config?.perspective === "personal" ? budgets?.personalBudgets : budgets?.budgets;
    if (targets) {
      for (const b of targets) {
        if (b.active) map.set(b.cat2, b);
      }
    }
    return map;
  }, [budgets, config?.perspective]);

  // Toutes les transactions débit avec cat2 valide, dans la période
  const debitTx = useMemo(
    () => baseTx.filter((t) => t.dc === "Débit" && !isTransfer(t) && t.cat2 && t.cat2 !== "x"),
    [baseTx]
  );

  // La complétude appartient à la source, pas au nombre de jours contenant
  // une dépense. Un relevé complet peut parfaitement n'avoir qu'un mouvement.
  const comparableMonths = useMemo(() => {
    const complete = new Set(coverage.completeMonths);
    return allMonthsInRange.filter((month) => complete.has(month));
  }, [allMonthsInRange, coverage.completeMonths]);

  // Dépenses par Cat2 par mois (tous les mois de la plage, pas seulement éligibles)
  const cat2MonthlyMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const t of debitTx) {
      if (!map.has(t.cat2)) map.set(t.cat2, new Map());
      const mMap = map.get(t.cat2)!;
      mMap.set(t.monthKey, (mMap.get(t.monthKey) ?? 0) + t.montant);
    }
    return map;
  }, [debitTx]);

  // Toutes les Cat2 distinctes (union transactions + budgets)
  const allCat2 = useMemo(() => {
    const set = new Set<string>();
    for (const cat2 of cat2MonthlyMap.keys()) set.add(cat2);
    for (const cat2 of budgetMap.keys()) set.add(cat2);
    return Array.from(set).sort();
  }, [cat2MonthlyMap, budgetMap]);

  // Construction des lignes
  const rows = useMemo<BudgetCat2Row[]>(() => {
    const nbComparable = comparableMonths.length;

    return allCat2.map((cat2) => {
      const monthlyMap = cat2MonthlyMap.get(cat2);
      const budget = budgetMap.get(cat2);
      const target = budget?.target ?? null;

      // Somme sur les mois dont la couverture est connue comme complète.
      let totalComparable = 0;
      if (monthlyMap && nbComparable > 0) {
        for (const mk of comparableMonths) {
          totalComparable += monthlyMap.get(mk) ?? 0;
        }
      }
      const averageMonthly = nbComparable > 0
        ? cents(totalComparable / nbComparable)
        : null;

      // Écarts
      const ecartValue = target !== null && averageMonthly !== null
        ? cents(averageMonthly - target)
        : null;
      const ecartPct = target !== null && target > 0 && averageMonthly !== null
        ? Math.round(((averageMonthly - target) / target) * 100)
        : null;

      // Sparkline : tous les mois de la plage (éligibles ou non)
      const monthlyData: SparklinePoint[] = allMonthsInRange.map((mk) => ({
        mk,
        actual: cents(monthlyMap?.get(mk) ?? 0),
        target,
      }));

      return {
        cat2,
        averageMonthly,
        target,
        ecartValue,
        ecartPct,
        status: getBudgetStatus(averageMonthly, target),
        monthlyData,
      };
    });
  }, [allCat2, cat2MonthlyMap, budgetMap, comparableMonths, allMonthsInRange]);

  // KPIs agrégés
  const kpis = useMemo<BudgetKPIs>(() => {
    const withBudget = rows.filter((r) => r.target !== null && r.target > 0);
    const comparableWithBudget = withBudget.filter((r) => r.averageMonthly !== null);
    const totalBudgeted = withBudget.reduce((s, r) => s + (r.target ?? 0), 0);
    const totalActual = comparableWithBudget.length > 0
      ? comparableWithBudget.reduce((s, r) => s + (r.averageMonthly ?? 0), 0)
      : null;
    const overrunCount = comparableWithBudget
      .filter((r) => r.status === "over" || r.status === "warning").length;
    // `null` et non 100 : sans catégorie comparable, il n'y a pas de taux —
    // ni bon, ni mauvais. L'affichage rend « — ».
    const complianceRate = comparableWithBudget.length > 0
      ? Math.round((comparableWithBudget.filter((r) => r.status === "ok").length / comparableWithBudget.length) * 100)
      : null;

    return {
      totalBudgeted: cents(totalBudgeted),
      totalActual: totalActual === null ? null : cents(totalActual),
      overrunCount,
      complianceRate,
      balance: totalActual === null ? null : cents(totalBudgeted - totalActual),
    };
  }, [rows]);

  // Top postes (au-dessus du seuil)
  const topRows = useMemo(
    () => rows
      .filter((r) => r.averageMonthly !== null && r.averageMonthly >= topThreshold)
      .sort((a, b) => (b.averageMonthly ?? 0) - (a.averageMonthly ?? 0)),
    [rows, topThreshold]
  );

  // Mise à jour locale : la démo reste autonome et les changements sont
  // conservés uniquement dans le navigateur courant.
  const updateBudget = useCallback(async (cat2: string, target: number) => {
    const state = useDataStore.getState();
    if (!Number.isFinite(target) || target < 0 || target > 1e12) throw new Error("Le budget doit être un montant positif ou nul.");
    const key = state.config?.perspective === "personal" ? "personalBudgets" : "budgets";
    const current = state.budgets?.[key] ?? [];
    const existingIndex = current.findIndex((budget) => budget.cat2 === cat2);
    const updated = {
      cat2,
      target,
      active: true,
      updated_at: new Date().toISOString(),
    };
    const next = existingIndex >= 0
      ? current.map((budget, index) => index === existingIndex ? updated : budget)
      : [...current, updated];
    const payload = { ...(state.budgets ?? { budgets: [] }), [key]: next };
    state.setBudgets(payload);
    if (state.dataOrigin === "upload") {
      const saved = persistCurrentImport();
      if (!saved) state.setStorageNotice("Budget modifié pour cette session. Le stockage local n'a pas pu être mis à jour.");
    } else if (!saveLocalBudgets(payload)) state.setStorageNotice("Budget modifié pour cette session. Le stockage local n’a pas pu être mis à jour.");
  }, []);

  return {
    rows, kpis, topRows, isLoading, dataOrigin, coverage, comparableMonths,
    updateBudget,
  };
}
