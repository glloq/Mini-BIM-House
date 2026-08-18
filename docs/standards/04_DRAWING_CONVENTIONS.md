# 04 — Drawing Conventions

> **Objectif :** définir une stratégie graphique technique cohérente pour les plans, coupes, réseaux et exports.  
> **Important :** ce document fixe les conventions internes du logiciel. Il s’inspire des normes de dessin technique et de construction, mais ne doit pas être présenté comme une reproduction exhaustive d’un corpus normatif protégé.

---

## 1. Principes

Les plans doivent être :

- lisibles ;
- cohérents ;
- imprimables ;
- vectoriels ;
- indépendants du thème UI ;
- adaptés aux conventions techniques ;
- configurables par profil graphique.

Les couleurs de l’interface ne remplacent jamais les conventions de traits nécessaires à l’impression noir et blanc.

---

## 2. Références de conception

Les conventions internes doivent être conçues en cohérence avec les familles de normes suivantes :

- ISO 128 — principes généraux de représentation et types de traits ;
- ISO 129-1 — présentation des dimensions et tolérances ;
- ISO 5455 — échelles ;
- ISO 5457 — formats et présentation des feuilles de dessin ;
- ISO 7200 — champs de données des cartouches et en-têtes ;
- ISO 13567-1 / ISO 13567-2 — organisation et dénomination des calques CAD ;
- standards ou conventions nationales spécifiques à chaque discipline lorsqu’un module les implémente.

Ces références doivent être versionnées dans `standards-registry`.

---

## 3. Échelle logique

Le modèle est toujours dessiné à l’échelle réelle.

L’échelle existe uniquement au niveau de la vue ou de la feuille.

Exemples :

```text
1:20
1:50
1:100
1:200
```

Les tailles de texte, symboles et traits doivent être exprimées en taille papier puis converties automatiquement vers la taille modèle.

---

## 4. Poids de traits

Définir des rôles et non des valeurs SVG directes.

```text
LINE_ULTRA_THIN
LINE_THIN
LINE_MEDIUM
LINE_THICK
LINE_CUT
```

Profil papier initial possible :

```text
ULTRA_THIN  → 0.13 mm
THIN        → 0.18 mm
MEDIUM      → 0.25 mm
THICK       → 0.35 mm
CUT         → 0.50 mm
```

Ces valeurs sont des paramètres de profil, pas des constantes métier.

---

## 5. Types de traits

Rôles minimaux :

```text
CONTINUOUS
DASHED
CHAIN
CENTERLINE
HIDDEN
PHANTOM
BREAK
```

Les motifs sont définis en unités papier afin de rester identiques à l’impression quelle que soit l’échelle.

---

## 6. Hiérarchie graphique architecturale

### Élément coupé

Le plus fort visuellement.

Exemple : mur traversé par le plan de coupe.

### Élément vu

Trait intermédiaire.

Exemple : ouverture ou équipement sous le plan de coupe.

### Élément secondaire

Trait fin.

Exemple : mobilier, détails non structurels.

### Annotation

Trait fin et texte dédié.

---

## 7. Mur en plan

Le rendu dépend de la vue.

### Vue architecturale simple

- contour des faces ;
- remplissage ou hachure simplifiée ;
- ouvertures découpées.

### Vue matériaux

- chaque couche peut être visible ;
- hachures distinctes ;
- épaisseurs réelles.

### Vue réseau

- bâtiment en arrière-plan atténué ;
- réseau prioritaire.

---

## 8. Hachures matériaux

Le moteur ne doit pas associer définitivement une seule hachure à un matériau.

Utiliser :

```text
Material → semantic hatch category → graphic profile → SVG pattern
```

Catégories initiales :

```text
CONCRETE
MASONRY
STONE
WOOD
INSULATION
EARTH
METAL
GLASS
GYPSUM
MEMBRANE
AIR_GAP
GENERIC_SOLID
GENERIC_VOID
```

Le catalogue matériau peut suggérer une catégorie mais l’utilisateur peut la modifier.

---

## 9. Couleurs analytiques

Les couleurs servent aux analyses dynamiques :

- thermique ;
- pertes ;
- débit ;
- pression ;
- lux ;
- bruit ;
- conformité.

Une vue analytique doit toujours fournir :

- légende ;
- unité ;
- plage ;
- origine du calcul.

Ne jamais utiliser une couleur seule pour signifier une information critique : ajouter symbole, texte ou motif.

---

## 10. Cotation

Types nécessaires :

- linéaire ;
- alignée ;
- angulaire ;
- rayon ;
- diamètre ;
- niveau ;
- coordonnées.

Une cotation est attachée à des références géométriques lorsque possible.

Exemple : une cote entre deux faces de mur doit suivre le déplacement de ces murs.

---

## 11. Chaînes de cotes architecturales

Prévoir plusieurs rangs de cotes :

1. ouvertures et détails ;
2. axes / murs ;
3. dimensions globales.

L’utilisateur doit pouvoir déplacer manuellement une ligne de cote sans rompre ses références.

---

## 12. Textes

Les styles de texte sont sémantiques :

```text
TEXT_NOTE
TEXT_DIMENSION
TEXT_ROOM_NAME
TEXT_ROOM_AREA
TEXT_LEVEL
TEXT_TITLE
TEXT_WARNING
TEXT_REFERENCE
```

Les hauteurs sont paramétrées en millimètres papier.

---

## 13. Noms et surfaces des pièces

Bloc recommandé :

```text
CUISINE
14.2 m²
```

Options supplémentaires :

- volume ;
- finition de sol ;
- numéro de local ;
- température cible ;
- débit de ventilation.

Le contenu dépend de la vue.

---

