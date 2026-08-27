# Mini-BIM-House — Évolutions fonctionnelles futures

**Statut :** document de cadrage produit / architecture  
**Date :** 25 août 2026  
**Périmètre :** évolutions fonctionnelles à prévoir après stabilisation de l'UX V4  
**Principe :** enrichir Mini-BIM sans ajouter de complexité visible ni multiplier les modèles de données.

---

## 1. Objectif

Mini-BIM dispose désormais d'une base suffisamment riche pour passer d'un éditeur BIM technique à un véritable **assistant de conception résidentielle multidisciplinaire**.

La prochaine phase ne doit pas consister à ajouter un écran par nouvelle fonctionnalité. Elle doit permettre à l'utilisateur de :

1. placer les objets de la maison ;
2. les regrouper dans des systèmes logiques ;
3. tracer ou faire proposer les réseaux physiques ;
4. dimensionner et vérifier ;
5. produire automatiquement les schémas, tableaux et documents associés.

Le principe fondamental doit être :

> **Un seul modèle BIM → plusieurs représentations dérivées.**

Une prise, un radiateur ou un lavabo ne doit pas exister une fois sur le plan et une seconde fois dans un schéma technique.

---

# 2. État actuel utile pour la suite

Le projet possède déjà plusieurs briques structurantes :

- navigation en 7 espaces : Projet, Terrain, Bâtiment, Aménagement, Systèmes, Études, Documents ;
- sous-parties contextuelles et outils filtrés ;
- état de conception dérivé du modèle ;
- périmètre de conception par domaines ;
- modèle générique de réseaux `TechnicalNetwork` ;
- nœuds, ports typés et tronçons 3D ;
- routage manuel/assisté ;
- insertion de dérivations ;
- détection de ports ouverts et incohérences ;
- catalogue d'équipements avec ports, dimensions, performances et symboles ;
- calculs métier séparés du modèle source ;
- moteur de plans, coupes, façades et feuilles ;
- bibliothèque de symboles prévue pour les vues `SCHEMATIC`.

Cette architecture est adaptée à la suite. Il faut éviter de la contourner avec des modèles spécifiques isolés.

---

# 3. Architecture cible des systèmes techniques

Chaque discipline doit adopter la même structure conceptuelle :

```text
ÉQUIPEMENTS / TERMINAUX
        │
        ▼
SYSTÈME LOGIQUE
        │
        ▼
RÉSEAU PHYSIQUE
        │
        ▼
DIMENSIONNEMENT / VÉRIFICATIONS
        │
        ├── PLAN
        ├── SCHÉMA
        ├── TABLEAU
        └── DOCUMENTS
```

## 3.1 Système logique ≠ géométrie physique

Cette séparation est indispensable.

Exemple électrique :

```text
Circuit C03
 ├── prise salon 1
 ├── prise salon 2
 ├── prise salon 3
 └── prise salon 4
```

Le circuit existe même avant que les chemins de câbles soient dessinés.

Exemple chauffage :

```text
Circuit chauffage RDC
 ├── radiateur séjour
 ├── radiateur chambre 1
 └── radiateur chambre 2
```

La relation fonctionnelle existe indépendamment du tracé aller/retour.

Exemple eau :

```text
Collecteur EF
 ├── lavabo
 ├── douche
 ├── WC
 └── évier
```

Cette séparation permet :

- conception rapide au stade esquisse ;
- calcul préliminaire ;
- génération automatique de schémas ;
- modification des tracés sans casser la logique métier ;
- proposition de plusieurs routes ;
- passage progressif d'une conception simplifiée à une conception détaillée.

---

# 4. Nouveau type de vue : SCHÉMA

Le modèle documentaire gère actuellement les plans, coupes, façades, toiture et site. Il faut ajouter une famille de vues dérivées pour les systèmes.

## 4.1 Types proposés

