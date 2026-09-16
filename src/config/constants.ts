// ── Constantes métier (alignées sur V1 helpers.js) ────────────────────────

export const MONTHS_FR = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juil.", "août", "sept.", "oct.", "nov.", "déc.",
] as const;

/** Types considérés comme des transferts internes (exclus par défaut) */
export const TRANSFER_TYPES = [
  "Transfert interne",
  "Transfert Horizon vers Équilibre",
  "Transfert Horizon vers Nova",
  "Épargne Horizon",
  "Retrait épargne",
] as const;

/** Types liés à l'épargne */
export const EPARGNE_TYPES = [
  "Crédit Immobilier",
  "Épargne Équilibre",
  "Épargne Horizon",
  "Épargne Nova",
  "Placement long terme",
  "Cagnotte",
] as const;

/** Comptes fictifs suivis dans la démonstration */
export const COMPTES_REELS = [
  "Banque Horizon - Courant",
  "Banque Nova - Compte joint",
  "Banque Équilibre - Compte joint",
  "Carte repas - Titres restaurant",
  "Banque Nova - Épargne",
] as const;

/** Liste des organismes bancaires */
export const ORGANISMES = [
  "Banque Horizon", "Banque Équilibre", "Banque Nova", "Carte repas", "Autre",
] as const;

/** Mapping comptes → organismes (pour la fonction toOrganisme) */
export const COMPTE_TO_ORGANISME: Record<string, string> = {
  "Banque Horizon - Courant": "Banque Horizon",
  "Banque Horizon - Dépenses partagées": "Banque Horizon",
  "Cagnotte commune": "Banque Horizon",
  "Retrait épargne": "Banque Horizon",
  "Banque Équilibre - Compte joint": "Banque Équilibre",
  "Banque Nova - Compte joint": "Banque Nova",
  "Banque Nova - Épargne": "Banque Nova",
  "Carte repas - Titres restaurant": "Carte repas",
};

/** Options de période pour le filtre global */
export const PERIOD_OPTIONS = [
  { value: "1M",  label: "1M" },
  { value: "3M",  label: "3M" },
  { value: "6M",  label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "12M", label: "12M" },
  { value: "all", label: "Tout" },
] as const;

/** Tabs de navigation (5 onglets — regroupement par type de flux) */
export const NAV_TABS = [
  { id: "comptes",    label: "Comptes",    icon: "BarChart3",    path: "/" },
  { id: "depenses",   label: "Dépenses",   icon: "TrendingDown", path: "/depenses" },
  { id: "revenus",    label: "Revenus",    icon: "TrendingUp",   path: "/revenus" },
  { id: "patrimoine", label: "Patrimoine", icon: "PiggyBank",    path: "/patrimoine" },
  { id: "insights",   label: "Insights",   icon: "Lightbulb",    path: "/insights" },
] as const;

/**
 * Sous-navigation contextuelle (pills) par onglet.
 * Clé = id de l'onglet ; valeur = liste de pills.
 * `end: true` sur la pill de la route par défaut (évite qu'elle reste
 * active sur les sous-routes).
 */
export const SUB_NAV_CONFIG = {
  depenses: [
    { label: "Dépenses", path: "/depenses",        end: true },
    { label: "Budget",   path: "/depenses/budget"            },
  ],
  revenus: [
    { label: "Recettes",    path: "/revenus",          end: true },
    { label: "Salaire",     path: "/revenus/salaire"             },
    { label: "vs Inflation", path: "/revenus/inflation"          },
  ],
  patrimoine: [
    { label: "Épargne",    path: "/patrimoine",      end: true },
    { label: "Prêt Immo.", path: "/patrimoine/pret"            },
  ],
} as const;
