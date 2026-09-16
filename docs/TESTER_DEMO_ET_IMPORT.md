# Tester la démo et l'import

## Démarrer

Dans Terminal :

```bash
cd "/chemin/vers/mon-budget-demo"
npm ci
npm run dev
```

Ouvrez l'adresse affichée, généralement http://localhost:5173. Gardez le Terminal ouvert. Pour arrêter : Ctrl+C. Si le port est occupé, utilisez l'adresse réellement indiquée par Vite.

Au premier accès, les données fictives de la démo apparaissent : cinq comptes et les neuf vues. Si un import est déjà mémorisé dans ce navigateur, ouvrez Importer et revenez à la démo.

## Essayer l'import sans données personnelles

1. Cliquez sur **Importer .xlsx**, puis **Télécharger le modèle Excel avec exemples fictifs**.
2. Choisissez le fichier téléchargé sans le modifier.
3. Le résumé doit indiquer 14 transactions, deux mois, deux comptes, deux mois de salaire et un prêt. Cliquez sur **Appliquer au dashboard**.
4. Dans Comptes, vérifiez le total **4 665,22 €**, le compte courant **3 065,22 €** et le livret **1 600,00 €**. Le net du dernier mois est **832,61 €**. Les cinq comptes de la démo ont disparu.
5. Dans Budget, changez Alimentation de 200 € à 225 € avec Entrée, puis rechargez la page. Le nouvel objectif doit rester à 225 €.
6. Dans Revenus, Salaire est accessible. Inflation est masquée, car le modèle ne contient aucun indice.
7. Dans Patrimoine, Prêt est accessible. Avec ces exemples, deux échéances sont payées et 238 restent. Le prêt est une estimation selon l'échéancier constant.
8. Dans Importer, utilisez **Effacer mes données et revenir à la démo**. Rechargez : les cinq comptes fictifs et les budgets initiaux doivent réapparaître.

## Vérifier l'affichage conditionnel

Faites une copie du modèle pour chaque essai. Conservez les en-têtes et ne mélangez pas les lignes de différentes copies.

| Essai | Modification | Résultat |
|---|---|---|
| Sans détails de salaire | Supprimer la feuille Salaires | Salaire et Inflation masqués ; les crédits bancaires restent dans Revenus |
| Sans prêt | Supprimer Prêt et les quatre mouvements de types Crédit Immobilier / Intérêt du prêt | Prêt masqué ; le reste fonctionne |
| Sans salaire ni prêt | Cumuler les deux modifications | Aucune vue facultative de salaire, inflation ou prêt |
| Montant incorrect | Remplacer un montant par le texte `abc` | Erreur avec feuille, ligne et colonne ; application impossible ; jeu précédent conservé |
| Transfert incomplet | Supprimer un seul côté d'un virement avec identifiant | Erreur de rapprochement ; application impossible |

Essayez également une URL comme `#/revenus/salaire` sans Salaires, ou `#/patrimoine/pret` sans prêt : elle doit revenir à Comptes.

Pour passer à vos données, suivez `IMPORT_EXCEL_V1.md`. Les exports bancaires nécessitent une adaptation au modèle. Le bouton Exporter en JSON sauvegarde le paquet pour consultation ; il ne propose pas de réimport JSON.

## Paramètres du lot C

Ouvrez **Paramètres** pour renommer comptes/types et régler vos quotes-parts. Le [guide détaillé du lot C](PARAMETRES_ET_RECETTE_LOT_C.md) fournit les étapes et les montants de contrôle. Le modèle Excel v1 reste compatible.
