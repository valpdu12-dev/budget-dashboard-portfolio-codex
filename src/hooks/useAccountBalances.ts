import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { COMPTES_REELS } from "@/config/constants";
import { useDashboardTransactions } from "./useDashboardTransactions";
import { useBalances } from "./useBalances";
import { cents } from "@/utils/businessRules";

/** La quote-part d'un solde se calcule sur le solde bancaire, sans cumuler les arrondis des dépenses. */
export function useAccountBalances(allMonths: string[]) {
  const { config } = useDataStore();
  const transactions = useDashboardTransactions("bank");
  const bank = useBalances(transactions, allMonths, config?.init ?? {}, config?.balanceMode === "direct" ? config.comptes : undefined);
  const accounts = useMemo(() => config?.comptes ?? [...COMPTES_REELS], [config]);
  const balancesByMonth = useMemo<Record<string, Record<string, number>>>(() => {
    if (config?.perspective !== "personal" || !config.accounts) return bank.balancesByMonth;
    return Object.fromEntries(Object.entries(bank.balancesByMonth).map(([month, balances]) => {
      const row = Object.fromEntries(config.accounts!.map(a => [a.label, cents((balances[a.label] ?? 0) * a.share / 100)]));
      return [month, { ...row, Total: cents(Object.values(row).reduce((s, n) => s + n, 0)) }];
    }));
  }, [bank.balancesByMonth, config]);
  const currentBalances = allMonths.length ? balancesByMonth[allMonths[allMonths.length - 1]] ?? {} : bank.currentBalances;
  const balanceChartData = useMemo(() => (months: string[]) => months.map(month => ({ monthKey: month, ...balancesByMonth[month] })), [balancesByMonth]);
  return { accounts, balancesByMonth, currentBalances, balanceChartData };
}
