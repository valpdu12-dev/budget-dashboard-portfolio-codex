# Recette de diffusion — lot D

Recette préparée le 16 septembre 2026 pour la version `budget-dashboard-portfolio-codex`.

## Périmètre

- construction reproductible depuis `package-lock.json` ;
- dépendances de production et de développement ;
- contrôle anti-fuite avant publication ;
- premier chargement sans stockage local ;
- navigation au clavier et format mobile ;
- erreurs de chargement et d'import ;
- configuration GitHub Actions et Cloudflare Pages ;
- documentation publique et limites du produit.

## Résultats automatisés

| Contrôle | Résultat |
|---|---|
| Génération des données fictives | 578 transactions et 24 mois de salaire, résultat déterministe |
| ESLint | réussi, zéro avertissement |
| TypeScript | réussi |
| Vitest | 503 tests dans 45 fichiers |
| Build Vite | réussi |
| Contrôle public | réussi, aucune fuite détectée |
| Audit npm | zéro vulnérabilité après mise à niveau |

Les versions corrigées incluent Vite 8, Vitest 5, React Router 7 et PostCSS 8. Le paquet `@vitest/ui`, inutilisé pour la recette, a été retiré. La configuration cible Node 22.16 avec `.nvmrc`.

## Résultats navigateur

- démarrage du build de production sur une origine neuve : données fictives chargées et navigation complète ;
- aucune erreur ni alerte dans la console au premier chargement ;
- écran mobile 390 × 844 : en-tête compact, filtres repliables, cartes à deux colonnes et barre de navigation basse utilisables ;
- parcours clavier : progression du focus dans l'en-tête et ouverture de Paramètres avec Entrée ;
- noms et rôles des champs Paramètres exposés à l'arbre d'accessibilité ;
- modale d'import ouvrable au clavier et texte de confidentialité présent ;
- erreur du chargement initial désormais explicite, avec détail et bouton Réessayer ;
- erreurs du lecteur Excel, validation et remise à zéro couvertes par les tests d'interface et du Web Worker.

## Préparation de la diffusion

- nom npm, GitHub et Cloudflare aligné sur `budget-dashboard-portfolio-codex` ;
- projet Claude `dashboard-budget-demo` identifié comme projet distinct ;
- workflow GitHub Actions unique et reproductible ;
- en-têtes CSP, anti-clicjacking, politique de permissions et cache Cloudflare dans `public/_headers` ;
- version Node épinglée ;
- guide de création du dépôt, connexion Pages, valeurs de build et recette après publication ;
- README mis à jour avec les limites publiques.

## Limites connues

- aucune donnée utilisateur n'est synchronisée ni sauvegardée à distance ;
- stockage local à l'origine du site, donc distinct entre URL de prévisualisation et URL de production ;
- import limité au modèle Budget v1 et à 50 Mo ;
- EUR, quote-part constante, un prêt constant ;
- export JSON sans réimport JSON ;
- polices Google chargées à l'exécution, avec repli système hors ligne ;
- `npm ci` signale encore des paquets de développement dépréciés issus d'ESLint 8 ; l'audit reste à zéro et ces paquets ne sont pas livrés au navigateur ;
- aucun score Lighthouse ou Core Web Vitals n'est revendiqué dans cette recette.

## Recette publique

Le dépôt GitHub et le projet Cloudflare Pages ont été créés le 16 septembre 2026. Le workflow GitHub Actions et le premier build Pages ont réussi. L'URL [budget-dashboard-portfolio-codex.pages.dev](https://budget-dashboard-portfolio-codex.pages.dev) répond en HTTP 200, affiche la démonstration fictive, conserve la route Revenus après actualisation et ne produit aucune erreur ou alerte de console. Les en-têtes de sécurité prévus sont actifs.