```text
SCHEMATIC
├── ELECTRICAL_SINGLE_LINE
├── ELECTRICAL_PANEL
├── PLUMBING_DISTRIBUTION
├── PLUMBING_RISER
├── WASTEWATER_RISER
├── HEATING_HYDRAULIC
├── VENTILATION_SYSTEM
├── PV_SINGLE_LINE
└── ENERGY_FLOW
```

Un type générique `SCHEMATIC` peut être stocké dans le modèle documentaire avec un `schematicKind`.

## 4.2 Source de vérité

Le schéma doit être généré depuis :

- équipements ;
- ports ;
- systèmes logiques ;
- topologie réseau ;
- propriétés métier.

Il ne doit pas créer une copie du réseau.

À persister uniquement :

- position graphique volontaire d'un symbole dans le schéma ;
- groupes repliés ;
- orientation ;
- annotations utilisateur ;
- ordre manuel éventuel.

La connectivité reste celle du BIM.

---

# 5. Moteur générique de schémas

Créer un moteur de rendu de graphe réutilisable :

```text
SemanticNetwork
      ↓
SchematicGraphBuilder
      ↓
AutoLayout
      ↓
DisciplineSymbolProfile
      ↓
DrawingScene
```

## Fonctions nécessaires

- placement automatique des nœuds ;
- orientation horizontale/verticale ;
- regroupement par tableau / collecteur / niveau ;
- évitement simple des croisements ;
- connecteurs orthogonaux ;
- symboles sémantiques ;
- labels automatiques ;
- repères de circuits ;
- légende automatique ;
- recalcul du layout ;
- conservation des déplacements manuels.

Ce moteur doit servir à toutes les disciplines.

---

# 6. Électricité — première chaîne verticale prioritaire

L'électricité est le meilleur domaine pour valider cette architecture car Mini-BIM possède déjà :

- source ;
- tableau ;
- protections ;
- prises ;
- interrupteurs ;
- luminaires ;
- charges fixes ;
- PV ;
- batteries ;
- borne VE ;
- circuits ;
- câbles ;
- sections ;
- phases ;
- puissance ;
- courant ;
- chute de tension.

## 6.1 Workflow utilisateur cible

```text
1. Poser tableau + prises + éclairages
2. Sélectionner des équipements
3. "Créer un circuit"
4. Choisir :
      Tableau
      Usage
      Tension
5. Mini-BIM propose :
      Protection
      Section
      Circuit
6. Accepter / modifier
7. Tracer le câble maintenant ou plus tard
8. Schéma unifilaire automatiquement disponible
```

## 6.2 Gestionnaire de circuits

Créer une vue de gestion dérivée :

| Circuit | Usage     | Tableau | Charges | P installée | I calculé | Protection | Section |  ΔU | État |
| ------- | --------- | ------- | ------: | ----------: | --------: | ---------- | ------- | --: | ---- |
| C01     | éclairage | TD1     |       6 |       420 W |         … | …          | …       |   … | OK   |
| C02     | prises    | TD1     |       8 |           … |         … | …          | …       |   … | ⚠    |

Actions :

- localiser ;
- sélectionner les charges ;
- changer de tableau ;
- ajouter/retirer une charge ;
- dimensionner ;
- afficher le schéma ;
- tracer/modifier le chemin physique.

## 6.3 Schéma unifilaire

Généré automatiquement :

```text
Réseau
  │
Disjoncteur général
  │
Tableau TD1
  ├── ID1
  │    ├── C01 éclairage
  │    ├── C02 prises séjour
  │    └── C03 prises chambres
  │
  └── ID2
       ├── C04 four
       ├── C05 chauffe-eau
       └── C06 PAC
```

Le schéma doit afficher :

- tableau ;
- protections ;
- circuits ;
- section ;
- nombre de conducteurs ;
- puissance ;
- courant ;
- chute de tension ;
- destination ;
- alertes.

## 6.4 Tableau électrique

