// ── Page Comptes V2 — Vue d'ensemble des soldes et flux ──────────────────
// Migré depuis V1 Comptes.jsx (392 lignes → ~200 lignes)
// Améliorations V2 :
//   - Zustand stores (0 props drilling)
//   - Composants partagés (KPICard, ChartTooltip)
//   - Tailwind (0 inline style sauf couleurs dynamiques)
//   - TypeScript strict

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Wallet, TrendingDown, TrendingUp, Scale, Banknote,
  PiggyBank, CreditCard, BadgeEuro, BarChart3,
  CalendarClock, AlertTriangle,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { DataTable } from "@/components/ui/DataTable";
import { KPICard } from "@/components/ui/KPICard";
import { ChartTooltip } from "@/components/ui/ChartTooltip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonKPIGrid, SkeletonChart, SkeletonDonut } from "@/components/ui/Skeleton";

import { useDataStore } from "@/stores/useDataStore";
import { useFilterStore } from "@/stores/useFilterStore";
import { useDashboardTransactions } from "@/hooks/useDashboardTransactions";
import { isTransfer } from "@/utils/businessRules";
import { useFilteredData } from "@/hooks/useFilteredData";
import { useAccountBalances } from "@/hooks/useAccountBalances";
import { useKPIs } from "@/hooks/useKPIs";
import { useBudgetData } from "@/hooks/useBudgetData";
import { useChartSize } from "@/hooks/useChartSize";

import { fmt, fmtShort, mkLabel } from "@/utils/formatters";
import { projectMonthEnd, daysInMonthOf, lastTxDayOfMonth } from "@/utils/projection";
import { COMPTE_COLORS, DONUT_COLORS } from "@/config/colors";

/** monthKey "YYYY-MM" → même mois l'année précédente. */
function prevYearKey(mk: string): string {
  const year = parseInt(mk.slice(0, 4), 10);
  return `${year - 1}${mk.slice(4)}`;
}

/** Icône par compte réel */
const COMPTE_ICONS: Record<string, React.ReactNode> = {
  "Banque Horizon - Courant":       <CreditCard size={14} />,
  "Banque Nova - Compte joint":       <Banknote size={14} />,
  "Banque Équilibre - Compte joint": <PiggyBank size={14} />,
  "Carte repas - Titres restaurant":     <BadgeEuro size={14} />,
  "Banque Nova - Épargne":            <Wallet size={14} />,
};

