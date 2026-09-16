import { TRANSFER_TYPES } from "@/config/constants";
import type { Config, Perspective, Transaction, TransactionRole } from "@/types";

export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
/** Le repli par nom sert uniquement aux jeux antérieurs à la migration. */
export function transactionRole(t: Transaction): TransactionRole {
  if (t.role) return t.role;
  if ((TRANSFER_TYPES as readonly string[]).includes(t.type)) return "transfer";
  if (t.type === "Crédit Immobilier") return "loan-capital";
  if (t.type === "Intérêt du prêt") return "loan-interest";
  return "ordinary";
}
export const isTransfer = (t: Transaction) => transactionRole(t) === "transfer";
export const typeKey = (t: Transaction) => t.typeId ?? t.type;
export const matchesType = (t: Transaction, key: string) => typeKey(t) === key || (!t.typeId && t.type === key);
export function typeLabel(config: Config | null, id: string): string {
  return config?.types?.find(t => t.id === id)?.label ?? id;
}
export function accountLabel(config: Config | null, id: string): string {
  return config?.accounts?.find(a => a.id === id)?.label ?? id;
}

/** Projection pure : elle repart toujours des montants bancaires stockés. */
export function projectTransactions(transactions: Transaction[], config: Config | null, perspective: Perspective = config?.perspective ?? "bank"): Transaction[] {
  if (!config?.accounts || !config.types) return transactions;
  const accounts = new Map(config.accounts.map(a => [a.id, a]));
  const types = new Map(config.types.map(t => [t.id, t]));
  return transactions.map(t => {
    const account = accounts.get(t.accountId ?? "");
    const type = types.get(t.typeId ?? "");
    const bankAmount = t.bankAmount ?? t.montant;
    return { ...t, compte: account?.label ?? t.compte, type: type?.label ?? t.type,
      role: type?.role ?? transactionRole(t), bankAmount,
      montant: perspective === "personal" ? cents(bankAmount * (account?.share ?? 100) / 100) : bankAmount };
  });
}
export function projectedInitialBalances(config: Config | null): Record<string, number> {
  if (!config?.accounts) return config?.init ?? {};
  return Object.fromEntries(config.accounts.map(a => [a.label,
    cents(a.initialBalance * (config.perspective === "personal" ? a.share / 100 : 1))]));
}