Ajouter un **panel schedule** dérivé :

- ordre des circuits ;
- repérage ;
- puissance ;
- équilibrage de phases ;
- groupes différentiels ;
- réserve disponible ;
- protections ;
- sections ;
- commentaires.

À terme :

- proposition automatique de répartition des circuits ;
- équilibrage triphasé ;
- contrôle sélectivité simplifié ;
- contrôle surcharge ;
- contrôle chute de tension ;
- réserve modulaire du tableau.

## 6.5 Relations de commande

Ne pas confondre :

```text
alimentation électrique
```

et :

```text
commande interrupteur → luminaire
```

Prévoir une relation logique dédiée :

```text
ControlRelation
source: switch
targets: luminaires[]
kind: SIMPLE | TWO_WAY | IMPULSE | DIMMER | SMART
```

Cela permettra de produire :

- schéma de commande ;
- repérage ;
- contrôle des interrupteurs sans charge ;
- automatisation/domotique ultérieure.

---

# 7. Eau potable / ECS

Le module eau possède déjà hydraulique et dimensionnement. L'enjeu principal devient l'orchestration UX.

## 7.1 Workflow cible

```text
1. Poser les appareils sanitaires
2. Poser source / compteur / ballon / collecteur
3. Sélectionner les appareils
4. "Créer alimentation eau"
5. Choisir la topologie
6. Mini-BIM connecte logiquement les ports compatibles
7. Proposer le routage
8. Dimensionner
```

## 7.2 Topologies proposées

```text
Collecteur / pieuvre
Tronc + dérivations
Boucle ECS
Personnalisé
```

Chaque preset ne doit créer que des relations éditables.

## 7.3 Dimensionnement automatique

Dériver :

- débits probables ;
- DN conseillé ;
- vitesse ;
- perte de charge ;
- pression disponible ;
- longueur ;
- volume d'eau ;
- temps d'attente ECS ;
- pertes thermiques ECS si données disponibles.

Résultat directement sur le plan :

```text
EF Ø16   0,18 l/s   1,1 m/s
```

avec détails dans l'inspecteur.

## 7.4 Schéma de distribution

```text
Compteur
   │
Traitement
   │
Collecteur EF
 ├── WC
 ├── LL
 ├── évier
 └── ballon ECS
        │
     Collecteur ECS
       ├── lavabo
       ├── douche
       └── évier
```

---

# 8. Évacuation EU / EV

Cette discipline nécessite un workflow différent de l'eau sous pression.

## À prévoir

- appareils avec port de rejet ;
- branchements ;
- collecteurs ;
- chutes verticales ;
- évents ;
- regards ;
- nettoyage/inspection ;
- pentes ;
- diamètre ;
- changement de niveau ;
- sortie bâtiment ;
- raccordement assainissement.

## Assistance automatique

Lors du tracé :

- pente par défaut issue du projet/règles ;
- affichage altitude départ/arrivée ;
- avertissement si pente impossible ;
- proposition d'une chute verticale ;
- contrôle croisement structure ;
- contrôle contre-pente ;
- détection tronçon sans exutoire.

## Schéma

Créer un **riser diagram** :

```text
Étage
 lavabo ─┐
 douche ─┼── chute EU
         │
RDC      │
 évier ──┤
         │
      regard
         │
       sortie
```

---

# 9. Eaux pluviales

Prévoir :

- surfaces collectées ;
- gouttières ;
- descentes ;
- regards ;
- cuve ;
- trop-plein ;
- infiltration ;
- réseau de réutilisation ;
- pompe ;
- filtration.

Automatisation :

```text
surface toiture
   ↓
débit de projet
   ↓
nombre / diamètre de descentes
   ↓
volume de stockage conseillé
```

Puis schéma de collecte/réutilisation.

---

# 10. Chauffage hydraulique

Le domaine actuel doit être enrichi au-delà du calcul de besoins.

## 10.1 Nouveau domaine nécessaire

