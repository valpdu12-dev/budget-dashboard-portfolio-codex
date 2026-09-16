# Déployer la version Codex sur GitHub et Cloudflare Pages

Guide vérifié le 16 septembre 2026. Il concerne uniquement la copie Codex du dashboard.

## Noms à respecter

| Usage | Projet Claude existant — ne pas modifier | Projet Codex à créer |
|---|---|---|
| GitHub | `valpdu12-dev/dashboard-budget-demo` | `valpdu12-dev/budget-dashboard-portfolio-codex` |
| Cloudflare Pages | `dashboard-budget-demo` | `budget-dashboard-portfolio-codex` |
| Domaine Pages | domaine actuel du projet Claude | `budget-dashboard-portfolio-codex.pages.dev` attendu |

Ne pas connecter le nouveau dépôt au projet Cloudflare `dashboard-budget-demo`. Le nom Codex reste identique sur les deux plateformes pour faciliter le diagnostic.

## Étape 1 — Vérifier la copie locale

Depuis la racine de la copie ChatGpt :

```bash
cd "/chemin/vers/le-projet"
node --version
npm ci
npm run check
npm audit --audit-level=high
```

Résultat attendu : Node 22.16 ou plus récent, tests réussis, build `dist` créé, contrôle public accepté et aucune vulnérabilité élevée ou critique.

## Étape 2 — Créer l'historique Git local

Le dossier de pilotage `plan/`, `node_modules/`, `dist/`, les fichiers d'environnement et les classeurs locaux sont exclus par `.gitignore`.

```bash
git init -b main
git add .
git status --short
git commit -m "Prepare dashboard budget Codex demo"
```

Avant le commit, parcourir `git status --short`. Aucun fichier `.env`, `.sql`, classeur personnel ou dossier `plan/` ne doit apparaître.

## Étape 3 — Créer le dépôt GitHub

1. Ouvrir <https://github.com/new>.
2. Choisir le propriétaire **`valpdu12-dev`**.
3. Saisir **`budget-dashboard-portfolio-codex`** comme nom.
4. Description conseillée : **Dashboard budgétaire React avec démo fictive et import Excel local**.
5. Choisir **Public** pour un portfolio de recrutement.
6. Ne pas ajouter de README, de `.gitignore` ou de licence depuis GitHub : ils existent déjà localement.
7. Créer le dépôt.
8. Relier et pousser la copie locale :

```bash
git remote add origin https://github.com/valpdu12-dev/budget-dashboard-portfolio-codex.git
git remote -v
git push -u origin main
```

Alternative avec GitHub CLI, après `git commit` :

```bash
gh repo create valpdu12-dev/budget-dashboard-portfolio-codex --public --source=. --remote=origin --push
```

Vérifier ensuite l'onglet **Actions**. Le workflow **Vérification** doit exécuter installation depuis le lockfile, lint, types,  tests, build, contrôle public et audit npm.

## Étape 4 — Créer un nouveau projet Cloudflare Pages

1. Dans Cloudflare, ouvrir **Workers & Pages** puis créer une application Pages avec **Connect to Git**.
2. Choisir GitHub et autoriser l'accès au dépôt `budget-dashboard-portfolio-codex` si Cloudflare ne le voit pas encore.
3. Sélectionner le dépôt **`valpdu12-dev/budget-dashboard-portfolio-codex`**.
4. Saisir **`budget-dashboard-portfolio-codex`** comme nom du projet Pages.
5. Régler la branche de production sur **`main`**.
6. Renseigner la construction :

| Champ Cloudflare | Valeur |
|---|---|
| Framework preset | Vite, ou aucun preset avec les valeurs ci-dessous |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | vide, racine du dépôt |
| Variables d'environnement | aucune |

La version Node est fixée à `22.16.0` par `.nvmrc`. Ne pas sélectionner ni renommer `dashboard-budget-demo`.

7. Lancer le premier déploiement.
8. Attendre l'état **Success**, puis ouvrir l'URL `https://budget-dashboard-portfolio-codex.pages.dev`.

Cloudflare crée ensuite un déploiement de production à chaque push sur `main`, et des URL de prévisualisation pour les autres branches et les pull requests.

## Étape 5 — Recette après publication

Effectuer ces contrôles dans une fenêtre privée :

1. La page Comptes s'affiche avec le bandeau **Mode démonstration**.
2. Comptes, Dépenses, Revenus, Patrimoine et Insights s'ouvrent, puis une page précise reste disponible après actualisation.
3. Le modèle Budget v1 se télécharge depuis **Importer .xlsx**.
4. Un import sans salaire masque Salaire et Inflation.
5. Un import sans prêt masque Prêt immobilier.
6. Les réglages restent présents après actualisation, puis l'effacement revient à la démo.
7. Sur un écran étroit, la navigation du bas et le bouton de filtres restent utilisables.
8. Une navigation au clavier atteint Paramètres, Importer, les filtres et les actions des formulaires.
9. En cas de fichier invalide, la modale affiche l'erreur et permet d'annuler ou de choisir un autre fichier.
10. En cas d'échec de chargement des fichiers de démo, l'écran propose **Réessayer**.

Les en-têtes de sécurité sont fournis par `public/_headers`. Les ressources portant une empreinte sont mises en cache un an ; les données de démo, le manifeste et le service worker sont revalidés.

## Étape 6 — Contrôler l'isolation avec le projet Claude

- dépôt GitHub Codex : `budget-dashboard-portfolio-codex` ;
- projet Cloudflare Codex : `budget-dashboard-portfolio-codex` ;
- aucune modification ni nouvelle liaison Git dans `dashboard-budget-demo` ;
- URL Pages Codex ouverte avant de partager le lien avec un recruteur.

En cas de doute dans Cloudflare, revenir à **Workers & Pages** et vérifier le nom du projet avant toute modification.

## Mise à jour et retour arrière

Pour publier une correction :

```bash
git add .
git commit -m "Describe the correction"
git push
```

Cloudflare construit le nouveau commit. En cas de problème, ouvrir les déploiements du projet `budget-dashboard-portfolio-codex`, contrôler les journaux, puis restaurer le code par un nouveau commit Git. Le projet Claude n'intervient jamais dans cette procédure.

Références officielles : [ajouter un code local sur GitHub](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github), [intégration Git de Cloudflare Pages](https://developers.cloudflare.com/pages/get-started/git-integration/), [configuration de build Pages](https://developers.cloudflare.com/pages/configuration/build-configuration/) et [en-têtes Pages](https://developers.cloudflare.com/pages/configuration/headers/).
