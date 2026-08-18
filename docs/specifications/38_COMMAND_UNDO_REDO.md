# 38 — Commandes, transactions, Undo / Redo

> **Paquet cible :** `packages/editor-core`

## 1. Principe

Toute mutation utilisateur passe par une commande.

Interdit dans l'UI :

```ts
project.walls.push(...)
wall.x = ...
```

Préférer :

```ts
dispatch(new AddWallCommand(...))
```

## 2. Contrat

```ts
interface EditorCommand {
  id: string;
  label: string;

  validate(ctx: CommandContext): CommandValidation;
  execute(state: ProjectState): CommandExecution;
}
```

`execute` produit idéalement :

```ts
interface CommandExecution {
  nextState: ProjectState;
  inverse: EditorCommand;
  changes: ChangeSet;
}
```

## 3. Inverse

Exemples :

```text
AddWall ↔ DeleteWall
MoveWall ↔ MoveWall(old position)
SetAssembly ↔ SetAssembly(previous)
ConnectPorts ↔ DisconnectPorts
```

## 4. Transaction

Une action UI peut produire plusieurs modifications atomiques.

Exemple insertion porte :

```text
create Opening
attach to Wall
invalidate Space boundaries
invalidate quantities
```

Undo doit annuler l'ensemble.

## 5. ChangeSet

```ts
interface ChangeSet {
  objectIds: string[];
  domains: string[];
  paths?: string[];
}
```

Il sert à :

- recalcul dérivé ;
- moteur de calcul ;
- rendu ;
- autosave.

## 6. Commandes initiales

Architecture :

```text
AddWall
MoveWallVertex
MoveWall
DeleteWall
SetWallAssembly
AddOpening
MoveOpening
DeleteOpening
AddSlab
AddSpace
RenameSpace
```

Matériaux :

```text
CreateMaterial
UpdateCustomMaterial
CreateAssembly
UpdateAssembly
```

Réseaux :

```text
AddNetwork
AddNode
AddEdge
MoveNode
ConnectPorts
DisconnectPorts
DeleteNetworkObject
```

## 7. Prévisualisation

Le dessin interactif peut utiliser un état temporaire :

```text
EditorTransientState
```

La commande n'est commitée qu'à validation.

Ainsi déplacer la souris ne crée pas 500 commandes.

## 8. Fusion

Les commandes répétitives peuvent fusionner :

```text
typing name
dragging point
incrementing numeric field
```

La politique doit être explicite.

## 9. Limite historique

L'historique peut être borné en mémoire.

Le format projet n'a pas besoin de sauvegarder tout l'historique Undo/Redo.

## 10. Autosave

Autosave sauvegarde `ProjectState`, pas l'état transitoire.

## 11. Échec

Une commande invalide ne modifie rien.

Une transaction partiellement appliquée est interdite.

## 12. Collaboration future

Cette architecture prépare :

- journal d'opérations ;
- synchro ;
- audit ;

sans imposer CRDT/OT au MVP.

## 13. Tests

- execute/inverse restitue état initial ;
- transaction atomique ;
- commande invalide sans mutation ;
- fusion de drag ;
- Undo réseau ;
- suppression avec dépendances ;
- ChangeSet correct.

## 14. Critère MVP

Créer une pièce, ajouter une fenêtre, déplacer un mur puis faire Undo quatre fois doit revenir exactement à l'état initial.