Créer une représentation métier explicite de :

- générateur ;
- ballon tampon ;
- échangeur ;
- circulateur ;
- vanne mélangeuse ;
- collecteur ;
- radiateur ;
- ventilo-convecteur ;
- plancher chauffant ;
- boucle ;
- départ ;
- retour ;
- régulation.

## 10.2 Workflow cible

```text
1. Calculer le besoin de chaque pièce
2. Sélectionner les pièces
3. "Dimensionner le chauffage"
4. Choisir :
      radiateurs
      plancher chauffant
      autre
5. Mini-BIM propose les émetteurs
6. L'utilisateur place / ajuste
7. Créer le circuit
8. Tracer départ + retour
9. Dimensionner / équilibrer
```

## 10.3 Radiateurs

Suggestion selon :

- besoin de la pièce ;
- température départ/retour ;
- température intérieure ;
- puissance catalogue ;
- dimensions disponibles.

Afficher :

```text
Besoin pièce     1 150 W
Radiateur choisi 1 320 W
Marge             +15 %
```

## 10.4 Plancher chauffant

Génération assistée :

- zones par pièce ;
- collecteur ;
- pas de pose ;
- longueur de boucle max ;
- nombre de boucles ;
- débit par boucle ;
- pertes de charge ;
- équilibrage.

Le générateur de boucle doit produire de la géométrie réellement éditable.

## 10.5 Schéma hydraulique

```text
PAC
 │
Ballon tampon
 │
Circulateur
 │
Collecteur
 ├── boucle séjour
 ├── boucle chambre 1
 └── boucle chambre 2
```

Avec :

- températures ;
- débits ;
- puissance ;
- pertes ;
- circulateurs ;
- organes de sécurité.

---

# 11. Ventilation

## Workflow cible

```text
Pièces
  ↓
besoin soufflage/extraction
  ↓
bouches proposées
  ↓
réseau logique
  ↓
routage
  ↓
dimensionnement
  ↓
équilibrage
```

## À prévoir

- bouche soufflage ;
- bouche extraction ;
- transfert ;
- VMC ;
- plénum ;
- gaine ;
- registre ;
- silencieux ;
- filtre ;
- rejet / prise d'air.

## Automatisation

À partir du type de pièce :

- proposer extraction/soufflage ;
- débit cible ;
- position indicative ;
- diamètre initial ;
- réseau recommandé ;
- contrôle vitesse/bruit/pertes.

Le routage doit pouvoir proposer plusieurs solutions.

---

# 12. Photovoltaïque / stockage

Créer une chaîne cohérente :

```text
Modules
  ↓
Strings
  ↓
Onduleur
  ↓
Protection DC
  ↓
Protection AC
  ↓
Tableau
  ↓
Réseau
```

## Fonctions futures

- création automatique de strings ;
- contrôle tensions/courants ;
- compatibilité onduleur ;
- MPPT ;
- longueur et section DC ;
- chute de tension ;
- production ;
- batterie ;
- autoconsommation ;
- raccordement tableau.

## Vue

Schéma unifilaire PV automatiquement généré.

---

# 13. Courants faibles / sécurité / domotique

Utiliser le même moteur :

- Ethernet ;
- fibre ;
- TV ;
- interphonie ;
- alarme ;
- détection incendie ;
- vidéo ;
- capteurs ;
- bus domotique.

Les réseaux de données peuvent partager des chemins physiques sans être le même système logique.

Prévoir la notion de :

```text
CableRoute / Tray / Conduit
```

pouvant contenir plusieurs circuits/réseaux compatibles.

---

# 14. Conduits de fumée

Modèle futur :

- appareil ;
- raccordement ;
- conduit ;
- traversée ;
- sortie ;
- distance aux matériaux combustibles ;
- hauteur ;
- diamètre ;
- dévoiements ;
- tirage si module disponible.

Créer vue verticale dédiée / coupe automatique.

