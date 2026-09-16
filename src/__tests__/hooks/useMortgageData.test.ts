import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMortgageData, LOAN_PRINCIPAL } from "@/hooks/useMortgageData";
import { useDataStore } from "@/stores/useDataStore";
import { resetAllStores } from "../helpers/storeReset";
import { makeTx, makeSalaryData, makeConfig } from "../helpers/factories";

beforeEach(() => {
  resetAllStores();
});

/** Transactions de prêt réalistes : échéance #44 (avr.) et #45 (mai 2026). */
function makeMortgageTxs() {
  return [
    makeTx({ date: "2026-04-15", type: "Crédit Immobilier", dc: "Débit", montant: 644.36, monthKey: "2026-04", compte: "Banque Équilibre - Compte joint" }),
    makeTx({ date: "2026-04-15", type: "Intérêt du prêt",    dc: "Débit", montant: 287.83, monthKey: "2026-04", compte: "Banque Équilibre - Compte joint" }),
    makeTx({ date: "2026-05-15", type: "Crédit Immobilier", dc: "Débit", montant: 645.57, monthKey: "2026-05", compte: "Banque Équilibre - Compte joint" }),
    makeTx({ date: "2026-05-15", type: "Intérêt du prêt",    dc: "Débit", montant: 286.62, monthKey: "2026-05", compte: "Banque Équilibre - Compte joint" }),
    // Transaction hors prêt (doit être ignorée)
    makeTx({ date: "2026-05-20", type: "CB", dc: "Débit", montant: 50, monthKey: "2026-05" }),
  ];
}

describe("useMortgageData — garde-fous", () => {
  it("hasData=false sans transaction de prêt", () => {
    useDataStore.getState().setData([makeTx({})], makeSalaryData(), makeConfig({ loan: { principal: 180000, payment: 932.19, terms: 240 } }));
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.hasData).toBe(false);
  });
});

describe("useMortgageData — historique", () => {
  it("agrège capital et intérêts par mois (ignore le hors-prêt)", () => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig({ loan: { principal: 180000, payment: 932.19, terms: 240 } }));
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.historyData).toHaveLength(2);
    const mai = result.current.historyData.find((p) => p.monthKey === "2026-05");
    expect(mai?.capital).toBeCloseTo(645.57, 2);
    expect(mai?.interets).toBeCloseTo(286.62, 2);
    expect(mai?.total).toBeCloseTo(932.19, 2);
  });
});

describe("useMortgageData — KPIs", () => {
  beforeEach(() => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig({ loan: { principal: 180000, payment: 932.19, terms: 240 } }));
  });

  it("reconstruit le capital restant dû (~152 115 €)", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.capitalRestant).toBeGreaterThan(152000);
    expect(result.current.kpis.capitalRestant).toBeLessThan(152250);
  });

  it("déduit l'échéance courante (#45) et le restant (195)", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.echeancesPayees).toBe(45);
    expect(result.current.kpis.echeancesRestantes).toBe(195);
  });

  it("avancement cohérent et capital remboursé = principal − restant", () => {
    const { result } = renderHook(() => useMortgageData());
    const { kpis } = result.current;
    expect(kpis.avancement).toBeGreaterThan(0);
    expect(kpis.avancement).toBeLessThan(1);
    expect(kpis.capitalRembourse).toBeCloseTo(LOAN_PRINCIPAL - kpis.capitalRestant, 2);
  });

  it("coût total des intérêts ≈ 43 726 €", () => {
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.kpis.coutTotalInterets).toBeCloseTo(43725.6, 1);
  });
});

describe("useMortgageData — projection", () => {
  it("génère 240 échéances et termine à un solde nul", () => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig({ loan: { principal: 180000, payment: 932.19, terms: 240 } }));
    const { result } = renderHook(() => useMortgageData());
    expect(result.current.projectionData).toHaveLength(240);
    expect(result.current.projectionData[239].capitalRestant).toBeLessThan(1);
  });
});

describe("useMortgageData — simulateur", () => {
  beforeEach(() => {
    useDataStore.getState().setData(makeMortgageTxs(), makeSalaryData(), makeConfig({ loan: { principal: 180000, payment: 932.19, terms: 240 } }));
  });

  it("simulate(0) : aucun gain", () => {
    const { result } = renderHook(() => useMortgageData());
    const sim = result.current.simulate(0);
    expect(sim.moisGagnes).toBe(0);
    expect(sim.economieInterets).toBe(0);
    expect(sim.dateFin).toBe(result.current.dateFin);
    expect(sim.echeancesRestantes).toBe(result.current.kpis.echeancesRestantes);
  });

  it("simulate(500) : prêt raccourci + intérêts économisés", () => {
    const { result } = renderHook(() => useMortgageData());
    const sim = result.current.simulate(500);
    expect(sim.moisGagnes).toBeGreaterThan(0);
    expect(sim.economieInterets).toBeGreaterThan(0);
    expect(sim.dateFin < result.current.dateFin).toBe(true);
  });
});
