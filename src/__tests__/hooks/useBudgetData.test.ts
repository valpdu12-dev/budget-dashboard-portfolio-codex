import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useBudgetData, getBudgetStatus } from "@/hooks/useBudgetData";
import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeConfig } from "../helpers/factories";
import type { Transaction, BudgetData, DataCoverage } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────

function seedStores(
  transactions: Transaction[],
  budgets?: BudgetData,
  period: string = "all",
  coverage?: DataCoverage
) {
  const cfg = makeConfig();
  const dates = transactions.map((transaction) => transaction.date).sort();
  const defaultCoverage: DataCoverage = dates.length > 0
    ? {
        dateMin: dates[0],
        dateMax: dates[dates.length - 1],
        completeMonths: [...new Set(transactions.map((transaction) => transaction.monthKey))].sort(),
        basis: "declared",
      }
    : { dateMin: null, dateMax: null, completeMonths: [], basis: "none" };
  useDataStore.getState().setData(
    transactions,
    { months: [], cotLast: [], patronLast: [], lastMonth: "" },
    cfg,
    { coverage: coverage ?? defaultCoverage }
  );
  if (budgets) useDataStore.getState().setBudgets(budgets);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cast partiel volontaire (état de test)
  useFilterStore.setState({ period } as any);
}

// ── Dataset synthétique : la couverture est déclarée séparément des achats
function makeFullMonthTx(mk: string, cat2: string, total: number, nbDays: number): Transaction[] {
  const [y, m] = mk.split("-");
  return Array.from({ length: nbDays }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return makeTx({
      date: `${y}-${m}-${day}`,
      montant: Math.round(total / nbDays),
      dc: "Débit",
      cat2,
      monthKey: mk,
    });
  });
}

const BUDGETS_FIXTURE: BudgetData = {
  budgets: [
    { cat2: "Alimentation", target: 400, active: true, updated_at: null },
    { cat2: "Loisirs", target: 100, active: true, updated_at: null },
    { cat2: "Transport", target: 150, active: true, updated_at: null },
  ],
};

beforeEach(() => {
  localStorage.clear();
  resetAllStores();
});