---

# 15. Routage assisté commun à tous les réseaux

Le schéma réseau actuel prévoit MANUAL / ASSISTED / AUTO. Il faut faire de cette capacité un composant transversal.

## 15.1 RouteProposal

Créer une abstraction :

```ts
RouteProposal {
  id
  path
  score
  length
  bends
  penetrations
  conflicts
  warnings
}
```

L'utilisateur demande :

```text
Relier
```

Mini-BIM propose 1 à 3 routes :

```text
A — plus courte
B — moins de percements
C — suit les zones techniques
```

L'utilisateur prévisualise puis applique.

## 15.2 Contraintes communes

- éviter structure ;
- éviter équipements ;
- respecter réservations ;
- zones interdites ;
- zones préférées ;
- gaines techniques ;
- faux plafond ;
- vide sanitaire ;
- doublage ;
- chemins de câbles ;
- pente minimale/maximale ;
- rayon de courbure ;
- hauteur de passage.

## 15.3 Transaction unique

Une route automatique doit être appliquée en une seule commande annulable :

```text
Ctrl+Z = annuler toute la proposition
```

---

# 16. Niveau "intention de conception"

Ne pas exiger toutes les données immédiatement.

Permettre :

```text
Tuyau non dimensionné
Câble non dimensionné
Gaine provisoire
Équipement générique
Circuit sans protection définie
```

Ces objets restent valides au stade conception mais clairement marqués :

```text
○ provisoire
⚠ donnée manquante
✓ dimensionné
```

Les calculs doivent répondre `PARTIAL` plutôt qu'obliger l'utilisateur à inventer une donnée.

---

# 17. Systèmes verticaux et multi-niveaux

Le réseau doit devenir facile à comprendre entre étages.

À prévoir :

- colonne montante ;
- gaine technique ;
- chute ;
- riser ;
- traversée de dalle ;
- raccordement vertical automatique entre niveaux ;
- sélection "même emplacement étage supérieur".

Vue de coupe/riser générée automatiquement.

---

# 18. Réservations et coordination

À terme chaque route technique doit produire une enveloppe géométrique.

Utilisations :

- clash réseau/réseau ;
- clash réseau/structure ;
- percement mur ;
- percement dalle ;
- réservation ;
- gaine technique saturée ;
- espace maintenance.

Fonction future :

```text
Créer les réservations nécessaires
```

avec validation avant insertion.

---

# 19. Tables dérivées universelles

Pour chaque système, fournir une vue tableau cohérente.

## Exemple

```text
Éléments | Systèmes | Tronçons | Calculs | Problèmes
```

Chaque ligne doit pouvoir :

- localiser sur plan ;
- ouvrir le schéma ;
- ouvrir l'inspecteur ;
- sélectionner tous les objets associés.

Les tables ne doivent jamais devenir un second modèle à maintenir manuellement.

---

# 20. Documentation automatique

À partir du modèle final :

## Architecture

- plans ;
- coupes ;
- façades ;
- surfaces.

## Électricité

- implantation ;
- schéma unifilaire ;
- tableau des circuits ;
- nomenclature.

## Eau

- implantation EF/ECS ;
- schéma de distribution ;
- nomenclature.

## Évacuation

- implantation ;
- riser ;
- pentes/diamètres.

## Chauffage

- implantation ;
- schéma hydraulique ;
- puissance par pièce ;
- équilibrage.

## Ventilation

- implantation ;
- schéma ;
- débits ;
- dimensionnement.

## PV

- implantation toiture ;
- strings ;
- unifilaire ;
- bilan énergétique.

---

# 21. Interopérabilité future

Après stabilisation de l'édition interne :

- IFC import/export ;
- DXF/DWG via format intermédiaire si pertinent ;
- CSV de nomenclatures ;
- JSON métier documenté ;
- import catalogues fabricants ;
- export schémas SVG/PDF ;
- export listes de câbles/tuyaux ;
- échange BCF ou format équivalent pour problèmes.

