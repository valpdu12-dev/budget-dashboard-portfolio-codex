# Personnaliser les paramètres et tester le lot C

## Lancer et découvrir

Depuis le dossier de la copie de travail, lancez `npm run dev`, puis ouvrez l'adresse affichée par Vite. La démo se charge avec des données entièrement fictives. Ouvrez **Paramètres** en haut à droite, ou la route `#/parametres`.

1. Changez le nom d'un compte et d'un type, puis cliquez sur **Enregistrer les paramètres**. Retrouvez ces noms dans les cartes, graphiques et tableaux. Les montants doivent rester identiques.
2. Sur un compte joint, indiquez **Ma quote-part = 50 %**. Cette valeur seule ne modifie pas la vue bancaire.
3. Sélectionnez **Ma quote-part** dans Paramètres, ou utilisez le bouton **Montants bancaires / Ma quote-part** dans les filtres de l'en-tête. La vue personnelle utilise 50 % des mouvements de ce compte. Les autres comptes conservent leur propre pourcentage.
4. Ouvrez Budget et définissez vos objectifs personnels : ils sont distincts des objectifs bancaires. Changez de vue pour retrouver chaque série d'objectifs.
5. Activez **Transferts** puis revenez à Comptes. Le tableau des deux mouvements liés affiche les montants bancaires. Revenus, dépenses et budgets excluent toujours ces mouvements.
6. Rechargez la page : mêmes comptes, noms, quote-parts, prêt et objectifs. Un message signale les réglages conservés seulement pour la session si le stockage est indisponible.

## Utiliser son propre fichier

Téléchargez le modèle Budget v1 depuis **Importer .xlsx**, remplacez les exemples et appliquez le classeur validé. Le contrat Excel du lot B reste accepté : aucun nouveau fichier obligatoire. Les identifiants de comptes et de types sont créés automatiquement lors du premier import, puis conservés avec le jeu. Les nouveaux imports commencent en vue bancaire, à 100 % pour chaque compte.

Les noms de comptes et types acceptent 100 caractères maximum. Les noms techniques Total, monthKey, label, name, mk, __proto__, constructor, prototype et le préfixe prev_ sont réservés ; une erreur est localisée avant application. Les types usuels sont libres. Dans Excel v1, `Transfert interne` nécessite la colonne Transfert et les deux mouvements correspondants. `Crédit Immobilier` et `Intérêt du prêt` identifient initialement capital/intérêts ; après import, leur rôle et leur nom se règlent séparément dans Paramètres. Un changement de rôle est contrôlé avant application, avec rapprochement de l'échéancier si le prêt est activé.

Pour ajouter un compte, un type, une année ou des opérations, réimportez un classeur complet. Un nouvel import remplace l'ensemble, y compris les personnalisations. Les identifiants sont propres au jeu importé, sans rapprochement entre deux fichiers indépendants.

## Règles de calcul

| Élément | Vue bancaire | Ma quote-part |
|---|---|---|
| Mouvement économique de 100 € sur un compte à 50 % | 100 € | 50 € |
| Solde bancaire de 1 000 € sur ce compte | 1 000 € | 500 € |
| Solde initial | Valeur bancaire explicite | Valeur bancaire multipliée par la quote-part |
| Transfert entre deux comptes du jeu | Modifie chaque solde ; exclu des revenus/dépenses | Exclu des revenus/dépenses ; solde valorisé selon chaque quote-part |
| Entrée/sortie d'un compte de nature Épargne | Montant entier | Quote-part du compte d'épargne |
| Salaire détaillé et échéancier du prêt | Montants contractuels | Montants contractuels ; mention explicite dans le bandeau |
| Objectif budgétaire | Objectifs bancaires | Objectifs personnels séparés, vides au départ |

Les montants stockés restent bancaires et ne sont jamais remplacés par une projection personnelle. Chaque ligne personnelle est arrondie au centime, une seule fois. Le solde personnel est calculé depuis le solde bancaire de fin de mois, puis arrondi au centime ; il n'accumule pas les arrondis des lignes. Les moyennes budgétaires conservent les centimes.

Les quote-parts peuvent différer entre les deux côtés d'un transfert : la valeur du patrimoine personnel peut alors varier, même si le total bancaire reste constant. Par exemple, transférer 100 € d'un compte à 100 % vers un compte à 50 % diminue la valeur attribuée de 50 €. Cette différence n'est pas présentée comme un revenu ou une dépense. Cette vue est une répartition conventionnelle ; elle ne reconstitue pas des droits de propriété ni des participations variables selon les dates.

Une modification de quote-part ou de nature s'applique à tout l'historique. Les transferts exigent deux lignes de même date et montant, sur des comptes distincts, de sens opposés, avec le même lien. Un virement vers un compte absent du fichier reste une opération courante. La sélection d'un rôle Transfert peut reconnaître une paire unique déjà présente ; les situations ambiguës demandent la colonne Transfert dans Excel.

## Rubriques disponibles

Sans salaires, les cartes et pages Salaire/Inflation sont masquées. Sans compte de nature Épargne, la rubrique Épargne disparaît. Sans prêt activé et opérations de capital/intérêts exploitables, la rubrique Prêt disparaît. Si épargne et prêt manquent, l'onglet Patrimoine est masqué sur ordinateur et mobile. Si seul le prêt existe, cet onglet l'ouvre directement. Les accès directs aux rubriques absentes sont redirigés. La période filtrée ne détermine pas la disponibilité.

## Migration, sauvegarde et effacement

Les imports complets mémorisés par le lot B sont migrés vers le schéma de données 2 et le stockage 3, avec les mêmes montants, salaires, budgets, soldes et couverture. La quote-part initiale est 100 %. Les anciens liens de transferts sont reconstruits seulement lorsqu'une paire unique peut être retrouvée. Si des virements de même date et montant ont perdu leurs liens et restent ambigus, le fichier doit être réimporté ; aucune association arbitraire n'est faite. Les imports encore plus anciens, sans configuration complète, nécessitent également un réimport.

Si l'écriture de la migration échoue, l'ancien stockage est conservé et les données migrées restent visibles pour la session. Les modifications suivantes signalent un échec de mémorisation ; gardez votre classeur source. **Exporter les données et paramètres enregistrés (JSON)** sauvegarde le jeu en mémoire et les réglages appliqués, sans les modifications non enregistrées du formulaire. Le réimport JSON n'est pas fourni.

**Importer → Effacer mes données et revenir à la démo** efface les trois versions d'import, les budgets locaux et les paramètres de la démo, puis recharge les valeurs fictives. Si l'effacement ne peut pas être terminé, un message explicite apparaît. Aucun contenu de fichier ou réglage n'est envoyé au réseau par ces actions.

## Contrôle rapide avec le modèle fourni

Avec les exemples du modèle Budget v1, le solde bancaire final vaut **4 665,22 €** : compte courant **3 065,22 €**, livret **1 600 €**. Après passage du compte courant à 50 % et du livret à 100 %, la vue personnelle doit afficher **3 132,61 €** : courant **1 532,61 €**, livret **1 600 €**. Renommer ces comptes ne change pas ces montants.

La démo complète conserve son solde bancaire final de **46 670,44 €**. Ses transferts sont désormais représentés explicitement des deux côtés ; les crédits vers le livret sont exclus des revenus économiques. Les anciens chiffres de recettes et d'épargne du lot A peuvent donc différer : le double comptage de l'apport au livret a été corrigé.