// ═════════════════════════════════════════════════════════════════════════
// 1. Helper de statut
// ═════════════════════════════════════════════════════════════════════════
describe("getBudgetStatus", () => {
  it("retourne 'ok' si <= budget", () => {
    expect(getBudgetStatus(90, 100)).toBe("ok");
  });
  it("retourne 'warning' si 100-120%", () => {
    expect(getBudgetStatus(110, 100)).toBe("warning");
  });
  it("retourne 'over' si > 120%", () => {
    expect(getBudgetStatus(130, 100)).toBe("over");
  });
  it("retourne 'no-budget' si target null", () => {
    expect(getBudgetStatus(100, null)).toBe("no-budget");
  });
  it("retourne 'insufficient-data' si aucun mois comparable n'existe", () => {
    expect(getBudgetStatus(null, 100)).toBe("insufficient-data");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Calcul d'écart avec données connues
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — écarts", () => {
  it("calcule l'écart valeur et % correctement", () => {
    // 3 mois complets à 460€/mois en Alimentation → moyenne 460, budget 400
    // (makeFullMonthTx(460, 20) → 20 tx × 23€ = 460)
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 460, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 460, 20),
      ...makeFullMonthTx("2025-03", "Alimentation", 460, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((r) => r.cat2 === "Alimentation");
    expect(alim).toBeDefined();
    if (alim) {
      expect(alim.averageMonthly).toBe(460);
      expect(alim.target).toBe(400);
      expect(alim.ecartValue).toBe(60);   // 460 - 400
      expect(alim.ecartPct).toBe(15);     // (60/400)*100
      expect(alim.status).toBe("warning"); // 115% → warning (100-120%)
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Couverture des mois
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — couverture", () => {
  it("exclut les mois que la source ne déclare pas complets", () => {
    // 2 mois couverts à 300€ + 1 mois de bord non couvert à 100€.
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-02", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-03", "Alimentation", 100, 5),
    ];
    seedStores(tx, BUDGETS_FIXTURE, "all", {
      dateMin: "2025-01-01",
      dateMax: "2025-03-05",
      completeMonths: ["2025-01", "2025-02"],
      basis: "declared",
    });

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((r) => r.cat2 === "Alimentation");
    expect(alim).toBeDefined();
    if (alim) {
      // Moyenne sur 2 mois éligibles seulement : (300+300)/2 = 300
      expect(alim.averageMonthly).toBe(300);
    }
  });

  it("compte un mois complet même s'il ne contient qu'un mouvement", () => {
    const tx = [makeTx({
      date: "2025-01-15", monthKey: "2025-01", cat2: "Alimentation",
      montant: 900, dc: "Débit",
    })];
    seedStores(tx, BUDGETS_FIXTURE, "all", {
      dateMin: "2025-01-01",
      dateMax: "2025-01-31",
      completeMonths: ["2025-01"],
      basis: "declared",
    });

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((row) => row.cat2 === "Alimentation");
    expect(alim?.averageMonthly).toBe(900);
    expect(alim?.status).toBe("over");
    expect(result.current.kpis.complianceRate).toBe(67);
  });

  it("n'affiche ni zéro ni 100 % quand aucun mois complet n'est connu", () => {
    const tx = [makeTx({
      date: "2025-01-15", monthKey: "2025-01", cat2: "Alimentation",
      montant: 900, dc: "Débit",
    })];
    seedStores(tx, BUDGETS_FIXTURE, "all", {
      dateMin: "2025-01-15",
      dateMax: "2025-01-15",
      completeMonths: [],
      basis: "inferred",
    });

    const { result } = renderHook(() => useBudgetData());
    const alim = result.current.rows.find((row) => row.cat2 === "Alimentation");
    expect(alim?.averageMonthly).toBeNull();
    expect(alim?.status).toBe("insufficient-data");
    expect(result.current.kpis.totalActual).toBeNull();
    expect(result.current.kpis.balance).toBeNull();
    expect(result.current.kpis.complianceRate).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Agrégation Cat2 correcte
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — agrégation Cat2", () => {
  it("groupe par Cat2 et non par type", () => {
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 200, 20),
      ...makeFullMonthTx("2025-01", "Loisirs", 80, 20),
      ...makeFullMonthTx("2025-01", "Transport", 120, 20),
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const cats = result.current.rows.map((r) => r.cat2);
    expect(cats).toContain("Alimentation");
    expect(cats).toContain("Loisirs");
    expect(cats).toContain("Transport");
  });

  it("inclut les Cat2 avec budget mais sans transaction", () => {
    // Pas de transaction Transport, mais budget défini
    const tx = makeFullMonthTx("2025-01", "Alimentation", 200, 20);
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const transport = result.current.rows.find((r) => r.cat2 === "Transport");
    expect(transport).toBeDefined();
    if (transport) {
      expect(transport.averageMonthly).toBe(0);
      expect(transport.target).toBe(150);
      expect(transport.status).toBe("ok"); // 0 <= 150
    }
  });

  it("KPIs agrégés cohérents", () => {
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 500, 20), // > 400 → warning
      ...makeFullMonthTx("2025-01", "Loisirs", 80, 20),       // < 100 → ok
      ...makeFullMonthTx("2025-01", "Transport", 200, 20),     // > 150 → warning (133%)
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const { kpis } = result.current;
    expect(kpis.totalBudgeted).toBe(650);  // 400+100+150
    expect(kpis.totalActual).toBe(780);    // 500+80+200
    expect(kpis.overrunCount).toBe(2);     // Alimentation + Transport
    expect(kpis.balance).toBe(-130);       // 650-780
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. Cas vide (pas de budget défini)
// ═════════════════════════════════════════════════════════════════════════
describe("useBudgetData — cas vide", () => {
  it("fonctionne sans budget défini", () => {
    const tx = makeFullMonthTx("2025-01", "Alimentation", 300, 20);
    seedStores(tx); // pas de budgets

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.rows).toHaveLength(1);
    const alim = result.current.rows[0];
    expect(alim.target).toBeNull();
    expect(alim.ecartValue).toBeNull();
    expect(alim.status).toBe("no-budget");
  });

  it("compte zéro quand la source confirme un mois complet sans transaction", () => {
    seedStores([], BUDGETS_FIXTURE, "all", {
      dateMin: "2025-01-01",
      dateMax: "2025-01-31",
      completeMonths: ["2025-01"],
      basis: "declared",
    });

    const { result } = renderHook(() => useBudgetData());
    // Les 3 budgets définis apparaissent quand même
    expect(result.current.rows.length).toBe(3);
    result.current.rows.forEach((r) => {
      expect(r.averageMonthly).toBe(0);
    });
  });

  it("rend les moyennes indisponibles sans transaction ni couverture", () => {
    seedStores([], BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    result.current.rows.forEach((row) => {
      expect(row.averageMonthly).toBeNull();
      expect(row.status).toBe("insufficient-data");
    });
    expect(result.current.kpis.complianceRate).toBeNull();
  });

  it("complianceRate vaut null — et non 100 — quand aucun budget n'est défini", () => {
    // Ce test attendait 100 jusqu'au 11/08/2026. La valeur par défaut est
    // défendable pour un tableau vide, trompeuse en KPI : « Taux de
    // conformité : 100 % » se lit comme un succès alors qu'aucune catégorie
    // n'est comparable. L'affichage rend « — », sans couleur.
    seedStores([]);

    const { result } = renderHook(() => useBudgetData());
    expect(result.current.kpis.complianceRate).toBeNull();
  });

  it("topRows filtre les postes sous le seuil", () => {
    const tx = [
      ...makeFullMonthTx("2025-01", "Alimentation", 300, 20),
      ...makeFullMonthTx("2025-01", "Loisirs", 30, 20), // < 50€ → exclu du top
    ];
    seedStores(tx, BUDGETS_FIXTURE);

    const { result } = renderHook(() => useBudgetData());
    const topCats = result.current.topRows.map((r) => r.cat2);
    expect(topCats).toContain("Alimentation");
    expect(topCats).not.toContain("Loisirs");
  });
});

describe("useBudgetData — persistance locale", () => {
  it("modifie un budget sans appeler de serveur", async () => {
    seedStores(makeFullMonthTx("2025-01", "Alimentation", 300, 20), BUDGETS_FIXTURE);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useBudgetData());

    await act(async () => {
      await result.current.updateBudget("Alimentation", 475);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useDataStore.getState().budgets?.budgets.find((row) => row.cat2 === "Alimentation")?.target).toBe(475);
    expect(localStorage.getItem("budget-demo.budgets.v1")).toContain("475");
  });
});
