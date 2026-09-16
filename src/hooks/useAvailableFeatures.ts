import { useDashboardTransactions } from "./useDashboardTransactions";
import { transactionRole } from "@/utils/businessRules";
import { EPARGNE_TYPES } from "@/config/constants";
import { useDataStore } from "@/stores/useDataStore";

export function useAvailableFeatures() {
  const { salary, config, status } = useDataStore();
  const transactions = useDashboardTransactions("bank");
  const hasSalary = Boolean(salary?.months.length);
  const hasInflation = hasSalary && Boolean(salary?.inflation?.some(v => v.rate_annual !== null));
  const hasLoan = Boolean(config?.loan) && transactions.some(t => transactionRole(t) === "loan-capital" && (!config?.loan?.account || config.loan.account === (t.accountId ?? t.compte)))
    && transactions.some(t => transactionRole(t) === "loan-interest" && (!config?.loan?.account || config.loan.account === (t.accountId ?? t.compte)));
  const hasSavings = config?.accounts ? config.accounts.some(a => a.kind === "Épargne") : transactions.some(t => (EPARGNE_TYPES as readonly string[]).includes(t.type));
  return { hasSavings, hasSalary, hasInflation, hasLoan, loaded: status === "success" };
}
