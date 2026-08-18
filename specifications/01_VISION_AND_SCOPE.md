# 01 — Vision and Scope

> **Projet :** House Technical Designer  
> **Statut :** spécification fondatrice  
> **Objectif :** définir précisément ce que le logiciel doit faire, ce qu’il ne doit pas faire au départ, et les principes qui doivent guider toutes les décisions de développement.

---

## 1. Vision produit

House Technical Designer est une application web de conception et d’étude technique d’une habitation, construite autour d’un **modèle paramétrique unique du bâtiment**.

Le logiciel doit permettre à un utilisateur de :

- dessiner un bâtiment avec des conventions proches du dessin architectural technique ;
- définir précisément murs, planchers, toitures, ouvertures, pièces et matériaux ;
- ajouter les réseaux et équipements techniques ;
- lancer des calculs sur tout ou partie du bâtiment ;
- visualiser graphiquement les résultats sur le plan ;
- générer les quantités globales de matériaux et équipements ;
- comparer plusieurs variantes ;
- exporter des plans, listes et résultats compréhensibles et traçables.

Le logiciel doit rester utilisable à deux niveaux :

1. **usage simple** : étude rapide d’un domaine précis ;
2. **usage projet complet** : conception cohérente d’une habitation entière.

---

## 2. Positionnement

Le projet se situe entre :

- un calculateur technique web ;
- un logiciel de dessin architectural ;
- un BIM résidentiel léger ;
- un outil d’aide à la décision technique.

Il ne cherche pas à reproduire Revit, Archicad ou un logiciel de bureau d’études complet.

Sa valeur principale doit venir de :

- l’intégration des domaines ;
- la simplicité d’utilisation ;
- la représentation graphique ;
- la transparence des calculs ;
- la possibilité d’ajouter des matériaux, équipements, règles et modules.

---

## 3. Utilisateurs cibles

### 3.1 Particulier technique / autoconstructeur

Besoins :

- comprendre un projet de maison ;
- comparer plusieurs solutions ;
- dimensionner grossièrement ou techniquement certains systèmes ;
- visualiser les conséquences d’un choix ;
- obtenir une liste de matériaux et équipements.

### 3.2 Maker / développeur / ingénieur

Besoins :

- accès aux hypothèses ;
- valeurs détaillées ;
- formules documentées ;
- ajout de modules ;
- données exportables ;
- architecture logicielle ouverte.

### 3.3 Professionnel souhaitant une pré-étude

Besoins :

- plans lisibles ;
- métrés ;
- contrôles automatiques ;
- exports ;
- traçabilité des références utilisées.

Le logiciel ne remplace pas une validation professionnelle lorsque celle-ci est requise par la réglementation ou par le niveau de risque du projet.

---

## 4. Principes UX fondamentaux

### 4.1 Le graphique est la vue principale

Les données techniques ne doivent pas être enfermées uniquement dans des formulaires.

L’utilisateur doit pouvoir comprendre l’état du projet directement sur le plan grâce à :

- symboles ;
- couleurs analytiques ;
- hachures ;
- épaisseurs ;
- flèches de flux ;
- annotations ;
- alertes localisées.

### 4.2 Progressivité

Le logiciel doit permettre de commencer avec peu d’informations.

Exemple :

- mur simple : épaisseur + matériau principal ;
- mur avancé : assemblage multicouche complet ;
- mur expert : propriétés hygrothermiques, acoustiques, environnementales, coût et provenance.

### 4.3 Pas de blocage artificiel

Un module doit pouvoir être utilisé même si les autres ne sont pas configurés.

Exemple : un utilisateur doit pouvoir faire uniquement une étude photovoltaïque sans dessiner le réseau d’eau.

### 4.4 Les données inconnues restent inconnues

Le logiciel ne doit pas inventer silencieusement une propriété manquante.

Toute valeur par défaut doit être :

- identifiable ;
- documentée ;
- modifiable ;
- distinguée d’une valeur réellement fournie par l’utilisateur.

---

## 5. Périmètre fonctionnel cible

### Architecture

- niveaux ;
- murs ;
- cloisons ;
- planchers ;
- toitures ;
- portes ;
- fenêtres ;
- pièces ;
- escaliers ;
- cotations ;
- coupes ;
- façades ;
- surfaces ;
- volumes.

### Matériaux et assemblages

- matériaux génériques ;
- produits fabricants ;
- matériaux utilisateur ;
- murs multicouches ;
- planchers multicouches ;
- toitures multicouches ;
- vitrage ;
- revêtements ;
- isolants ;
- membranes ;
- métrés.

### Thermique

- résistances thermiques ;
- coefficients U ;
- déperditions ;
- apports ;
- zones thermiques ;
- puissance de chauffage ;
- confort d’été simplifié puis avancé.

### Hygrothermie

- diffusion de vapeur ;
- risque de condensation ;
- températures de surface ;
- alertes de conception.

### Chauffage / ECS

- besoins ;
- équipements ;
- puissance ;
- énergie ;
- rendement ;
- distribution.

### Photovoltaïque / stockage

- surfaces disponibles ;
- orientation ;
- inclinaison ;
- puissance ;
- production ;
- autoconsommation ;
- batteries ;
- autonomie.

### Eau

- eau froide ;
- eau chaude ;
- pression ;
- débits ;
- diamètres ;
- pertes de charge ;
- production ECS.

### Eau de pluie

- surface de collecte ;
- rendement ;
- pluviométrie ;
- stockage ;
- besoins ;
- trop-plein ;
- appoint.

