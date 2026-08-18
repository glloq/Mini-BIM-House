# Validation report

## JSON Schemas et fixtures

- `minimal.houseproj.json` → `project.schema.json`: OK
- `material.example.json` → `material.schema.json`: OK
- `assembly.example.json` → `assembly.schema.json`: OK
- `rule-pack.example.json` → `rule-pack.schema.json`: OK
- `calculation-result.example.json` → `calculation-result.schema.json`: OK
- `symbol.example.json` → `symbol.schema.json`: OK
- `geometry.example.json` → `geometry.schema.json`: OK
- `building-element.example.json` → `building-element.schema.json`: OK
- `network.example.json` → `network.schema.json`: OK
- `climate.example.json` → `climate.schema.json`: OK
- `equipment.example.json` → `equipment.schema.json`: OK
- `scenario.example.json` → `scenario.schema.json`: OK
- `module-settings.example.json` → `module-settings.schema.json`: OK

## Contrôle d'unité

- géométrie d'édition : millimètres (`ADR-0003`) ;
- calculs physiques : SI ;
- coordonnées `Point2D{x,y}` / `Point3D{x,y,z}` : valeurs en millimètres ;
- dimensions de bâtiment persistées : suffixe `Mm` lorsque le champ n'est pas un type géométrique.

## Résultat

- erreurs de validation : **0**.
