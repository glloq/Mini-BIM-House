# 10 — UI / UX Specification

> **Objectif :** maintenir une interface graphique intuitive malgré la richesse technique.

## 1. Principe général

L’écran principal est un **workspace de plan**.

```text
┌──────────────────────────────────────────────────────────────┐
│ Topbar : projet / niveau / vue / scénario / calcul          │
├──────────┬────────────────────────────────────┬──────────────┤
│ Outils   │                                    │ Inspecteur   │
│          │              PLAN                  │              │
│          │                                    │ Propriétés   │
│          │                                    │ Calculs      │
├──────────┴────────────────────────────────────┴──────────────┤
│ Status / coordonnées / snap / échelle / messages            │
└──────────────────────────────────────────────────────────────┘
```

## 2. Règle UX majeure

Ne jamais afficher tous les paramètres à la fois.

Utiliser :

```text
Essentiel
Technique
Avancé
Références
```

## 3. Navigation par vues

Vues principales :

```text
Architecture
Matériaux
Thermique
Eau
Ventilation
Électricité
Éclairage
Solaire
Acoustique
Synthèse
```

Le changement de vue ne change pas le modèle, seulement sa représentation.

## 4. Layer panel

Chaque vue possède un panneau de couches :

```text
☑ murs
☑ ouvertures
☑ cotes
☐ mobilier
☑ eau froide
☑ eau chaude
☐ évacuation
```

Prévoir presets :

- plan architecte ;
- plomberie ;
- ventilation ;
- électrique ;
- impression.

## 5. Inspecteur contextuel

Un mur sélectionné affiche :

```text
Mur M-023
Longueur
Hauteur
Assemblage
Référence géométrique
Niveau
```

Puis onglets :

```text
Géométrie | Matériaux | Thermique | Acoustique | Quantités | Références
```

## 6. Édition directe

Permettre :

- poignées sur plan ;
- saisie numérique ;
- double-clic ;
- raccourcis clavier ;
- contexte clic droit.

Le plan doit rester le moyen principal de modifier la géométrie.

## 7. Création de mur

Workflow :

1. choisir Mur ;
2. cliquer point départ ;
3. cliquer points suivants ;
4. saisie longueur/angle facultative ;
5. clic droit/Escape pour terminer.

Pendant le dessin afficher :

- longueur ;
- angle ;
- snap ;
- référence de mur ;
- épaisseur.

## 8. Matériaux

L’éditeur d’assemblage doit être graphique :

```text
EXTÉRIEUR
│ 15 mm  Enduit
│ 200 mm Brique
│ 160 mm Isolant
│ 13 mm  Plâtre
INTÉRIEUR
```

Chaque couche est sélectionnable, réordonnable et modifiable.

## 9. Catalogue matériaux

Interface :

- recherche ;
- filtres ;
- favoris facultatifs ;
- aperçu propriétés ;
- bouton `Ajouter au projet` ;
- bouton `Créer un matériau`.

Les données manquantes doivent être visibles immédiatement.

## 10. Analyse graphique

Exemple thermique :

- carte de couleur ;
- survol = valeur ;
- clic = détail ;
- légende fixe ;
- bascule `valeur / état / pertes`.

## 11. Réseaux

Le dessin d’un réseau doit ressembler à un éditeur de graphe guidé :

1. placer équipements/terminaux ;
2. tracer segment ;
3. snaps sur ports ;
4. connexion logique automatique ;
5. calcul ;
6. annotation du diamètre/débit.

## 12. Alertes localisées

Une alerte technique doit apparaître :

- dans un panneau global ;
- sur l’objet concerné ;
- dans l’inspecteur.

Exemple :

```text
⚠ Débit cible non atteint
Bouche V-12
Mesuré : 22 m³/h
Cible : 30 m³/h
```

## 13. Dashboard global

La synthèse doit rester courte :

```text
Surface habitable
Volume
Déperditions
Puissance chauffage
Consommation estimée
Production PV
Eau/an
Récupération pluie
Matériaux
Coût
Alertes
```

Chaque carte ouvre le module détaillé.

## 14. Modes de complexité

### QUICK

Paramètres minimaux, beaucoup de valeurs suggérées.

### DESIGN

Mode normal recommandé.

### EXPERT

Toutes les propriétés, hypothèses, sources et réglages.

Le projet stocke les mêmes données ; seul l’affichage change.

## 15. Assistant de projet initial

Étapes :

```text
1. Projet
2. Localisation
3. Niveaux
4. Géométrie
5. Enveloppe
6. Systèmes facultatifs
```

L’utilisateur doit pouvoir ignorer toutes les étapes non nécessaires.

## 16. Command palette

Ajouter une palette type IDE :

```text
Ctrl+K
> Ajouter mur
> Afficher thermique
> Exporter SVG
> Recalculer ventilation
```

Utile lorsque le nombre de fonctions augmente.

## 17. Raccourcis

Prévoir dès le début un registre central de raccourcis et éviter de les coder dans les composants.

Exemples :

```text
W mur
D cote
Esc annuler
Delete supprimer
Ctrl+Z undo
Ctrl+Shift+Z redo
```

## 18. États visuels

Une convention unique doit distinguer :

- normal ;
- hover ;
- sélectionné ;
- verrouillé ;
- erreur ;
- avertissement ;
- élément calculé ;
- donnée manquante.

## 19. Mobile

Le projet cible d’abord desktop/tablette large.

Mobile : lecture et consultation possibles plus tard ; édition architecturale complète non prioritaire.

## 20. Accessibilité

Ne pas dépendre uniquement des couleurs.

Prévoir :

- contrastes ;
- navigation clavier ;
- textes alternatifs pour indicateurs ;
- motifs/labels pour états critiques.

## 21. Sauvegarde

Toujours montrer l’état :

```text
Modifié
Sauvegardé localement
Export nécessaire
```

Le navigateur ne doit jamais donner l’impression qu’un fichier externe est sauvegardé s’il ne l’est pas.

## 22. Principe final

L’utilisateur doit pouvoir répondre à trois questions en permanence :

```text
Qu’est-ce que je regarde ?
Qu’est-ce qui est sélectionné ?
Qu’est-ce que cette valeur signifie ?
```

Si une vue échoue sur l’une de ces questions, elle doit être simplifiée.
