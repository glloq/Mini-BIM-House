# 31 — Schéma générique des réseaux techniques

> **Paquet cible :** `packages/core-domain/networks`

## 1. Objectif

Fournir une structure commune pour :

- eau ;
- ECS ;
- évacuation ;
- ventilation ;
- chauffage hydraulique ;
- électricité ;
- récupération d'eau ;
- futurs réseaux.

La physique reste dans les modules métier.

## 2. Graphe générique

```ts
interface TechnicalNetwork {
  id: string;
  discipline: NetworkDiscipline;
  systemType: string;
  nodeIds: string[];
  edgeIds: string[];
  metadata?: Record<string, unknown>;
}
```

## 3. Nœud

```ts
interface NetworkNode {
  id: string;
  networkId: string;
  kind: string;
  position: Point3D;
  portIds: string[];
  hostObjectId?: string;
  spaceId?: string;
}
```

## 4. Port

Les connexions doivent idéalement se faire port à port.

```ts
interface NetworkPort {
  id: string;
  nodeId: string;
  role: string;
  direction: "IN" | "OUT" | "BIDIRECTIONAL";
  connectionType?: string;
  nominalSize?: number;
}
```

Cela permet de vérifier des incompatibilités avant le calcul.

## 5. Arête / tronçon

```ts
interface NetworkEdge {
  id: string;
  networkId: string;
  fromPortId: string;
  toPortId: string;
  path: Point3D[];
  kind: string;
  catalogItemId?: string;
}
```

Les propriétés spécifiques restent dans des extensions métier.

## 6. Extensions

Exemple :

```ts
interface WaterEdgeProperties {
  internalDiameterM: number;
  roughnessM?: number;
}

interface DuctEdgeProperties {
  shape: "ROUND" | "RECTANGULAR";
  diameterM?: number;
  widthM?: number;
  heightM?: number;
}

interface ElectricalEdgeProperties {
  conductorSectionMm2: number;
  conductorCount: number;
}
```

## 7. Topologie

Le moteur générique fournit :

- connectivité ;
- composantes connexes ;
- chemins ;
- cycles ;
- racines/sources ;
- terminaux ;
- plus court chemin géométrique si nécessaire ;
- parcours topologique quand le graphe le permet.

## 8. Réseaux cycliques

Ne pas supposer que tous les réseaux sont des arbres.

Exemples :

- bouclage ECS ;
- chauffage ;
- anneaux électriques spécialisés.

Les solveurs physiques indiquent les topologies qu'ils supportent.

## 9. Géométrie

Chaque tronçon possède une polyligne 3D.

MVP UI :

- dessin 2D sur niveau ;
- `z` dérivé du niveau et d'un offset ;
- changements de niveau via nœuds verticaux.

## 10. Connexion aux équipements

Un équipement expose des ports compatibles.

```text
equipment port
    ↕
network port
```

Le réseau ne doit pas connaître les détails internes de l'équipement.

## 11. Routage

Le schéma doit supporter :

```text
MANUAL
ASSISTED
AUTO
```

Le MVP utilise `MANUAL/ASSISTED`.

## 12. Collisions

Chaque tronçon doit pouvoir produire un volume approximatif de réservation.

Cela permettra :

- collision entre réseaux ;
- collision structure ;
- passage dans mur/dalle ;
- réservations.

## 13. État de calcul

Ne pas persister comme vérité :

- débit ;
- pression ;
- courant ;
- vitesse ;
- pertes.

Ces données sont des résultats de modules.

## 14. Validation générique

```text
NETWORK_ORPHAN_PORT
NETWORK_DISCONNECTED_EDGE
NETWORK_INVALID_PATH
NETWORK_INCOMPATIBLE_PORTS
NETWORK_DUPLICATE_CONNECTION
NETWORK_MISSING_SOURCE
```

## 15. Schéma JSON

Créer :

```text
schemas/network.schema.json
```

## 16. Tests

- connexion port à port ;
- déconnexion ;
- détection des composantes ;
- cycle ;
- chemin source-terminal ;
- persistance de la géométrie ;
- suppression d'un équipement et diagnostic des ports orphelins.

## 17. Critère MVP

Un même éditeur de réseau doit pouvoir tracer un tuyau EF et une gaine VMC en réutilisant l'infrastructure topologique, avec des propriétés physiques différentes.