## 14. Portes

Le symbole doit représenter :

- baie ;
- vantail ;
- sens d’ouverture ;
- angle d’ouverture conventionnel.

Propriétés affichables :

- largeur ;
- hauteur ;
- référence ;
- performance thermique/acoustique.

---

## 15. Fenêtres

En plan :

- baie ;
- cadre simplifié ;
- vitrage ;
- sens d’ouverture si utile.

En élévation :

- dormant ;
- ouvrants ;
- allège ;
- linteau ;
- repère.

---

## 16. Coupes

Dans une coupe :

- éléments coupés : trait fort ;
- éléments vus : trait plus fin ;
- matériaux coupés : hachures ;
- terrain : représentation dédiée ;
- niveaux : repères ;
- hauteur sous plafond : cotation possible.

---

## 17. Façades

Les façades doivent afficher :

- ouvertures ;
- contours visibles ;
- niveaux ;
- toiture ;
- terrain ;
- repères de matériaux si demandé.

---

## 18. Réseaux eau

Créer des rôles graphiques sémantiques :

```text
WATER_COLD
WATER_HOT
WATER_RECIRCULATION
WASTEWATER
SOIL_WATER
RAINWATER
RAINWATER_REUSE
```

Le profil graphique décide :

- couleur écran ;
- type de trait ;
- épaisseur ;
- symbole ;
- représentation N&B.

---

## 19. Ventilation

Rôles :

```text
VENT_SUPPLY
VENT_EXHAUST
VENT_TRANSFER
VENT_OUTDOOR_AIR
VENT_DISCHARGE
```

Afficher selon le niveau de détail :

- axe de gaine ;
- largeur réelle ;
- sens de flux ;
- section ;
- débit ;
- bouche ;
- équipement.

---

## 20. Électricité

La représentation doit distinguer :

- puissance ;
- éclairage ;
- commande ;
- communication ;
- photovoltaïque ;
- terre / liaison équipotentielle lorsqu’elle est modélisée.

Les symboles sont issus d’une bibliothèque versionnée et doivent rester remplaçables par profil national.

---

## 21. Chauffage

Rôles :

```text
HEATING_SUPPLY
HEATING_RETURN
UNDERFLOOR_HEATING
RADIATOR
HEAT_PUMP
BOILER
BUFFER_TANK
```

Les plans doivent pouvoir afficher :

- diamètres ;
- puissances ;
- températures ;
- sens de circulation.

---

## 22. Photovoltaïque

Afficher :

- modules ;
- orientation ;
- inclinaison ;
- strings ;
- onduleur ;
- batterie ;
- circuits DC/AC ;
- zones non exploitables.

---

## 23. Calques

La structure interne de calques doit être sémantique.

Exemple :

```text
A-WALL-CUT
A-WALL-VIEW
A-DOOR
A-WINDOW
P-COLD-WATER
P-HOT-WATER
V-SUPPLY
V-EXHAUST
E-POWER
E-LIGHT
H-SUPPLY
H-RETURN
```

Le nom final exporté peut être généré selon un profil compatible avec une convention CAD donnée.

Ne pas figer les codes directement dans les objets.

---

## 24. Discipline codes internes

Proposition interne simple :

```text
A = Architecture
S = Structure
T = Thermal
P = Plumbing
V = Ventilation
H = Heating
E = Electrical
L = Lighting
C = Acoustics
PV = Photovoltaic
R = Rainwater
```

Ces codes sont internes et peuvent être mappés vers d’autres conventions à l’export.

---

## 25. Feuilles

Une `Sheet` contient :

- format ;
- orientation ;
- marges ;
- cartouche ;
- plusieurs viewports ;
- légendes ;
- notes.

Formats courants à prévoir :

```text
A4
A3
A2
A1
A0
CUSTOM
```

---

## 26. Cartouche

Champs possibles :

- projet ;
- titre du dessin ;
- numéro ;
- révision ;
- date ;
- auteur ;
- échelle ;
- unité ;
- statut ;
- références.

Le cartouche doit être templatable.

---

## 27. Légendes

Toute vue métier doit pouvoir générer sa propre légende automatiquement à partir des éléments réellement visibles.

Exemples :

- matériaux ;
- réseaux ;
- symboles électriques ;
- plages thermiques ;
- résultats acoustiques.

---

## 28. Export SVG

L’export SVG doit conserver :

- groupes sémantiques ;
- ids stables lorsque possible ;
- styles ;
- textes ;
- patterns ;
- metadata de base.

Éviter de convertir prématurément le texte en chemins.

---

## 29. Export PDF

Le PDF doit être généré depuis la même scène vectorielle que le SVG afin d’éviter les divergences graphiques.

Le rendu doit être testé sur :

- écran ;
- impression couleur ;
- impression noir et blanc.

---

## 30. Références officielles utiles

- ISO 128-1:2020 — Technical product documentation — General principles of representation — Part 1: Introduction and fundamental requirements: https://www.iso.org/standard/65296.html
- ISO 128-2:2020 — Basic conventions for lines: https://www.iso.org/standard/69129.html
- ISO 129-1:2018 — Presentation of dimensions and tolerances — Part 1: General principles: https://www.iso.org/standard/64007.html
- ISO 13567-1:2017 — Organization and naming of layers for CAD — Part 1: Overview and principles: https://www.iso.org/standard/70181.html
- ISO 13567-2:2017 — Organization and naming of layers for CAD — Part 2: Concepts, format and codes used in construction documentation: https://www.iso.org/standard/70182.html

Ces pages sont des références de cadrage. L’implémentation détaillée d’une norme nécessite l’accès légal au texte normatif complet lorsque celui-ci n’est pas librement diffusé.
