import { useMemo } from "react";
import { useDataStore } from "@/stores/useDataStore";
import { projectTransactions } from "@/utils/businessRules";
import type { Perspective } from "@/types";

export function useDashboardTransactions(perspective?: Perspective) {
  const { transactions, config } = useDataStore();
  return useMemo(() => projectTransactions(transactions, config, perspective), [transactions, config, perspective]);
}
