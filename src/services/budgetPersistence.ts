import type { BudgetData, BudgetTarget } from "@/types";

const STORAGE_KEY = "budget-demo.budgets.v1";

function isBudgetTarget(value: unknown): value is BudgetTarget {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<BudgetTarget>;
  return typeof row.cat2 === "string"
    && (row.target === null || (typeof row.target === "number" && Number.isFinite(row.target) && row.target >= 0))
    && typeof row.active === "boolean";
}

export function loadLocalBudgets(defaults: BudgetData): BudgetData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<BudgetData>;
    if (!Array.isArray(parsed.budgets) || !parsed.budgets.every(isBudgetTarget) || (parsed.personalBudgets !== undefined && (!Array.isArray(parsed.personalBudgets) || !parsed.personalBudgets.every(isBudgetTarget)))) {
      return defaults;
    }
    return { budgets: parsed.budgets, ...(parsed.personalBudgets ? { personalBudgets: parsed.personalBudgets } : {}) };
  } catch {
    return defaults;
  }
}

export function saveLocalBudgets(budgets: BudgetData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(budgets));
    return true;
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* inaccessible */ }
    return false;
  }
}

export function clearLocalBudgets(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
