# Importer ses données avec le modèle Budget v1

Le modèle `public/modeles/Budget_v1.xlsx` contient uniquement des exemples fictifs, sur janvier et février 2025. Il est téléchargeable depuis le bouton **Importer .xlsx**. Remplacez les exemples avant d'utiliser vos données.

## Parcours

1. Téléchargez le modèle et lisez l'onglet Notice.
2. Dans Paramètres, gardez Version = 1 et indiquez la première et la dernière date couvertes par vos relevés. Déclarez seulement une période dont vous avez tous les mouvements. Un mois sans achat peut être complet.
3. Dans Comptes, saisissez chaque nom de compte, sa nature (Courant ou Épargne) et son solde immédiatement avant le début de couverture. Les noms sont libres. Un solde initial à zéro doit être saisi explicitement.
4. Remplacez toutes les lignes de Transactions par vos mouvements constatés. Le montant est positif ou nul et numérique, en euros, avec deux décimales au maximum. Le sens est Débit ou Crédit. Collez les valeurs de votre source, sans formule. Excluez les prévisions.
5. Salaires, Budgets et Prêt sont facultatifs. Videz leurs lignes d'exemple ou supprimez les feuilles si vous ne disposez pas de ces données.
6. Choisissez le fichier dans Importer. Le résumé indique les données détectées et les fonctions disponibles. Corrigez les erreurs de feuille, ligne et colonne. Les avertissements de doublon demandent une vérification, sans suppression automatique.
7. Cliquez sur **Appliquer au dashboard**. Le fichier remplace entièrement les données affichées. Aucun compte, solde, salaire ou budget de la démo n'est réutilisé.
8. Rechargez la page pour vérifier la mémorisation. Un avertissement apparaît si le stockage est indisponible ou saturé.
9. Sur un appareil partagé, utilisez **Effacer mes données et revenir à la démo** depuis Importer. Cette action efface l'import, ses budgets et la copie temporaire du lecteur de fichier. Elle réinitialise aussi les budgets locaux et les paramètres de la démo.

## Structure du fichier

Conservez les en-têtes en ligne 1 et les noms exacts des feuilles.

| Feuille | Colonnes | Règle |
|---|---|---|
| Paramètres | Paramètre, Valeur | Version (nombre 1), Début couverture, Fin couverture |
| Comptes | Compte, Solde initial, Nature | Solde avant la couverture ; Courant ou Épargne |
| Transactions | Date, Libellé, Compte, Sens, Montant, Type, Catégorie, Sous-catégorie, Transfert | Toutes les dates dans la couverture ; sous-catégorie obligatoire pour une dépense |
| Salaires | Mois, Employeur, Brut, Net, Cotisations, Indemnités, Retenues | Une ligne par mois ; net = brut − cotisations + indemnités − retenues |
| Budgets | Sous-catégorie, Budget mensuel | Plafond mensuel par sous-catégorie, unique |
| Prêt | Compte, Capital initial, Mensualité, Nombre échéances | Un prêt amortissable à mensualité constante et taux positif, hors assurance |
| Notice | Instructions | Ignorée par le lecteur |

Dates : date Excel ou texte `YYYY-MM-DD`. Mois des salaires : texte `YYYY-MM`. Catégories de dépenses : Dépense Fixe, Dépense Courante, Dépense Occasionnelle. Sous-catégories et types usuels sont libres. Utilisez la colonne Transfert pour les virements entre vos comptes. Après application, les noms et rôles de types peuvent être personnalisés dans Paramètres.

Pour plusieurs années, une seule feuille Transactions suffit. Vous pouvez également créer Transactions 2024, Transactions 2025, etc., avec les mêmes en-têtes. Toutes sont lues et contrôlées. Une feuille inconnue bloque l'import afin d'éviter une omission silencieuse.

## Virements, épargne et comptes partagés

Un virement interne est représenté par deux mouvements : même date, même montant, deux comptes différents, sens opposés et même identifiant dans Transfert. Il modifie les soldes des deux comptes, mais est exclu des revenus et des dépenses économiques. Le lecteur vérifie les deux côtés. Un virement hors de votre périmètre de comptes est une opération ordinaire, sans identifiant Transfert.

Chaque mouvement affecte exclusivement son compte. Aucun débit ni crédit implicite sur un autre compte et aucune division automatique par deux. Pour un compte partagé, utilisez les soldes et mouvements bancaires entiers. La vue personnelle configurable est disponible dans Paramètres. Les montants stockés restent entiers ; chaque compte reçoit une quote-part explicite, initialement 100 %. Voir [le guide des paramètres](PARAMETRES_ET_RECETTE_LOT_C.md).

Pour les comptes déclarés Épargne, les crédits sont les entrées et les débits les sorties d'épargne. Les revenus du ratio excluent les virements internes, même si le filtre Transferts est activé. Un remboursement de capital immobilier ne constitue pas une entrée sur un livret dans ce modèle.

## Fonctions facultatives et limites

Sans Salaires, la vue Salaire et les cartes liées au salaire disparaissent. Sans paramètres et mouvements exploitables de prêt, la vue Prêt disparaît. Une URL directe vers une fonction indisponible revient à Comptes. L'absence d'indices dans ce modèle masque Inflation ; les indices fictifs de la démo ne sont jamais recopiés dans un import.

Pour le prêt, chaque mois présent doit comporter un débit de type Crédit Immobilier (part capital) et un débit Intérêt du prêt (part intérêts), sur le compte déclaré. Leur somme doit égaler la mensualité hors assurance. Le suivi reconstruit un échéancier théorique à partir des paramètres saisis. Il ne prend pas en charge les prêts variables, à taux nul, multiples ou comportant des remboursements anticipés historiques. Le simulateur reste indicatif.

Il faut adapter les exports bancaires et les anciens classeurs au modèle ; la correspondance automatique des colonnes n'est pas fournie. Une seule devise (EUR) et une seule ligne de salaire totalisé par mois sont acceptées. Les retenues incluent les montants nécessaires pour retrouver le net retenu, dont l'impôt si vous utilisez le net après prélèvement.

## Confidentialité et restauration

Le fichier est lu dans un Web Worker du navigateur. Aucune transaction n'est envoyée à un serveur par le lecteur. Après application, transactions, configuration, couverture, salaires, prêt et budgets sont enregistrés ensemble dans `localStorage`, avec une version de format. Les modifications de paramètres et de budgets mettent à jour ce même paquet. Les objectifs bancaires et personnels sont distincts.

Ce stockage dépend de l'appareil et du navigateur : une purge ou un quota peut faire perdre la mémorisation. Gardez votre fichier source. L'export JSON est une sauvegarde consultable ; le réimport JSON n'est pas proposé dans cette version. Les imports complets du lot B sont migrés automatiquement avec une quote-part de 100 %. Un ancien import sans configuration complète ou dont les liens de transfert restent ambigus est signalé et doit être refait, plutôt que mélangé à la démo.

Le classeur public a une empreinte vérifiée par le contrôle de publication. Ne remplacez jamais `public/modeles/Budget_v1.xlsx` par votre fichier personnel. Importez votre fichier via l'interface uniquement.
