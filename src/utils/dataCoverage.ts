import type { DataCoverage, Transaction } from "@/types";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY = /^\d{4}-\d{2}$/;

export function emptyDataCoverage(): DataCoverage {
  return {
    dateMin: null,
    dateMax: null,
    completeMonths: [],
    basis: "none",
  };
}

function isValidIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;

  return day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function nextMonth(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonthNumber = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonthNumber).padStart(2, "0")}`;
}

function lastDayOfMonth(monthKey: string): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}

function monthsBetween(firstMonth: string, lastMonth: string): string[] {
  if (!MONTH_KEY.test(firstMonth) || !MONTH_KEY.test(lastMonth) || firstMonth > lastMonth) {
    return [];
  }

  const months: string[] = [];
  for (let month = firstMonth; month <= lastMonth; month = nextMonth(month)) {
    months.push(month);
  }
  return months;
}

/**
 * Construit une couverture exacte à partir des bornes annoncées par la
 * source. Seuls les mois intégralement compris dans ces bornes sont retenus.
 */
export function declareDataCoverage(dateMin: string, dateMax: string): DataCoverage {
  if (!isValidIsoDate(dateMin) || !isValidIsoDate(dateMax) || dateMin > dateMax) {
    return emptyDataCoverage();
  }

  const completeMonths = monthsBetween(dateMin.slice(0, 7), dateMax.slice(0, 7))
    .filter((month) => dateMin <= `${month}-01` && dateMax >= lastDayOfMonth(month));

  return { dateMin, dateMax, completeMonths, basis: "declared" };
}

/**
 * Repli prudent quand le format d'entrée ne fournit pas encore ses bornes de
 * couverture. Les mois de bord sont exclus : les dates de leur première et
 * dernière transaction ne permettent pas de savoir si le relevé est complet.
 */
export function inferDataCoverage(transactions: Transaction[]): DataCoverage {
  const dates = transactions
    .map((transaction) => transaction.date)
    .filter(isValidIsoDate)
    .sort();

  if (dates.length === 0) return emptyDataCoverage();

  const dateMin = dates[0];
  const dateMax = dates[dates.length - 1];
  const allMonths = monthsBetween(dateMin.slice(0, 7), dateMax.slice(0, 7));
  const completeMonths = allMonths.length > 2 ? allMonths.slice(1, -1) : [];

  return { dateMin, dateMax, completeMonths, basis: "inferred" };
}
