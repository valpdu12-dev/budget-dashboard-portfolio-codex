# Mon Budget — démonstration

Dashboard React de suivi budgétaire conçu comme une démonstration de portfolio. Le projet fonctionne sans compte Cloud, sans base distante et sans secret : son jeu initial est entièrement fictif et livré dans `public/data/`.

Cette version se publie sous le nom **`budget-dashboard-portfolio-codex`** sur GitHub et Cloudflare Pages. Le projet parallèle `dashboard-budget-demo` reste distinct et ne doit pas être remplacé.

## Lancer la démonstration

Prérequis : Node.js 22.16 ou une version plus récente, avec npm. La version attendue est inscrite dans `.nvmrc`.

```bash
cd budget-dashboard-portfolio-codex
npm ci
npm run dev
```

Vite affiche l'adresse locale, généralement `http://localhost:5173`. Ouvrez-la dans un navigateur. Les routes utilisent un fragment (`#/depenses`, par exemple), ce qui permet de recharger une page précise sur un hébergement statique.

Pour essayer exactement le build destiné à la publication :

```bash
npm run build
npm run preview
```

L'adresse de prévisualisation est généralement `http://localhost:4173`.

## Ce que contient la démo

- 578 transactions fictives couvrant 24 mois complets ;
- cinq comptes aux noms neutres et des soldes initiaux fictifs ;
- 24 mois de salaires fictifs pour deux employeurs inventés ;
- un prêt immobilier fictif avec historique et projection ;
- dix budgets mensuels modifiables ;
- les neuf vues d’analyse du dashboard et une page Paramètres : comptes, dépenses, budget, recettes, salaire, inflation, épargne, prêt et insights.

Un bandeau visible rappelle l'origine fictive des données. Les paramètres et budgets modifiés sont stockés dans `localStorage` et ne quittent jamais le navigateur.

Les rubriques facultatives suivent les données chargées : sans salaire, les liens Salaire et Inflation disparaissent ; sans paramètres et mouvements de prêt exploitables, le lien Prêt immobilier disparaît. Sans compte de nature Épargne, Épargne disparaît aussi ; sans épargne ni prêt, Patrimoine est masqué sur ordinateur et mobile. Les routes indisponibles sont redirigées. La disponibilité dépend du jeu complet, pas du filtre de période.

## Régénérer les données fictives

Le générateur est déterministe : deux exécutions produisent le même scénario.

```bash
npm run data:demo
```

Il recrée `transactions.json`, `salary.json`, `config.json` et `budgets.json` dans `public/data/`.

## Vérifier la copie publique

```bash
npm run check
```

Cette commande régénère le scénario, exécute le lint, le contrôle TypeScript, les tests, le build et le contrôle de publication. Ce dernier refuse notamment les fichiers de base de données ou les tableurs non autorisés, les routes privées, les jetons, les IBAN potentiels et les termes de la liste locale `plan/DENYLIST_LOT_A.txt` lorsqu'elle est présente.

L'audit de dépendances se lance séparément :

```bash
npm audit --audit-level=high
```

## Publier la version Codex

La démonstration est publiée sur [Cloudflare Pages](https://budget-dashboard-portfolio-codex.pages.dev). Le guide [GitHub puis Cloudflare Pages](docs/DEPLOIEMENT_GITHUB_CLOUDFLARE.md) documente chaque action et les valeurs utilisées. Configuration active :

| Plateforme | Nom réservé à cette version |
|---|---|
| GitHub | `valpdu12-dev/budget-dashboard-portfolio-codex` |
| Cloudflare Pages | `budget-dashboard-portfolio-codex` |
| Démo publique | [budget-dashboard-portfolio-codex.pages.dev](https://budget-dashboard-portfolio-codex.pages.dev) |

Le build Cloudflare utilise `npm run build`, publie `dist` et lit Node dans `.nvmrc`. Aucun secret ni variable métier n'est requis.

## Import de données utilisateur

Le modèle [Budget v1](public/modeles/Budget_v1.xlsx) est téléchargeable depuis **Importer .xlsx**. Il fournit des comptes, transactions, salaires, budgets et un prêt fictifs pour essayer l'import. Remplacez les exemples par vos données. Les noms de comptes sont libres, leurs soldes de départ sont explicites, les virements internes sont rapprochés et les montants incorrects bloquent l'application.

Salaires, Budgets et Prêt sont facultatifs. Transactions peut couvrir plusieurs années. Le paquet importé remplace entièrement la démo et est mémorisé localement, y compris ses budgets modifiés. Un bouton permet de l'effacer et de revenir à la démo. Le lecteur utilise SheetJS CE 0.20.3 fourni depuis sa distribution officielle et inclus dans le build, sans chargement distant à l'exécution.

Voir le [guide d'import](docs/IMPORT_EXCEL_V1.md). Les exports bancaires doivent être adaptés au modèle public. L'ancien classeur Budget avec les onglets `Fiche de Paie` et `Transactions AAAA` est toutefois reconnu automatiquement, y compris lorsque ses colonnes calculées contiennent des formules. Les identifiants stables, noms personnalisables, rôles de types et quotes-parts sont disponibles dans **Paramètres**. La vue bancaire et la vue personnelle ont des objectifs budgétaires distincts. Voir le [guide de test du lot C](docs/PARAMETRES_ET_RECETTE_LOT_C.md), également accessible depuis l’application.

## Limites publiques

- application statique, sans compte utilisateur, synchronisation entre appareils ni sauvegarde distante ;
- données importées et paramètres mémorisés dans le navigateur actuel ; le classeur source reste la sauvegarde de référence ;
- format EUR, quote-part constante et un seul prêt à mensualité constante ;
- import depuis le modèle Budget v1, sans correspondance automatique d'un export bancaire ;
- export JSON disponible pour contrôle, sans parcours de réimport JSON ;
- polices chargées depuis Google Fonts ; aucune donnée budgétaire n'est envoyée avec cette requête.

## Architecture utile

| Dossier | Rôle |
|---|---|
| `src/` | Pages, composants, hooks, stores et règles du dashboard |
| `public/data/` | Jeu fictif chargé au démarrage |
| `scripts/generate-demo-data.mjs` | Générateur déterministe du scénario |
| `scripts/check-public.mjs` | Contrôle anti-fuite avant publication |
| `docs/` | Contrats et documentation technique |
| `plan/` | Plans et comptes rendus locaux, ignorés par Git |
