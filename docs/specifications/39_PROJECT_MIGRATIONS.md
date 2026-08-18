# 39 — Migrations du format projet

> **Paquet cible :** `packages/project-io`

## 1. Objectif

Permettre au projet d'évoluer sans casser les fichiers utilisateurs.

## 2. Version

Chaque fichier contient :

```json
{
  "schemaVersion": "1.0.0"
}
```

La version du logiciel est distincte.

## 3. Pipeline

```text
raw JSON
  ↓
detect version
  ↓
validate old schema if available
  ↓
migrate step by step
  ↓
validate current schema
  ↓
domain model
```

## 4. Migrations séquentielles

```text
1.0.0 → 1.1.0
1.1.0 → 1.2.0
1.2.0 → 2.0.0
```

Ne pas écrire une migration directe `1.0 → latest` unique.

## 5. Pureté

```ts
interface ProjectMigration {
  from: string;
  to: string;
  migrate(input: unknown): unknown;
}
```

Une migration :

- ne fait pas d'accès réseau ;
- ne dépend pas de l'heure ;
- ne modifie pas le fichier source ;
- est déterministe.

## 6. Données perdues

Si une migration supprime une donnée, le changement doit être documenté.

Préférer conserver dans :

```text
legacy
extensions
metadata
```

quand cela est raisonnable.

## 7. Catalogue externe

Une migration ne doit pas exiger qu'un produit fabricant existe encore en ligne.

Les projets doivent contenir assez d'information/snapshot pour rester ouvrables.

## 8. Forward compatibility

Si un fichier est plus récent que le logiciel :

```text
UNSUPPORTED_FUTURE_SCHEMA
```

Ne pas tenter de l'ouvrir en modifiant les données.

Une lecture partielle future peut être ajoutée explicitement.

## 9. Sauvegarde

Avant migration persistée :

- conserver l'original ;
- proposer export backup ;
- écrire le nouveau fichier séparément côté navigateur si nécessaire.

## 10. Tests fixtures

Dossier :

```text
tests/migrations/
├── v1.0.0/
├── v1.1.0/
└── ...
```

Chaque fixture ancienne doit migrer jusqu'à la version courante.

## 11. Snapshot

Après migration :

```text
old fixture
→ migration
→ canonical normalized JSON
```

Comparer à un snapshot attendu.

## 12. Numérotation

Patch :

- correction compatible de schéma.

Minor :

- ajout optionnel.

Major :

- changement structurel/incompatible nécessitant migration.

## 13. Migrations de Rule Packs/catalogues

Elles ont leur propre versionnement.

Ne pas coupler automatiquement :

```text
project schema
rule pack version
material catalog version
```

## 14. Tests

- identité pour version courante ;
- chaîne complète ;
- migration déterministe ;
- fichier futur rejeté ;
- référence inconnue conservée/diagnostiquée ;
- aucun nombre `NaN/Infinity`.

## 15. Critère MVP

Une fixture `0.x` volontairement ancienne doit être migrée automatiquement vers `1.0.0` et produire exactement le projet attendu.
