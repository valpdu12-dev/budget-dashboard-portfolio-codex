/** Taux mensuel d'un prêt à mensualité constante, hors assurance. */
export function solveMonthlyRate(p: number, payment: number, n: number): number {
  if (p <= 0 || n <= 0 || payment * n <= p) return 0;
  let lo = 1e-9, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const pay = (p * mid) / (1 - Math.pow(1 + mid, -n));
    if (pay > payment) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
export function loanSchedule(principal: number, payment: number, terms: number) {
  const rate = solveMonthlyRate(principal, payment, terms);
  const rows: { interet: number; capital: number; solde: number }[] = [];
  let balance = principal;
  for (let k = 0; k < terms; k++) {
    const interet = balance * rate, capital = payment - interet;
    balance = Math.max(0, balance - capital);
    rows.push({ interet, capital, solde: balance });
  }
  return rows;
}
/** Retrouve l'échéance sans amplifier l'arrondi au centime des intérêts. */
export function closestLoanTerm(schedule: ReturnType<typeof loanSchedule>, interest: number): number {
  return schedule.reduce((best, p, i) => Math.abs(p.interet - interest) < Math.abs(schedule[best].interet - interest) ? i : best, 0);
}