// ─── Donut outer label ──────────────────────────────────────────────────
function renderDonutLabel({
  cx, cy, midAngle, outerRadius, name, percent,
}: { cx: number; cy: number; midAngle: number; outerRadius: number; name: string; percent: number }) {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const r = outerRadius + 22;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#6B7280" textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={12}>
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// ─── Page Comptes ───────────────────────────────────────────────────────
export default function Comptes() {
  const { salary, status } = useDataStore();
  const { allMonths, allMonthsInRange, currentMonth, prevMonth, baseTx } = useFilteredData();
  const showTransfers = useFilterStore(state => state.showTransfers);
  const bankTransactions = useDashboardTransactions("bank");
  const transfers = useMemo(() => bankTransactions.filter(t => isTransfer(t) && allMonthsInRange.includes(t.monthKey)), [bankTransactions, allMonthsInRange]);

  const salaryMonths = salary?.months ?? [];
  const { accounts, balancesByMonth, currentBalances, balanceChartData } = useAccountBalances(allMonths);

  const kpis = useKPIs(baseTx, balancesByMonth, salaryMonths, currentMonth, prevMonth);

  // Lot 1.2 — dimensions de graphique pilotées par le palier d'affichage.
  const { chartHeight, donutRadii, isSmall } = useChartSize();
  const donut = donutRadii(70, 110);

  // Badge alertes budget (QW4) — postes en dépassement (warning + over)
  const { kpis: budgetKpis } = useBudgetData();
  const hasDefinedBudget = budgetKpis.complianceRate !== null;

  // Données du graphe soldes + comparatif N-1 (prev_Total) pour le tooltip (QW2)
  const lineData = useMemo(
    () =>
      balanceChartData(allMonthsInRange).map((row) => {
        const prevTotal = balancesByMonth[prevYearKey(row.monthKey as string)]?.["Total"];
        return prevTotal !== undefined
          ? { ...row, prev_Total: Math.round(prevTotal) }
          : row;
      }),
    [balanceChartData, allMonthsInRange, balancesByMonth],
  );

  // Projection fin de mois (QW3) — extrapolation linéaire sur le mois en cours
  const projection = useMemo(() => {
    if (!currentMonth) return null;
    const daysElapsed = lastTxDayOfMonth(baseTx, currentMonth);
    const daysInMonth = daysInMonthOf(currentMonth);
    return projectMonthEnd(kpis.depCur, kpis.recCur, daysElapsed, daysInMonth);
  }, [baseTx, currentMonth, kpis.depCur, kpis.recCur]);

  const donutData = useMemo(() => {
    return accounts
      .map((name) => ({ name, value: Math.max(0, Math.round(currentBalances[name] || 0)) }))
      .filter((d) => d.value > 0);
  }, [currentBalances, accounts]);

  const donutTotal = useMemo(
    () => donutData.reduce((s, d) => s + d.value, 0),
    [donutData],
  );

  const soldeTotalCur = kpis.curBal.Total || 0;
  const soldeTotalPrev = kpis.prevBal.Total || 0;

  if (status !== "success") {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Comptes" subtitle="Vue d'ensemble de vos soldes et flux" />
        <SkeletonKPIGrid count={11} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonChart height={chartHeight(380)} />
          <SkeletonDonut size={300} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Comptes" subtitle="Vue d'ensemble de vos soldes et flux" />

      {/* ═══ Bandeau KPI (11 cards) ════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 stagger-grid">
        <KPICard label="Solde Total" value={soldeTotalCur} prev={soldeTotalPrev} color="#6366F1" icon={<Wallet size={14} />} />

        {accounts.map((compte, index) => (
          <KPICard
            key={compte}
            label={compte}
            value={kpis.curBal[compte] || 0}
            prev={kpis.prevBal[compte] || 0}
            color={COMPTE_COLORS[compte] ?? DONUT_COLORS[index % DONUT_COLORS.length]}
            icon={COMPTE_ICONS[compte] ?? <Wallet size={14} />}
          />
        ))}

        <KPICard label="Dépenses mois" value={kpis.depCur} prev={kpis.depPrev} color="#EF4444" icon={<TrendingDown size={14} />} />
        <KPICard label="Recettes mois" value={kpis.recCur} prev={kpis.recPrev} color="#10B981" icon={<TrendingUp size={14} />} />
        <KPICard label="Net du mois" value={kpis.netMonth} color={kpis.netMonth >= 0 ? "#10B981" : "#EF4444"} icon={<Scale size={14} />} />

        {salaryMonths.length > 0 && <KPICard
          label="Salaire net"
          customValue={kpis.lastSal ? fmt(kpis.lastSal.net) : "—"}
          customSub={
            kpis.lastSal && kpis.prevSal
              ? `${(((kpis.lastSal.net - kpis.prevSal.net) / Math.abs(kpis.prevSal.net)) * 100).toFixed(1).replace(".", ",")} % vs préc.`
              : ""
          }
          icon={<Banknote size={14} />}
        />}

        {salaryMonths.length > 0 && <KPICard label="Taux épargne" value={kpis.tauxEpargne} format="pct" color={kpis.tauxEpargne >= 0 ? "#10B981" : "#EF4444"} icon={<PiggyBank size={14} />} />}

        <KPICard
          label="Fixe / Occasionnelle"
          customValue={kpis.occ > 0 ? (kpis.fixe / kpis.occ).toFixed(1).replace(".", ",") : "—"}
          customSub={`${fmt(kpis.fixe)} / ${fmt(kpis.occ)}`}
          subColor="#6B7280"
          icon={<BarChart3 size={14} />}
        />
      </div>

      {/* ═══ Projection fin de mois + Alertes budget ═══════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* QW3 — Projection fin de mois */}
        <div className="card flex items-center gap-4">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-indigo/15 flex items-center justify-center text-indigo-text">
            <CalendarClock size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-text-sec text-xs">Projection fin de mois</span>
            {projection && projection.reliable ? (
              <>
                <span
                  className="text-xl font-title font-bold tabular-nums"
                  style={{ color: projection.projectedNet >= 0 ? "#10B981" : "#EF4444" }}
                >
                  {projection.projectedNet >= 0 ? "+" : ""}{fmt(projection.projectedNet)}
                </span>
                <span className="text-text-sec text-xs">
                  À ce rythme · {projection.daysElapsed}/{projection.daysInMonth} j ·
                  réalisé {projection.currentNet >= 0 ? "+" : ""}{fmt(projection.currentNet)}
                </span>
              </>
            ) : (
              <>
                <span className="text-xl font-title font-bold tabular-nums text-text">
                  {projection ? `${projection.currentNet >= 0 ? "+" : ""}${fmt(projection.currentNet)}` : "—"}
                </span>
                <span className="text-text-sec text-xs">Mois complet — net réalisé</span>
              </>
            )}
          </div>
        </div>

        {/* QW4 — Badge alertes budget */}
        <Link
          to="/depenses/budget"
          className={`card flex items-center gap-4 transition-colors hover:border-indigo/50 ${
            budgetKpis.overrunCount > 0 ? "border-red/40" : ""
          }`}
        >
          <div
            className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
              budgetKpis.overrunCount > 0 ? "bg-red/15 text-red" : hasDefinedBudget ? "bg-green/15 text-green" : "bg-border text-text-sec"
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="flex flex-col">
            <span className="text-text-sec text-xs">Alertes budget</span>
            <span
              className="text-xl font-title font-bold tabular-nums"
              style={{ color: budgetKpis.overrunCount > 0 ? "#EF4444" : hasDefinedBudget ? "#10B981" : "#9CA3AF" }}
            >
              {budgetKpis.overrunCount > 0
                ? `${budgetKpis.overrunCount} poste${budgetKpis.overrunCount > 1 ? "s" : ""} en dépassement`
                : hasDefinedBudget ? "Aucun dépassement" : "Aucun budget défini"}
            </span>
            <span className="text-text-sec text-xs">Voir le budget mensuel →</span>
          </div>
        </Link>
      </div>

      {/* ═══ Graphiques ═══════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="card chart-enter">
          <div className="text-sm font-medium text-text mb-4">
            Évolution mensuelle des soldes
          </div>
          <ResponsiveContainer width="100%" height={chartHeight(380)}>
            <LineChart data={lineData}>
              <CartesianGrid stroke="#1F2937" strokeDasharray="3 3" />
              <XAxis dataKey="monthKey" tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(mk: string) => mkLabel(mk)} />
              <YAxis tick={{ fill: "#6B7280", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtShort(v)} />
              <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              {accounts.map((compte, index) => (
                <Line key={compte} type="monotone" dataKey={compte} stroke={COMPTE_COLORS[compte] ?? DONUT_COLORS[index % DONUT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
              ))}
              <Line type="monotone" dataKey="Total" stroke={COMPTE_COLORS["Total"]} strokeWidth={2.5} strokeDasharray="6 3" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card flex flex-col items-center">
          <div className="text-sm font-medium text-text mb-4 self-start">
            Répartition actuelle des soldes
          </div>
          {donutData.length === 0 ? (
            <EmptyState title="Aucune donnée de solde disponible" />
          ) : (
            <div className={isSmall ? "w-full" : ""}>
              <div className={`relative ${isSmall ? "w-full" : ""}`}>
                {/* Lot 1.6 — `svg-img-alt`. Recharts écrit `role="img"` EN DUR
                    sur chaque `<path class="recharts-sector">` (Sector.js:211,
                    après le spread de `filterProps`) : ni `<Pie>` ni
                    `<PieChart>` ne permettent de le neutraliser par une prop,
                    et `filterProps` ne laisse passer que `data-*` et les
                    attributs SVG. Le seul levier est donc `aria-hidden` sur un
                    ancêtre. Ce div n'enveloppe QUE le graphique : la légende
                    ci-dessous reste dans l'arbre d'accessibilité et porte les
                    mêmes libellés et pourcentages. */}
                <div aria-hidden="true">
                  <ResponsiveContainer width={isSmall ? "100%" : 300} height={chartHeight(300)}>
                    <PieChart tabIndex={-1}>
                      <Pie rootTabIndex={-1} data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={donut.inner} outerRadius={donut.outer} label={donut.showRadialLabels ? renderDonutLabel : false} labelLine={false} style={{ cursor: "default" }}>
                        {donutData.map((d, i) => (
                          <Cell key={i} fill={COMPTE_COLORS[d.name] || DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v) => fmt(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                  <div className="text-text-sec text-xs mb-0.5">Total</div>
                  <div className="text-text text-xl font-bold tabular-nums">{fmtShort(donutTotal)}</div>
                </div>
              </div>
              {/* Lot 1.2 — sous 430 px les libellés radiaux déborderaient de
                  l'écran : ils sont remplacés par cette légende, rendue hors
                  du graphique pour que le total reste centré sur le donut. */}
              {/* Lot 1.6 — cette légende était conditionnée à `!showRadialLabels`,
                  donc absente au-dessus de 430 px, où les libellés radiaux du
                  donut prenaient le relais. Or ces libellés viennent d'être
                  sortis de l'arbre d'accessibilité avec le graphique : sans ce
                  changement, le rendu PC aurait perdu toute restitution
                  textuelle. Elle est désormais toujours rendue, en `sr-only`
                  quand le donut porte ses propres libellés. Aucun changement
                  visuel, à aucune largeur. */}
              {donutData.length > 0 && (
                <ul className={donut.showRadialLabels ? "sr-only" : "flex flex-wrap justify-center gap-x-3 gap-y-1 mt-3 w-full"}>
                  {donutData.map((d, i) => (
                    <li key={d.name} className="flex items-center gap-1.5 text-xs text-text-sec">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: COMPTE_COLORS[d.name] || DONUT_COLORS[i % DONUT_COLORS.length] }}
                        aria-hidden="true"
                      />
                      {d.name} ({donutTotal ? Math.round((d.value / donutTotal) * 100) : 0} %)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      {showTransfers && <DataTable data={transfers as unknown as Record<string, unknown>[]} title="Transferts internes — montants bancaires" columns={[
        { key: "date", label: "Date", sortable: true, priority: true },
        { key: "compte", label: "Compte", sortable: true, priority: true },
        { key: "type", label: "Type", sortable: true },
        { key: "dc", label: "Sens", priority: true },
        { key: "montant", label: "Montant", align: "right", priority: true, render: value => fmt(Number(value)) },
        { key: "transferId", label: "Lien" },
      ]} emptyMessage="Aucun transfert interne sur cette période" />}
    </div>
  );
}
