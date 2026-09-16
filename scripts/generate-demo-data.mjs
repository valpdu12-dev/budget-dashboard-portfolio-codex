import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "public", "data");

const PRIMARY = "Banque Horizon - Courant";
const JOINT = "Banque Nova - Compte joint";
const HOME = "Banque Équilibre - Compte joint";
const MEAL = "Carte repas - Titres restaurant";
const SAVINGS = "Banque Nova - Épargne";
const LOAN_PAYMENT = 932.19;
const LOAN_MONTHLY_RATE = 0.022515621353081917 / 12;
let loanBalance = 180000;

const transactions = [];

function round(value) {
  return Math.round(value * 100) / 100;
}

function wave(monthIndex, salt, amplitude) {
  return Math.round(Math.sin((monthIndex + salt) * 1.71) * amplitude);
}

function add(monthKey, day, account, type, amount, cat1, cat2, cat3, dc, label, city = "") {
  transactions.push({
    compte: account,
    type,
    date: `${monthKey}-${String(day).padStart(2, "0")}`,
    montant: round(Math.abs(amount)),
    cat1,
    cat2,
    cat3,
    cat4: "",
    ville: city,
    dc,
    label,
  });
}

const salaryMonths = [];

for (let index = 0; index < 24; index += 1) {
  const year = 2024 + Math.floor(index / 12);
  const month = (index % 12) + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const employer = index < 18 ? "Atelier Alpha" : "Studio Boréal";
  const net = index < 12 ? 2720 + Math.floor(index / 6) * 35 : 2810 + Math.floor((index - 12) / 6) * 45;
  const gross = Math.round(net / 0.78);
  const cotSal = gross - net;

  salaryMonths.push({
    mk: monthKey,
    entreprise: employer,
    brut: gross,
    net,
    cotSal,
    indem: month === 6 || month === 12 ? 120 : 45,
    retenues: month === 8 ? 25 : 0,
  });

  add(monthKey, 27, PRIMARY, "Salaire", net, "Salaire", "Revenus professionnels", employer, "Crédit", `Salaire ${employer}`);
  if (index % 2 === 0) {
    add(monthKey, 20, PRIMARY, "Virement extérieur", 95 + wave(index, 2, 15), "Salaire", "Revenus complémentaires", "Mission ponctuelle", "Crédit", "Mission créative");
  }

  add(monthKey, 2, PRIMARY, "Transfert Horizon vers Équilibre", 1000, "", "", "", "Débit", "Versement compte logement");
  add(monthKey, 2, HOME, "Transfert Horizon vers Équilibre", 1000, "", "", "", "Crédit", "Versement compte logement");
  const loanInterest = loanBalance * LOAN_MONTHLY_RATE;
  const loanCapital = LOAN_PAYMENT - loanInterest;
  loanBalance -= loanCapital;
  add(monthKey, 5, HOME, "Crédit Immobilier", loanCapital, "Dépense Fixe", "Immobilier", "Capital du prêt", "Débit", "Échéance logement");
  add(monthKey, 5, HOME, "Intérêt du prêt", loanInterest, "Dépense Fixe", "Immobilier", "Intérêts", "Débit", "Intérêts logement");

  add(monthKey, 3, PRIMARY, "Transfert Horizon vers Nova", 520, "", "", "", "Débit", "Budget dépenses communes");
  add(monthKey, 3, JOINT, "Transfert Horizon vers Nova", 520, "", "", "", "Crédit", "Budget dépenses communes");
  add(monthKey, 8, JOINT, "Prélèvement", 86 + wave(index, 1, 7), "Dépense Fixe", "Assurances", "Habitation et auto", "Débit", "Assurances du foyer");
  add(monthKey, 12, JOINT, "Prélèvement", 98 + wave(index, 3, 14), "Dépense Fixe", "Logement", "Énergie", "Débit", "Énergie du foyer");
  add(monthKey, 18, JOINT, "CB", 145 + wave(index, 4, 18), "Dépense Courante", "Alimentation", "Courses", "Débit", "Courses hebdomadaires", "Lyon");

  add(monthKey, 4, PRIMARY, "Prélèvement", 42, "Dépense Fixe", "Télécommunications", "Internet et mobile", "Débit", "Forfait télécom");
  add(monthKey, 7, PRIMARY, "CB", 64 + wave(index, 5, 13), "Dépense Courante", "Transport", "Déplacements", "Débit", "Mobilité", "Lyon");
  add(monthKey, 10, PRIMARY, "Prélèvement", 118, "Dépense Fixe", "Impots", "Prélèvement mensuel", "Débit", "Impôt mensualisé");
  add(monthKey, 14, PRIMARY, "CB", 72 + wave(index, 6, 16), "Dépense Courante", "Alimentation", "Courses", "Débit", "Marché et supermarché", "Lyon");
  add(monthKey, 17, PRIMARY, "CB", 48 + wave(index, 7, 12), "Dépense Occasionnelle", "Loisir", "Sorties", "Débit", "Culture et sorties", "Lyon");
  add(monthKey, 22, PRIMARY, "CB", 52 + wave(index, 8, 11), "Dépense Courante", "Alimentation", "Restaurant", "Débit", "Restaurant", "Lyon");
  if (month % 3 === 0) {
    add(monthKey, 16, PRIMARY, "CB", 84 + wave(index, 9, 20), "Dépense Occasionnelle", "Habillement", "Vêtements", "Débit", "Achat saisonnier", "Lyon");
  }
  if (month % 4 === 0) {
    add(monthKey, 19, PRIMARY, "CB", 63 + wave(index, 10, 8), "Dépense Occasionnelle", "Santé", "Soins", "Débit", "Consultation santé", "Lyon");
  }
  add(monthKey, 24, PRIMARY, "Épargne Horizon", 250 + (index >= 12 ? 25 : 0), "", "", "", "Débit", "Versement épargne");
  add(monthKey, 24, SAVINGS, "Épargne Horizon", 250 + (index >= 12 ? 25 : 0), "", "", "", "Crédit", "Versement épargne");

  add(monthKey, 1, MEAL, "Virement extérieur", 165, "", "", "", "Crédit", "Chargement carte repas");
  add(monthKey, 6, MEAL, "CB", 31 + wave(index, 11, 4), "Dépense Courante", "Alimentation", "Déjeuner", "Débit", "Déjeuners semaine 1", "Lyon");
  add(monthKey, 13, MEAL, "CB", 34 + wave(index, 12, 4), "Dépense Courante", "Alimentation", "Déjeuner", "Débit", "Déjeuners semaine 2", "Lyon");
  add(monthKey, 20, MEAL, "CB", 33 + wave(index, 13, 4), "Dépense Courante", "Alimentation", "Déjeuner", "Débit", "Déjeuners semaine 3", "Lyon");
  add(monthKey, 26, MEAL, "CB", 30 + wave(index, 14, 4), "Dépense Courante", "Alimentation", "Déjeuner", "Débit", "Déjeuners semaine 4", "Lyon");
}

