// ── Hook dédié Épargne (extrait de V1 Epargne.jsx) ──────────────────────
//
// Calcule :
//   1. epargneTx — entrées épargne (type ∈ EPARGNE_TYPES, Débit, hors "Retrait épargne")
//   2. sortieEpargneTx — retraits (compte "Retrait épargne")
//   3. recettesTx — crédits (pour ratio)
//   4. KPIs (totalEp, totalEntrees, totalSorties, totalRec, ratio, nbTx, curEp, prevEp)
//   5. chartData — ComposedChart (épargne nette + recettes + ratio)
//   6. donutData — Répartition par type

import { useMemo } from "react";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useFilterStore } from "@/stores/useFilterStore";
import { useDataStore } from "@/stores/useDataStore";
import { isTransfer, typeKey } from "@/utils/businessRules";
import { EPARGNE_TYPES } from "@/config/constants";
import { mkLabel } from "@/utils/formatters";

export interface SavingsKPIs {
  totalEp: number;
  totalEntrees: number;
  totalSorties: number;
  totalRec: number;
  ratio: number;
  nbTx: number;
  curEp: number;
  prevEp: number;
}

export interface SavingsChartPoint {
  monthKey: string;
  label: string;
  Épargne: number;
  Recettes: number;
  Ratio: number;
}

export interface DonutSlice {
  id: string;
  name: string;
  value: number;
}

export function useSavingsData() {
  const { rawPeriodTx, baseTx, allMonthsInRange, currentMonth, prevMonth } = useFilteredData();
  const { selEpMonth } = useFilterStore();
  const config = useDataStore(state => state.config);
  const savingsAccounts = useMemo(() => config?.balanceMode === "direct"
    ? new Set(Object.keys(config.accountKinds ?? {}).filter(a => config.accountKinds?.[a] === "Épargne")) : null, [config]);

  const txSource = rawPeriodTx || baseTx;

  // ─── Transactions épargne — entrées ────────────────────────────
  const epargneTx = useMemo(
    () => txSource.filter(
      (t) => savingsAccounts ? (savingsAccounts.has(t.compte) && t.dc === "Crédit")
        || (config?.compatibility === "legacy-dashboard-v1" && t.role === "loan-capital" && t.dc === "Débit")
        : (EPARGNE_TYPES as readonly string[]).includes(t.type)
        && t.dc === "Débit"
        && t.compte !== "Retrait épargne"
    ),
    [txSource, savingsAccounts, config?.compatibility]
  );

  // ─── Transactions épargne — sorties ────────────────────────────
  const sortieEpargneTx = useMemo(
    () => txSource.filter((t) => savingsAccounts ? savingsAccounts.has(t.compte) && t.dc === "Débit" : t.compte === "Retrait épargne"),
    [txSource, savingsAccounts]
  );

  // ─── Recettes (Crédit) ─────────────────────────────────────────
  const recettesTx = useMemo(
    () => baseTx.filter((t) => t.dc === "Crédit" && (!savingsAccounts || !isTransfer(t))),
    [baseTx, savingsAccounts]
  );

  // ─── KPIs ──────────────────────────────────────────────────────
  const kpis = useMemo<SavingsKPIs>(() => {
    const totalEntrees = epargneTx.reduce((s, t) => s + t.montant, 0);
    const totalSorties = sortieEpargneTx.reduce((s, t) => s + t.montant, 0);
    const totalEp = totalEntrees - totalSorties;
    const totalRec = recettesTx.reduce((s, t) => s + t.montant, 0);
    const ratio = totalRec > 0 ? totalEp / totalRec : 0;
    const nbTx = epargneTx.length + sortieEpargneTx.length;

    const curEntrees = epargneTx.filter((t) => t.monthKey === currentMonth).reduce((s, t) => s + t.montant, 0);
    const curSorties = sortieEpargneTx.filter((t) => t.monthKey === currentMonth).reduce((s, t) => s + t.montant, 0);
    const curEp = curEntrees - curSorties;

    const prevEntrees = epargneTx.filter((t) => t.monthKey === prevMonth).reduce((s, t) => s + t.montant, 0);
    const prevSorties = sortieEpargneTx.filter((t) => t.monthKey === prevMonth).reduce((s, t) => s + t.montant, 0);
    const prevEp = prevEntrees - prevSorties;

    return { totalEp, totalEntrees, totalSorties, totalRec, ratio, nbTx, curEp, prevEp };
  }, [epargneTx, sortieEpargneTx, recettesTx, currentMonth, prevMonth]);

  // ─── ComposedChart data ────────────────────────────────────────
  const chartData = useMemo<SavingsChartPoint[]>(() => {
    const rows = allMonthsInRange.map((mk) => {
      const entrees = epargneTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const sorties = sortieEpargneTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const epNet = entrees - sorties;
      const rec = recettesTx.filter((t) => t.monthKey === mk).reduce((s, t) => s + t.montant, 0);
      const ratio = rec > 0 ? epNet / rec : 0;
      return { monthKey: mk, label: mkLabel(mk), Épargne: Math.round(epNet), Recettes: Math.round(rec), Ratio: ratio } as SavingsChartPoint;
    });
    // prev_* pour comparaison N-1 dans tooltips
    for (let i = 1; i < rows.length; i++) {
      (rows[i] as unknown as Record<string, unknown>)["prev_Épargne"] = rows[i - 1].Épargne;
      (rows[i] as unknown as Record<string, unknown>)["prev_Recettes"] = rows[i - 1].Recettes;
      (rows[i] as unknown as Record<string, unknown>)["prev_Ratio"] = rows[i - 1].Ratio;
    }
    return rows;
  }, [epargneTx, sortieEpargneTx, recettesTx, allMonthsInRange]);

  // ─── Donut data (filtré par mois sélectionné) ──────────────────
  const donutData = useMemo<DonutSlice[]>(() => {
    let src = epargneTx;
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    const map: Record<string, number> = Object.create(null);
    src.forEach((t) => { map[typeKey(t)] = (map[typeKey(t)] || 0) + t.montant; });
    return Object.entries(map)
      .map(([id, value]) => ({ id, name: epargneTx.find(t => typeKey(t) === id)?.type ?? id, value }))
      .sort((a, b) => b.value - a.value);
  }, [epargneTx, selEpMonth]);

  const donutTotal = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData]
  );

  // ─── Table data (entrées + sorties combinées) ──────────────────
  const tableRawData = useMemo(() => {
    const entrees = epargneTx.map((t) => ({ ...t, isSortie: false }));
    const sorties = sortieEpargneTx.map((t) => ({ ...t, montant: -t.montant, isSortie: true }));
    let src = [...entrees, ...sorties];
    if (selEpMonth) src = src.filter((t) => t.monthKey === selEpMonth);
    return src;
  }, [epargneTx, sortieEpargneTx, selEpMonth]);

  const tableTotal = useMemo(
    () => tableRawData.reduce((s, t) => s + t.montant, 0),
    [tableRawData]
  );

  return {
    kpis,
    chartData,
    donutData,
    donutTotal,
    tableRawData,
    tableTotal,
    currentMonth,
    prevMonth,
    allMonthsInRange,
  };
}
