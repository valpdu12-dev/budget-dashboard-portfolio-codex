// ── Types principaux du dashboard de démonstration ──────────────────────

/** Transaction décodée (après decodeTransactions) */
export interface Transaction {
  accountId?: string;
  typeId?: string;
  transferId?: string;
  /** Rôle résolu depuis le catalogue, jamais déduit du libellé après migration. */
  role?: TransactionRole;
  /**
   * Exception de compatibilité pour les anciens classeurs : un mouvement peut
   * équilibrer un transfert tout en restant une dépense dans les KPI (ou
   * inversement pour sa contrepartie technique).
   */
  kpiRole?: TransactionRole;
  /** Présent uniquement dans une projection d'affichage ; montant reste brut au stockage. */
  bankAmount?: number;
  compte: string;         // "Banque Horizon - Courant", "Banque Nova - Compte joint", etc.
  type: string;           // "CB", "Virement", "Prélèvement", etc.
  date: string;           // "2025-01-15"
  montant: number;        // Montant bancaire ; signé uniquement pour un ancien classeur compatible
  cat1: string;           // "Dépense Fixe", "Dépense Courante", "Dépense Occasionnelle"
  cat2: string;           // Sous-catégorie niveau 2 (ou "")
  cat3: string;           // Libellé détaillé / niveau 3 (ou "")
  cat4: string;           // Niveau 4 (ou "")
  ville: string;          // Ville (ou "")
  dc: string;             // "Débit" | "Crédit"
  label: string;          // Libellé bancaire brut (ou "")
  monthKey: string;       // Dérivé de date : "2025-01"
}

export type TransactionRole = "ordinary" | "transfer" | "loan-capital" | "loan-interest";
export interface AccountDefinition {
  id: string;
  label: string;
  kind: "Courant" | "Épargne";
  initialBalance: number;
  /** Pourcentage personnel de 0 à 100, appliqué une seule fois. */
  share: number;
  /** Faux pour un compte technique nécessaire aux transferts mais absent des soldes affichés. */
  includeInBalance?: boolean;
}
export interface TypeDefinition { id: string; label: string; role: TransactionRole }
export type Perspective = "bank" | "personal";

/** Données JSON brutes (encodage dictionnaire) */
export interface RawTransactionsJSON {
  s: string[];                    // String table
  t: (number | string)[][];       // Transactions encodées (mix indices + valeurs directes)
  fields?: string[];              // Noms des champs (optionnel)
}

/** Mois de salaire (format JSON réel) */
export interface SalaryMonth {
  mk: string;             // "2025-01"
  entreprise: string;
  brut: number;
  net: number;
  cotSal: number;         // Cotisations salariales
  indem: number;          // Indemnités
  retenues: number;
}

/** Donnée inflation INSEE pour une année */
export interface InflationData {
  year: string;                          // "2024"
  rate_annual: number | null;            // Taux global (%)
  rate_alimentation: number | null;      // Renseigné uniquement 2024-2025
  rate_services: number | null;
  rate_energie: number | null;
  rate_transports: number | null;
  rate_produits_manufactures: number | null;
}

/** Donnée SMIC net mensuel pour une année */
export interface SmicData {
  year: string;                          // "2024"
  net_monthly: number | null;
  date_effective: string | null;         // "01/01/2024"
}

/** Budget cible pour une sous-catégorie (cat2) */
export interface BudgetTarget {
  cat2: string;
  target: number | null;
  active: boolean;
  updated_at: string | null;
}

/** Ensemble des budgets cibles */
export interface BudgetData {
  budgets: BudgetTarget[];
  personalBudgets?: BudgetTarget[];
}

/** Données salaire complètes */
export interface SalaryData {
  months: SalaryMonth[];
  cotLast: [string, number][];      // Tuples [label, montant]
  patronLast: [string, number][];   // Tuples [label, montant]
  lastMonth?: string;               // Dernier mois disponible
  inflation?: InflationData[];          // Historique inflation 2013-2025
  smic?: SmicData[];                    // Historique SMIC 2013-2026
  inflationByCategory?: InflationData[]; // Détail sectoriel (2024-2025 uniquement)
}

/** Configuration initiale (soldes de départ + métadonnées) */
export interface Config {
  version?: 2;
  accounts?: AccountDefinition[];
  types?: TypeDefinition[];
  perspective?: Perspective;
  /** Reproduit les règles de calcul du dashboard historique pour son classeur natif. */
  compatibility?: "legacy-dashboard-v1";
  init: Record<string, number>;
  /** Chaque mouvement affecte exclusivement le compte déclaré dans l'import. */
  balanceMode?: "direct";
  accountKinds?: Record<string, "Courant" | "Épargne">;
  loan?: { account?: string; principal: number; payment: number; terms: number };
  transfers?: string[];
  comptes?: string[];
  primaryLinkedAccounts?: string[];
  /** Bornes exactes couvertes par le jeu de données livré avec la démo. */
  coverage?: {
    dateMin: string;
    dateMax: string;
  };
  colors?: {
    cat2?: Record<string, string>;
    comptes?: Record<string, string>;
    entreprises?: Record<string, string>;
  };
}

/** Provenance du jeu de données actuellement affiché. */
export type DataOrigin = "static" | "upload" | "unknown";

/**
 * Période réellement comparable pour les indicateurs mensuels.
 *
 * Une transaction prouve qu'un mouvement existe à une date donnée ; elle ne
 * prouve pas, à elle seule, que le relevé couvre tout le mois. Les mois
 * complets sont donc déclarés par la source ou inférés prudemment entre les
 * deux mois de bord du jeu de données.
 */
export interface DataCoverage {
  dateMin: string | null;
  dateMax: string | null;
  completeMonths: string[];
  basis: "declared" | "inferred" | "none";
}

/** KPIs calculés */
export interface KPIs {
  curBal: Record<string, number>;
  prevBal: Record<string, number>;
  depCur: number;
  depPrev: number;
  recCur: number;
  recPrev: number;
  netMonth: number;
  lastSal: SalaryMonth | null;
  prevSal: SalaryMonth | null;
  fixe: number;
  occ: number;
  tauxEpargne: number;
}

/** Insight (hausse/baisse) */
export interface Insight {
  cat: string;
  cur: number;
  prev: number;
  diff: number;
  pct: number;
}

/** Récurrent détecté */
export interface Recurring {
  name: string;
  montant: number;
  freq: string;
  last: string;
}

/** Organisme bancaire */
export type Organisme = "Banque Horizon" | "Banque Équilibre" | "Banque Nova" | "Carte repas" | "Autre";

/** Période de filtre */
export type PeriodKey = "1M" | "3M" | "6M" | "YTD" | "12M" | "all";

/** Catégorie niveau 1 */
export type Cat1Filter = "all" | "Dépense Fixe" | "Dépense Occasionnelle" | "Dépense Courante";
