import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBalances } from "@/hooks/useBalances";
import { makeTx } from "../helpers/factories";
import type { Transaction } from "@/types";

// ── Helpers ─────────────────────────────────────────────────────────────
const INIT_ZERO: Record<string, number> = {
  "Banque Horizon - Courant": 0,
  "Banque Nova - Compte joint": 0,
  "Banque Équilibre - Compte joint": 0,
  "Carte repas - Titres restaurant": 0,
};

const INIT_CUSTOM: Record<string, number> = {
  "Banque Horizon - Courant": 5000,
  "Banque Nova - Compte joint": 2000,
  "Banque Équilibre - Compte joint": 1500,
  "Carte repas - Titres restaurant": 100,
};

const MONTHS_3 = ["2025-01", "2025-02", "2025-03"];

// ═════════════════════════════════════════════════════════════════════════
// 1. Cas vide
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — sans données", () => {
  it("retourne des balances vides quand aucun mois", () => {
    const { result } = renderHook(() => useBalances([], [], INIT_ZERO));
    expect(result.current.balancesByMonth).toEqual({});
    expect(result.current.currentBalances).toEqual(
      expect.objectContaining({ Total: 0 })
    );
  });

  it("retourne les soldes initiaux si transactions vides mais mois présents", () => {
    const { result } = renderHook(() =>
      useBalances([], ["2025-01"], INIT_CUSTOM)
    );
    // Pas de transaction → les soldes restent aux initiales
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(5000);
    expect(result.current.balancesByMonth["2025-01"]["Banque Nova - Compte joint"]).toBe(2000);
    expect(result.current.balancesByMonth["2025-01"]["Banque Équilibre - Compte joint"]).toBe(1500);
    expect(result.current.balancesByMonth["2025-01"]["Carte repas - Titres restaurant"]).toBe(100);
    expect(result.current.balancesByMonth["2025-01"]["Total"]).toBe(8600);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 2. Règles Banque Horizon - Courant (multi-comptes)
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — règles Banque Horizon - Courant", () => {
  it("Banque Horizon - Courant Crédit → +montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(1000);
  });

  it("Banque Horizon - Courant Débit → -montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Horizon - Courant", dc: "Débit", montant: 300, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(5000 - 300);
  });

  it("Retrait épargne → +montant sur Banque Horizon - Courant (quel que soit dc)", () => {
    const tx = [makeTx({ compte: "Retrait épargne", dc: "Crédit", montant: 500, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(500);
  });

  it("Cagnotte commune Débit → -montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Cagnotte commune", dc: "Débit", montant: 100, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(-100);
  });

  it("Cagnotte commune Crédit → aucun impact sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Cagnotte commune", dc: "Crédit", montant: 200, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(0);
  });

  it("Banque Horizon - Dépenses partagées Débit → -montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Horizon - Dépenses partagées", dc: "Débit", montant: 150, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(-150);
  });

  it("Bourso Crédit (non Virement ext.) → -montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Nova - Compte joint", dc: "Crédit", montant: 400, type: "CB", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    // Impact sur Banque Horizon - Courant : -400 et sur Bourso : +400
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(-400);
    expect(result.current.balancesByMonth["2025-01"]["Banque Nova - Compte joint"]).toBe(400);
  });

  it("Bourso Crédit Virement extérieur → PAS d'impact sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Nova - Compte joint", dc: "Crédit", montant: 400, type: "Virement extérieur", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(0);
    expect(result.current.balancesByMonth["2025-01"]["Banque Nova - Compte joint"]).toBe(400);
  });

  it("CE Crédit (non Virement ext.) → -montant sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Équilibre - Compte joint", dc: "Crédit", montant: 300, type: "Virement", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(-300);
    expect(result.current.balancesByMonth["2025-01"]["Banque Équilibre - Compte joint"]).toBe(300);
  });

  it("CE Crédit Virement extérieur → PAS d'impact sur Banque Horizon - Courant", () => {
    const tx = [makeTx({ compte: "Banque Équilibre - Compte joint", dc: "Crédit", montant: 300, type: "Virement extérieur", monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Banque Horizon - Courant"]).toBe(0);
    expect(result.current.balancesByMonth["2025-01"]["Banque Équilibre - Compte joint"]).toBe(300);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 3. Règles simples : comptes à solde propre (Bourso joint / CE / Carte repas)
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — comptes simples", () => {
  it("Bourso Débit → -montant sur Bourso", () => {
    const tx = [makeTx({ compte: "Banque Nova - Compte joint", dc: "Débit", montant: 200, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque Nova - Compte joint"]).toBe(2000 - 200);
  });

  it("CE Débit → -montant sur CE", () => {
    const tx = [makeTx({ compte: "Banque Équilibre - Compte joint", dc: "Débit", montant: 100, monthKey: "2025-01" })];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_CUSTOM));
    expect(result.current.balancesByMonth["2025-01"]["Banque Équilibre - Compte joint"]).toBe(1500 - 100);
  });

  it("Carte repas - Titres restaurant Crédit et Débit", () => {
    const tx = [
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Crédit", montant: 200, monthKey: "2025-01" }),
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Débit", montant: 50, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Carte repas - Titres restaurant"]).toBe(150);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 4. Calcul cumulatif multi-mois
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — cumul multi-mois", () => {
  const tx: Transaction[] = [
    makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-01" }),
    makeTx({ compte: "Banque Horizon - Courant", dc: "Débit", montant: 800, monthKey: "2025-01" }),
    makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-02" }),
    makeTx({ compte: "Banque Horizon - Courant", dc: "Débit", montant: 900, monthKey: "2025-02" }),
    makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-03" }),
    makeTx({ compte: "Banque Horizon - Courant", dc: "Débit", montant: 700, monthKey: "2025-03" }),
  ];

  it("les soldes sont cumulatifs d'un mois à l'autre", () => {
    const { result } = renderHook(() => useBalances(tx, MONTHS_3, INIT_ZERO));
    const b = result.current.balancesByMonth;
    // Jan : +2500 -800 = 1700
    expect(b["2025-01"]["Banque Horizon - Courant"]).toBe(1700);
    // Fev : 1700 +2500 -900 = 3300
    expect(b["2025-02"]["Banque Horizon - Courant"]).toBe(3300);
    // Mars : 3300 +2500 -700 = 5100
    expect(b["2025-03"]["Banque Horizon - Courant"]).toBe(5100);
  });

  it("le Total inclut tous les comptes réels", () => {
    const txMixed: Transaction[] = [
      makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" }),
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Crédit", montant: 200, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(txMixed, ["2025-01"], INIT_ZERO));
    expect(result.current.balancesByMonth["2025-01"]["Total"]).toBe(1200);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 5. currentBalances
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — currentBalances", () => {
  it("retourne les soldes du dernier mois", () => {
    const tx = [
      makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 1000, monthKey: "2025-01" }),
      makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 500, monthKey: "2025-02" }),
    ];
    const { result } = renderHook(() =>
      useBalances(tx, ["2025-01", "2025-02"], INIT_ZERO)
    );
    // Cumul : Jan 1000, Fev 1500
    expect(result.current.currentBalances["Banque Horizon - Courant"]).toBe(1500);
  });

  it("retourne un objet avec Total:0 quand allMonths est vide", () => {
    const { result } = renderHook(() => useBalances([], [], INIT_ZERO));
    expect(result.current.currentBalances.Total).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 6. balanceChartData
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — balanceChartData", () => {
  it("retourne un tableau formaté pour le LineChart", () => {
    const tx = [
      makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 3000, monthKey: "2025-01" }),
      makeTx({ compte: "Banque Nova - Compte joint", dc: "Crédit", montant: 500, type: "Virement extérieur", monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData(["2025-01"]);

    expect(chartData).toHaveLength(1);
    expect(chartData[0]).toMatchObject({
      monthKey: "2025-01",
      "Banque Horizon - Courant": 3000,
      "Banque Nova - Compte joint": 500,
    });
  });

  it("retourne un tableau vide si monthsInRange est vide", () => {
    const { result } = renderHook(() => useBalances([], ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData([]);
    expect(chartData).toEqual([]);
  });

  it("arrondit les valeurs à l'entier", () => {
    // Carte repas - Titres restaurant : 0.1 + 0.2 ≈ 0.3 (float)
    const tx = [
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Crédit", montant: 0.1, monthKey: "2025-01" }),
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Crédit", montant: 0.2, monthKey: "2025-01" }),
    ];
    const { result } = renderHook(() => useBalances(tx, ["2025-01"], INIT_ZERO));
    const chartData = result.current.balanceChartData(["2025-01"]);
    // Math.round(0.3) = 0
    expect(chartData[0]["Carte repas - Titres restaurant"]).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// 7. Scénario intégré multi-comptes
// ═════════════════════════════════════════════════════════════════════════
describe("useBalances — scénario intégré", () => {
  it("gère un flux réaliste multi-comptes sur 2 mois", () => {
    const tx: Transaction[] = [
      // Janvier : salaire Banque Horizon - Courant, dépense CB Banque Horizon - Courant, virement vers Bourso
      makeTx({ compte: "Banque Horizon - Courant", dc: "Crédit", montant: 2500, monthKey: "2025-01" }),
      makeTx({ compte: "Banque Horizon - Courant", dc: "Débit", montant: 800, monthKey: "2025-01" }),
      makeTx({ compte: "Banque Nova - Compte joint", dc: "Crédit", montant: 600, type: "Virement", monthKey: "2025-01" }),
      // → Banque Horizon - Courant = 5000+2500-800-600 = 6100, Bourso = 2000+600 = 2600
      // Février : Carte repas - Titres restaurant rechargé, sortie épargne
      makeTx({ compte: "Carte repas - Titres restaurant", dc: "Crédit", montant: 180, monthKey: "2025-02" }),
      makeTx({ compte: "Retrait épargne", dc: "Débit", montant: 300, monthKey: "2025-02" }),
      // → Banque Horizon - Courant = 6100+300 = 6400, Carte repas - Titres restaurant = 100+180 = 280
    ];

    const { result } = renderHook(() =>
      useBalances(tx, ["2025-01", "2025-02"], INIT_CUSTOM)
    );

    const jan = result.current.balancesByMonth["2025-01"];
    expect(jan["Banque Horizon - Courant"]).toBe(6100);
    expect(jan["Banque Nova - Compte joint"]).toBe(2600);
    expect(jan["Banque Équilibre - Compte joint"]).toBe(1500);
    expect(jan["Carte repas - Titres restaurant"]).toBe(100);
    expect(jan["Total"]).toBe(6100 + 2600 + 1500 + 100);

    const feb = result.current.balancesByMonth["2025-02"];
    expect(feb["Banque Horizon - Courant"]).toBe(6400);
    expect(feb["Carte repas - Titres restaurant"]).toBe(280);

    // currentBalances = dernier mois (février)
    expect(result.current.currentBalances["Banque Horizon - Courant"]).toBe(6400);
  });
});