### Évacuation

- eaux usées ;
- eaux vannes ;
- eaux pluviales ;
- pentes ;
- diamètres ;
- raccordements.

### Ventilation

- entrées / extractions ;
- débits ;
- réseaux ;
- sections ;
- vitesses ;
- pertes de charge ;
- équilibrage ;
- récupération de chaleur.

### Qualité d’air

- occupation ;
- CO₂ ;
- humidité ;
- renouvellement d’air.

### Électricité

- tableau ;
- circuits ;
- prises ;
- éclairage ;
- équipements ;
- puissance ;
- sections ;
- protections ;
- chute de tension.

### Éclairage

- objectifs de lux ;
- luminaires ;
- implantation ;
- estimation d’éclairement ;
- consommation.

### Acoustique

- absorption ;
- réverbération ;
- séparation entre locaux ;
- bruit des équipements ;
- zones sensibles.

### Coût / quantité

- quantités ;
- pertes ;
- prix unitaires ;
- lots ;
- variantes ;
- synthèse globale.

### Environnement

- masse ;
- données FDES/PEP lorsqu’elles sont disponibles ;
- indicateurs environnementaux ;
- comparaison de variantes.

---

## 6. Hors périmètre initial

Le MVP ne doit pas chercher à gérer immédiatement :

- calcul structurel complet selon Eurocodes ;
- étude géotechnique ;
- calcul CFD ;
- simulation énergétique réglementaire complète RE2020 ;
- rendu photoréaliste ;
- collaboration multi-utilisateurs temps réel ;
- gestion documentaire BIM complète ;
- gestion de chantier ;
- devis fournisseurs en temps réel ;
- génération automatique d’un dossier administratif officiel.

Ces fonctions pourront être ajoutées ensuite sous forme de modules.

---

## 7. Niveaux d’analyse

Chaque calcul doit annoncer son niveau :

### ESTIMATE

Calcul rapide de pré-dimensionnement.

### ENGINEERING

Méthode technique documentée et suffisamment détaillée pour une étude de conception.

### STANDARD

Méthode explicitement alignée sur une norme ou un guide identifié.

### REGULATORY

Méthode validée comme implémentation d’un calcul réglementaire précis et versionné.

Le niveau `REGULATORY` doit être exceptionnel et nécessite validation documentaire et tests dédiés.

---

## 8. Scénarios et variantes

L’utilisateur doit pouvoir comparer plusieurs états du projet sans recopier toute la maison.

Exemples :

- isolation 120 mm vs 180 mm ;
- PAC vs poêle ;
- 3 kWp vs 6 kWp photovoltaïque ;
- VMC simple flux vs double flux ;
- cuve 3 m³ vs 8 m³.

Une variante doit idéalement stocker seulement les différences par rapport au projet de base.

---

## 9. Métrés et nomenclature globale

Une fonction centrale du logiciel est la génération d’une liste consolidée de :

- matériaux ;
- assemblages ;
- équipements ;
- conduites ;
- gaines ;
- câbles ;
- accessoires ;
- surfaces ;
- longueurs ;
- volumes ;
- masses.

Le métré doit distinguer :

- quantité géométrique ;
- quantité nette ;
- pertes / chutes ;
- marge utilisateur ;
- quantité d’achat.

---

## 10. Contraintes techniques produit

Le logiciel doit :

- fonctionner dans un navigateur moderne ;
- pouvoir être déployé sur GitHub Pages ;
- fonctionner sans compte utilisateur ;
- fonctionner principalement localement ;
- utiliser des fichiers projet exportables ;
- ne pas dépendre d’un serveur pour les fonctions essentielles ;
- rester testable sans interface graphique.

---

## 11. Critères de réussite du MVP

Le MVP est considéré utile lorsque l’utilisateur peut :

1. créer un projet ;
2. dessiner un niveau ;
3. créer plusieurs murs avec épaisseur réelle ;
4. créer automatiquement ou manuellement des pièces ;
5. insérer portes et fenêtres ;
6. affecter des assemblages multicouches ;
7. ajouter ou modifier un matériau ;
8. afficher correctement les hachures et conventions de plan ;
9. calculer surfaces, volumes et quantités ;
10. réaliser un premier calcul thermique cohérent ;
11. enregistrer et recharger le projet ;
12. exporter un plan SVG et un métré CSV.

---

## 12. Règles de décision produit

Lorsqu’un choix technique est ambigu, appliquer cet ordre de priorité :

1. cohérence des données ;
2. exactitude géométrique ;
3. transparence du calcul ;
4. simplicité d’utilisation ;
5. extensibilité ;
6. performance ;
7. esthétique.

Une interface agréable ne doit jamais masquer une incohérence technique.

---

## 13. Définition du produit final

Le produit final doit être capable de répondre graphiquement à des questions telles que :

- de quoi est construite la maison ?
- quelles quantités de matériaux sont nécessaires ?
- où sont les principales pertes thermiques ?
- quelle puissance de chauffage est nécessaire ?
- comment circule l’air ?
- comment circule l’eau ?
- où passent les réseaux ?
- quelle puissance électrique est appelée ?
- quelle production solaire est possible ?
- quelles pièces présentent un problème acoustique ou de ventilation ?
- quelles modifications améliorent le plus le projet ?

Le logiciel doit donc être pensé comme **un modèle technique explorable de la maison**, et non comme une juxtaposition de formulaires de calcul.
