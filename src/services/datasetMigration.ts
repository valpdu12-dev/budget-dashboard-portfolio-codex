import type { Config, Transaction, TransactionRole } from "@/types";
import type { ImportDataset } from "./workbookImport";
import { transactionRole } from "@/utils/businessRules";

/** Les champs historiques sont reconstruits pour les lecteurs v1 compatibles. */
export function materializeConfig(config: Config): Config {
  if (!config.accounts) return config;
  const oldAccounts = config.comptes ?? [];
  const loanId = config.loan?.account && (config.accounts.find(a => a.id === config.loan?.account)?.id
    ?? config.accounts[oldAccounts.indexOf(config.loan.account)]?.id);
  return { ...config, version: 2, balanceMode: "direct", perspective: config.perspective ?? "bank",
    comptes: config.accounts.map(a => a.label),
    init: Object.fromEntries(config.accounts.map(a => [a.label, a.initialBalance])),
    accountKinds: Object.fromEntries(config.accounts.map(a => [a.label, a.kind])),
    loan: config.loan ? { ...config.loan, account: loanId ?? config.loan.account } : undefined };
}

/** Reconstitue les liens des imports B, qui ne mémorisaient pas leur colonne Transfert. */
export function linkTransfers(transactions: Transaction[], roles?: Map<string, TransactionRole>): Transaction[] {
  const tx = transactions.map(t => ({ ...t }));
  const groups = new Map<string, Transaction[]>();
  for (const t of tx) {
    const role = roles?.get(t.typeId ?? "") ?? transactionRole(t);
    if (role !== "transfer" || t.transferId) continue;
    const key = `${t.date}|${t.montant.toFixed(2)}`;
    const group = groups.get(key) ?? []; group.push(t); groups.set(key, group);
  }
  let i = 0;
  const existing = new Set(tx.map(t => t.transferId).filter(Boolean));
  for (const group of groups.values()) {
    if (group.length === 2 && group[0].dc !== group[1].dc && group[0].compte !== group[1].compte) {
      let id = `migrated-transfer-${++i}`;
      while (existing.has(id)) id = `migrated-transfer-${++i}`;
      existing.add(id);
      group.forEach(t => { t.transferId = id; });
    }
  }
  return tx;
}

/** Une migration v1 conserve chaque montant, salaire, budget et borne de couverture. */
export function migrateDataset(dataset: ImportDataset): ImportDataset {
  if (dataset.schemaVersion === 2 && dataset.config.version === 2) return dataset;
  const accounts = dataset.config.accounts?.map(account => ({ ...account })) ?? (dataset.config.comptes ?? Object.keys(dataset.config.init)).map((label, i) => ({
    id: `account-${String(i + 1).padStart(3, "0")}`, label,
    initialBalance: dataset.config.init[label], kind: dataset.config.accountKinds?.[label] ?? "Courant", share: 100,
  }));
  const types = dataset.config.types?.map(type => ({ ...type })) ?? [...new Set(dataset.transactions.map(t => t.type))].map((label, i) => ({
    id: `type-${String(i + 1).padStart(3, "0")}`, label,
    role: transactionRole(dataset.transactions.find(t => t.type === label)!) === "transfer" && !dataset.config.transfers?.includes(label) ? "ordinary" as const : transactionRole(dataset.transactions.find(t => t.type === label)!),
  }));
  const config = materializeConfig({ ...dataset.config, accounts, types, version: 2, perspective: "bank" });
  const transactions = linkTransfers(dataset.transactions.map(t => ({ ...t,
    accountId: accounts.find(a => a.label === t.compte)!.id,
    typeId: types.find(p => p.label === t.type)!.id,
    role: types.find(p => p.label === t.type)!.role,
  })));
  return { ...dataset, schemaVersion: 2, config, transactions };
}
