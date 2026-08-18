# 11 — Project File Format

> **Objectif :** définir le contrat de sérialisation du projet, sa compatibilité dans le temps et les règles de migration.
> **Extension recommandée :** `.houseproj.json`
> **Principe :** un fichier projet doit rester lisible, diffable, validable et migrable sans dépendre de l’interface graphique.

---

## 1. Exigences fondamentales

Le format projet doit :

- être du JSON UTF-8 valide ;
- être autonome pour les données propres au projet ;
- référencer explicitement les catalogues externes utilisés ;
- contenir une version de schéma obligatoire ;
- conserver des identifiants stables ;
- permettre des migrations déterministes ;
- ne jamais stocker de données dérivées comme source de vérité ;
- permettre une validation machine par JSON Schema ;
- rester exploitable sans serveur.

---

## 2. Racine du document

```ts
interface ProjectFile {
  format: 'house-technical-designer-project';
  schemaVersion: string;
  applicationVersion?: string;
  project: Project;
  references?: ExternalReferenceManifest;
  extensions?: Record<string, unknown>;
}
```

Exemple :

```json
{
  "format": "house-technical-designer-project",
  "schemaVersion": "1.0.0",
  "applicationVersion": "0.1.0",
  "project": {},
  "references": {},
  "extensions": {}
}
```

---

## 3. Versionnement

`schemaVersion` utilise Semantic Versioning :

- **MAJOR** : incompatibilité structurelle nécessitant migration ;
- **MINOR** : ajout rétrocompatible ;
- **PATCH** : correction documentaire ou contrainte de validation compatible.

Le logiciel doit refuser silencieusement aucune version inconnue.

Comportements :

- version supportée → ouverture normale ;
- version ancienne migrable → migration proposée/exécutée avec journal ;
- version plus récente inconnue → ouverture en lecture seule si possible, sinon erreur explicite.

---

## 4. Identifiants

Tous les objets persistants possèdent un `id` unique dans le projet.

Format recommandé : UUID v4 ou identifiant équivalent suffisamment unique.

Règles :

- l’ID ne change pas lors d’un déplacement ou d’une modification ;
- un duplicata reçoit un nouvel ID ;
- une migration préserve les IDs existants ;
- les références croisées utilisent uniquement les IDs.

---

## 5. Données persistées et données dérivées

### Persistées

- géométrie de référence ;
- matériaux du projet ;
- assemblages ;
- paramètres des équipements ;
- réseaux ;
- scénarios ;
- paramètres utilisateur liés au projet ;
- vues enregistrées ;
- contexte réglementaire choisi.

### Non persistées comme vérité

- surfaces calculées ;
- volumes calculés ;
- U de paroi calculé ;
- débit résultant ;
- pertes de charge ;
- listes de matériaux calculées ;
- cartes thermiques ;
- résultats de conformité.

Ces données peuvent être mises en cache, mais doivent être invalidables et recalculables.

---

## 6. Références de catalogues

Un projet peut utiliser :

- un matériau embarqué dans le projet ;
- un matériau du catalogue générique ;
- un produit externe identifié ;
- une copie figée d’une entrée externe.

Structure recommandée :

```ts
interface CatalogReference {
  catalogId: string;
  catalogVersion: string;
  entityId: string;
  snapshot?: unknown;
}
```

Pour garantir la reproductibilité, les propriétés utilisées pour un calcul important doivent pouvoir être figées dans un `snapshot` de projet.

---

## 7. Contexte réglementaire

```ts
interface RegulatoryContext {
  country: string;
  region?: string;
  projectType?: string;
  referenceDate?: string;
  enabledRulePacks: RulePackReference[];
}
```

La date de référence doit permettre d’évaluer les règles applicables à la période du projet.

---

## 8. Extensions

Le champ `extensions` permet à des modules additionnels de persister des données sans modifier immédiatement le noyau.

Convention de clé :

```text
<vendor-or-project>.<module>
```

Exemple :

```json
{
  "extensions": {
    "htd.experimental-greenhouse": {
      "enabled": true
    }
  }
}
```

Une extension ne doit jamais modifier la signification d’un champ standard.

---

## 9. Migrations

Chaque migration est une fonction pure :

```ts
interface ProjectMigration {
  from: string;
  to: string;
  migrate(input: unknown): unknown;
}
```

Règles :

- une migration ne dépend pas de React ;
- aucune migration ne dépend du réseau ;
- les migrations sont chaînables ;
- chaque migration a des fixtures avant/après ;
- le fichier original n’est jamais écrasé avant validation de la migration.

---

## 10. Sauvegarde sûre

Flux recommandé :

1. sérialiser ;
2. valider contre le schéma ;
3. recalculer le hash optionnel ;
4. écrire le nouveau fichier ;
5. seulement ensuite considérer la sauvegarde comme réussie.

Le logiciel ne doit jamais produire un fichier partiellement valide sans avertissement.

---

## 11. Données temporelles

Dates : ISO 8601.

Exemple :

```json
"createdAt": "2026-08-18T20:30:00Z"
```

Les dates métier sensibles aux règles doivent être conservées distinctement des dates de fichier.

---

## 12. Unités

Les unités ne doivent pas être ambiguës.

Deux stratégies sont autorisées :

### Champs nommés avec unité

```json
{
  "heightMm": 2500,
  "powerW": 1200
}
```

### Quantité typée

```json
{
  "value": 2.5,
  "unit": "m"
}
```

Le noyau doit définir une convention unique par famille de données.

---

## 13. Tolérance aux champs inconnus

Le lecteur doit ignorer les champs inconnus compatibles lors d’une évolution mineure, tout en les préservant si possible lors d’un round-trip.

Les validations strictes sont réservées aux objets critiques nécessitant une structure fermée.

---

## 14. Fichier minimal

Un projet minimal doit pouvoir contenir :

- métadonnées ;
- un site ;
- un bâtiment ;
- un niveau ;
- aucun mur ;
- aucun module technique.

Le fichier `examples/minimal.houseproj.json` sert de fixture de référence.

---

## 15. JSON Schema

Le schéma racine est placé dans :

```text
schemas/project.schema.json
```

Il devient une source contractuelle pour :

- validation import/export ;
- tests ;
- génération de types auxiliaires ;
- documentation ;
- compatibilité entre versions.

---

## 16. Critères d’acceptation

Le format projet est considéré stable pour le MVP lorsque :

- un projet peut être exporté/importé sans perte ;
- le round-trip est testé ;
- les références sont résolues ;
- une migration de démonstration fonctionne ;
- les fichiers invalides produisent des erreurs localisées ;
- la version du schéma est obligatoire ;
- les données calculées restent recalculables.