const fields = ["compte", "type", "date", "montant", "cat1", "cat2", "cat3", "cat4", "ville", "dc", "label"];
const stringTable = [];
const stringIndexes = new Map();

function encodeString(value) {
  if (value === "") return -1;
  if (!stringIndexes.has(value)) {
    stringIndexes.set(value, stringTable.length);
    stringTable.push(value);
  }
  return stringIndexes.get(value);
}

const encodedTransactions = transactions
  .sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
  .map((transaction) => [
    encodeString(transaction.compte),
    encodeString(transaction.type),
    transaction.date,
    transaction.montant,
    encodeString(transaction.cat1),
    encodeString(transaction.cat2),
    encodeString(transaction.cat3),
    encodeString(transaction.cat4),
    encodeString(transaction.ville),
    encodeString(transaction.dc),
    encodeString(transaction.label),
  ]);

const salary = {
  months: salaryMonths,
  cotLast: [["Retraite", 375], ["Santé", 115], ["Autres cotisations", 315]],
  patronLast: [["Retraite", 520], ["Santé", 205], ["Autres contributions", 460]],
  lastMonth: "2025-12",
  inflation: [
    { year: "2024", rate_annual: 2.0, rate_alimentation: 1.4, rate_services: 2.7, rate_energie: -0.8, rate_transports: 2.1, rate_produits_manufactures: -0.2 },
    { year: "2025", rate_annual: 1.0, rate_alimentation: 1.3, rate_services: 2.2, rate_energie: -2.5, rate_transports: 1.1, rate_produits_manufactures: -0.4 },
  ],
  smic: [
    { year: "2024", net_monthly: 1398.69, date_effective: "01/01/2024" },
    { year: "2025", net_monthly: 1426.3, date_effective: "01/01/2025" },
  ],
  inflationByCategory: [
    { year: "2024", rate_annual: 2.0, rate_alimentation: 1.4, rate_services: 2.7, rate_energie: -0.8, rate_transports: 2.1, rate_produits_manufactures: -0.2 },
    { year: "2025", rate_annual: 1.0, rate_alimentation: 1.3, rate_services: 2.2, rate_energie: -2.5, rate_transports: 1.1, rate_produits_manufactures: -0.4 },
  ],
};

const config = {
  balanceMode: "direct",
  accountKinds: { [PRIMARY]: "Courant", [JOINT]: "Courant", [HOME]: "Courant", [MEAL]: "Courant", [SAVINGS]: "Épargne" },
  loan: { account: "Banque Équilibre - Compte joint", principal: 180000, payment: 932.19, terms: 240 },
  init: {
    [PRIMARY]: 4200,
    [JOINT]: 2300,
    [HOME]: 3500,
    [MEAL]: 80,
    [SAVINGS]: 8500,
  },
  transfers: ["Transfert Horizon vers Équilibre", "Transfert Horizon vers Nova", "Épargne Horizon", "Retrait épargne"],
  comptes: [PRIMARY, JOINT, HOME, MEAL, SAVINGS],
  coverage: { dateMin: "2024-01-01", dateMax: "2025-12-31" },
  colors: {
    comptes: {
      [PRIMARY]: "#2563eb",
      [JOINT]: "#059669",
      [HOME]: "#d97706",
      [MEAL]: "#dc2626",
      [SAVINGS]: "#0891b2",
    },
    entreprises: { "Atelier Alpha": "#8b5cf6", "Studio Boréal": "#22c55e" },
  },
};

const budgets = {
  budgets: [
    ["Alimentation", 430],
    ["Assurances", 95],
    ["Habillement", 45],
    ["Immobilier", 935],
    ["Impots", 120],
    ["Logement", 110],
    ["Loisir", 55],
    ["Santé", 30],
    ["Télécommunications", 45],
    ["Transport", 80],
  ].map(([cat2, target]) => ({ cat2, target, active: true, updated_at: null })),
};

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(path.join(outputDirectory, "transactions.json"), `${JSON.stringify({ fields, s: stringTable, t: encodedTransactions }, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "salary.json"), `${JSON.stringify(salary, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "config.json"), `${JSON.stringify(config, null, 2)}\n`),
  writeFile(path.join(outputDirectory, "budgets.json"), `${JSON.stringify(budgets, null, 2)}\n`),
]);

console.log(`Données de démonstration générées : ${transactions.length} transactions, ${salaryMonths.length} mois de salaire.`);
