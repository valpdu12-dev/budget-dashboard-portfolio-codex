# Contrat de provenance et de couverture des données

Ce document fixe les règles introduites à l'étape 0. Il évite de confondre « aucun mouvement », « données absentes » et « période incomplète ».

## Provenance

Chaque jeu chargé porte une origine :

| Valeur | Signification |
|---|---|
| `static` | Jeu de démonstration fictif livré avec l'application |
| `upload` | Classeur choisi par l'utilisateur |
| `unknown` | Fixture de test ou appel ancien qui ne fournit pas encore l'origine |

Cette origine décrit le jeu actuellement affiché. Après un import, la valeur devient `upload`, même si l'application avait chargé une autre source auparavant.

## Couverture temporelle

La couverture contient :

- `dateMin` et `dateMax`, les bornes connues de la source ;
- `completeMonths`, la liste des mois entièrement couverts ;
- `basis`, qui vaut `declared`, `inferred` ou `none`.

Une transaction datée du 15 janvier prouve qu'un mouvement existe le 15 janvier. Elle ne prouve pas que les 31 jours du mois ont été fournis. Le nombre de jours contenant une transaction n'est donc plus utilisé comme mesure de complétude.

### Couverture déclarée

Lorsque la source fournit des bornes de relevé, tous les mois entièrement compris entre ces bornes sont comparables. Par exemple, une couverture du 15 janvier au 10 avril confirme février et mars, mais pas janvier ni avril.

Le futur modèle Excel devra fournir ces bornes. Un mois complet contenant une seule transaction reste un mois complet ; un mois complet sans transaction représente correctement zéro dépense.

### Couverture inférée

Le format actuel ne fournit pas encore de bornes de relevé. Le repli transitoire prend la première et la dernière date de transaction et exclut les deux mois de bord. Seuls les mois strictement situés entre eux sont considérés comme complets.

Cette règle est volontairement prudente. Si aucun mois complet ne peut être confirmé, les moyennes, écarts, solde budgétaire et taux de conformité sont indisponibles. L'interface ne les remplace pas par zéro.

## Application aux budgets

Les dépenses mensuelles restent regroupées par catégorie. La moyenne utilise seulement l'intersection entre la période choisie et `completeMonths`.

- Budget défini et mois complet sans dépense : moyenne de 0 €, statut conforme.
- Budget défini sans mois complet connu : moyenne, écart et conformité indisponibles.
- Mois complet avec peu de mouvements : tous ses mouvements sont comptés.
- Mois de bord incomplet : visible dans l'évolution, exclu de la moyenne comparative.

## Limite transitoire

Le lot A formalise la provenance et la couverture, mais ne rend pas encore l'import entièrement autonome. Jusqu'au lot B, un import conserve certains paramètres neutres de la démonstration. Le lot B devra persister et restaurer transactions, configuration, objectifs et couverture comme un seul ensemble cohérent.
