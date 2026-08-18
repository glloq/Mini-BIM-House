# 34 — Bibliothèque de symboles et conventions graphiques

> **Paquet cible :** `packages/drawing-engine/symbols`

## 1. Objectif

Obtenir des plans lisibles et techniquement cohérents tout en permettant :

- profils français ;
- profils internationaux ;
- variantes d'entreprise ;
- symboles utilisateur.

## 2. Principe

Un symbole n'est pas un SVG arbitraire.

```text
semantic symbol
      ↓
symbol definition
      ↓
graphic profile
      ↓
SVG primitives
```

## 3. Définition

```ts
interface SymbolDefinition {
  id: string;
  semanticType: string;
  discipline: string;
  viewBox: Box2D;
  anchors: SymbolAnchor[];
  primitives: SymbolPrimitive[];
  scaleRules: SymbolScaleRules;
  references?: SymbolReference[];
}
```

## 4. Primitives autorisées

```text
LINE
POLYLINE
POLYGON
CIRCLE
ARC
TEXT
PATH_RESTRICTED
```

Éviter le HTML/SVG libre injecté.

## 5. Échelle papier

Les symboles techniques doivent être lisibles à l'impression.

Deux espaces :

```text
MODEL_SPACE   mètres
PAPER_SPACE   millimètres imprimés
```

Certains symboles utilisent une taille papier quasi constante.

## 6. Styles sémantiques

Exemples :

```text
ARCH_WALL_CUT
ARCH_WALL_VISIBLE
DIMENSION_LINE
DIMENSION_TEXT
WATER_COLD
WATER_HOT
WASTEWATER
VENT_SUPPLY
VENT_EXHAUST
ELECTRICAL_POWER
ELECTRICAL_CONTROL
LIGHTING
PV_DC
PV_AC
WARNING
```

Les styles concrets appartiennent à un `GraphicProfile`.

## 7. Profils graphiques

```ts
interface GraphicProfile {
  id: string;
  locale?: string;
  lineStyles: Record<string, LineStyle>;
  textStyles: Record<string, TextStyle>;
  hatchStyles: Record<string, HatchStyle>;
  symbolOverrides?: Record<string, string>;
}
```

## 8. Conventions

La stratégie graphique doit rester proche des conventions du dessin technique et architectural :

- hiérarchie des épaisseurs ;
- éléments coupés plus forts que vus ;
- traits de cote distincts ;
- hachures matériaux ;
- symboles de réseaux différenciés ;
- cartouche et échelles explicites.

Références structurantes prévues dans le registre :

- série ISO 128 ;
- ISO 129-1 pour cotation ;
- ISO 5455 pour échelles ;
- ISO 5457 pour formats de feuilles ;
- ISO 7200 pour cartouches ;
- ISO 13567 pour organisation de calques.

La conformité exacte dépend du profil et de sa validation.

## 9. Discipline architecture

Symboles initiaux :

- porte simple ;
- porte double ;
- fenêtre ;
- escalier ;
- niveau ;
- coupe ;
- nord ;
- repère de pièce.

## 10. Eau / évacuation

- appareil sanitaire ;
- vanne ;
- pompe ;
- ballon ;
- collecteur ;
- regard ;
- descente ;
- sens de flux.

## 11. Ventilation

- bouche soufflage ;
- extraction ;
- transfert ;
- VMC ;
- ventilateur ;
- filtre ;
- registre.

## 12. Électricité

- prise ;
- interrupteur ;
- point lumineux ;
- tableau ;
- équipement spécialisé.

Les symboles réglementaires/professionnels éventuellement protégés doivent être vérifiés avant redistribution.

## 13. Hachures matériaux

Les matériaux portent un `hatchId`, pas une hachure directement.

La bibliothèque peut contenir :

```text
concrete
masonry
wood
insulation
earth
metal
glass
generic-solid
```

## 14. Légende automatique

Le moteur analyse les symboles/styles utilisés et génère une légende :

```text
symbole
nom
type
éventuelle référence
```

## 15. Personnalisation utilisateur

L'utilisateur peut créer un symbole avec les primitives autorisées.

Il doit choisir :

- type sémantique ;
- discipline ;
- taille ;
- points de connexion ;
- styles.

## 16. Tests

Golden tests SVG pour :

- chaque symbole ;
- chaque profil ;
- plusieurs échelles ;
- dark mode écran vs feuille blanche ;
- impression PDF.

## 17. Critère MVP

Un même plan doit pouvoir basculer entre `ARCHITECTURE`, `PLUMBING`, `VENTILATION` et `ELECTRICAL` sans modifier les objets métier.