Ce bloc reste secondaire par rapport à l'efficacité de conception interne.

---

# 22. Priorités proposées

## P0 — Fondations transversales

1. formaliser système logique vs route physique ;
2. ajouter `SCHEMATIC` aux vues documentaires ;
3. moteur générique de graphe schématique ;
4. actions "créer système depuis sélection" ;
5. infrastructure de propositions de routes ;
6. état de santé d'un système.

## P1 — Électricité complète

1. gestionnaire de circuits ;
2. création de circuit depuis sélection ;
3. tableau électrique ;
4. schéma unifilaire ;
5. protections/sections suggérées ;
6. chute de tension visible ;
7. relations interrupteur/luminaire.

## P2 — Eau + évacuation

1. création de réseau depuis appareils ;
2. collecteur/tronc/boucle ;
3. dimensionnement automatique ;
4. routage assisté ;
5. schéma distribution ;
6. riser évacuation.

## P3 — Chauffage + ventilation

1. modèle hydraulique chauffage ;
2. sélection automatique d'émetteurs ;
3. circuits aller/retour ;
4. plancher chauffant ;
5. schéma hydraulique ;
6. ventilation par pièce ;
7. équilibrage.

## P4 — Énergie et réseaux spécialisés

- PV ;
- stockage ;
- eaux pluviales ;
- data ;
- sécurité ;
- conduits de fumée.

## P5 — Coordination avancée

- auto-routing multi-réseaux ;
- réservation ;
- clash ;
- optimisation de passage ;
- dimensionnement global ;
- comparaison de variantes techniques.

---

# 23. Critères d'architecture à préserver

Toute nouvelle évolution doit respecter :

1. aucun nouvel onglet principal au-delà des 7 espaces ;
2. aucune duplication entre plan et schéma ;
3. aucune valeur calculée persistée comme vérité ;
4. aucune obligation de tout renseigner pour dessiner ;
5. toute automatisation doit être prévisualisable ;
6. toute automatisation doit être annulable en une opération ;
7. les systèmes restent éditables manuellement après génération ;
8. les ports et compatibilités restent la base des connexions ;
9. les catalogues fournissent les données sans imposer leur UI interne ;
10. les documents restent dérivés du modèle.

---

# 24. Critères d'acceptation produit

### Électricité

Un utilisateur doit pouvoir :

- poser un tableau et 10 prises ;
- créer 2 circuits sans manipuler d'identifiants de ports ;
- obtenir automatiquement un tableau de circuits ;
- ouvrir un schéma unifilaire cohérent ;
- retrouver chaque élément du schéma sur le plan.

### Eau

Un utilisateur doit pouvoir :

- sélectionner 5 appareils sanitaires ;
- créer EF/ECS ;
- choisir "collecteur" ;
- obtenir un réseau logique ;
- accepter un routage proposé ;
- lancer le dimensionnement ;
- obtenir un schéma de distribution.

### Chauffage

Après calcul des besoins :

- sélectionner plusieurs pièces ;
- obtenir une proposition d'émetteurs ;
- créer un circuit ;
- générer le schéma hydraulique ;
- identifier immédiatement les pièces insuffisamment chauffées.

---

# 25. Conclusion

La prochaine génération de Mini-BIM doit évoluer de :

```text
"je dessine des objets et des tronçons"
```

vers :

```text
"je décris ce que je veux alimenter,
Mini-BIM structure le système,
je valide le routage et le dimensionnement,
les documents se génèrent automatiquement."
```

Le meilleur premier démonstrateur est l'électricité, car son modèle sémantique est déjà suffisamment riche. Une fois la chaîne `plan → circuit → route → calcul → schéma → document` validée, elle doit devenir le patron commun pour l'eau, l'évacuation, le chauffage, la ventilation, le solaire et les autres disciplines.
