# 07 — Standards and Rules

> **Objectif :** empêcher les normes, textes réglementaires et valeurs de référence d’être dispersés dans le code.

## 1. Principe

Le code métier contient des algorithmes. Les exigences normatives et réglementaires sont décrites dans des **Rule Packs versionnés**.

```text
Algorithm ≠ Rule ≠ Regulation ≠ Graphic convention
```

## 2. RegulatoryContext

```ts
interface RegulatoryContext {
  country: string;
  region?: string;
  projectType: string;
  permitDate?: string;
  rulePackIds: string[];
}
```

La date du projet est importante car les exigences peuvent évoluer.

## 3. StandardsRegistry

```ts
interface StandardReference {
  id: string;
  type: ReferenceType;
  title: string;
  jurisdiction?: string;
  version?: string;
  publicationDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  officialUrl?: string;
  notes?: string;
}
```

`ReferenceType` :

```text
LAW
REGULATION
STANDARD
DTU
TECHNICAL_METHOD
GUIDE
DATA_SOURCE
INTERNAL_CONVENTION
```

## 4. Rule Pack

```ts
interface RulePack {
  id: string;
  version: string;
  jurisdiction: string;
  discipline: string;
  references: string[];
  rules: RuleDefinition[];
}
```

## 5. Règle

```ts
interface RuleDefinition {
  id: string;
  title: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  applicability: RuleCondition;
  evaluation: RuleExpression;
  message: string;
  references: RuleReference[];
}
```

## 6. Résultat

```ts
interface RuleResult {
  ruleId: string;
  status: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'UNKNOWN';
  entityIds: EntityId[];
  measuredValues?: Record<string, QuantityValue>;
  message: string;
  references: RuleReference[];
}
```

`UNKNOWN` est essentiel lorsqu’une donnée nécessaire manque.

## 7. Pas de conformité implicite

L’interface ne doit pas afficher « conforme » pour un domaine si seules quelques règles ont été contrôlées.

Préférer :

```text
12 contrôles exécutés
10 OK
1 avertissement
1 non vérifiable
Couverture : partielle
```

## 8. Rule Packs France

Structure cible :

```text
FR/
├── architecture/
├── thermal/
├── ventilation/
├── electrical/
├── potable-water/
├── rainwater/
├── wastewater/
├── acoustics/
├── accessibility/
└── fire/
```

Tous ne sont pas à implémenter dans le MVP.

## 9. RE2020

Le moteur doit considérer la RE2020 comme un référentiel externe versionné et non comme une constante unique.

Le portail officiel publie des textes consolidés et distingue notamment les dispositions selon la date de dépôt du permis. Une évolution importante est entrée en application au 1er juillet 2026.

Référence officielle :
https://rt-re-batiment.developpement-durable.gouv.fr/textes-en-version-consolidee-a617.html

Le projet ne doit pas annoncer un calcul réglementaire RE2020 tant que l’intégralité de la méthode nécessaire n’est pas implémentée et validée.

## 10. Ventilation des logements

Le registre France doit référencer au minimum l’arrêté du 24 mars 1982 relatif à l’aération des logements, dans sa version en vigueur.

Référence :
https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000862344

Les règles de débit doivent être représentées comme données versionnées, pas codées dans les composants UI.

## 11. Eau de pluie / eaux impropres

Le registre doit intégrer les textes sanitaires applicables à l’utilisation domestique des eaux impropres à la consommation humaine.

Références de départ :

- décret n° 2024-796 du 12 juillet 2024 ;
- arrêté du 12 juillet 2024 relatif aux conditions sanitaires d’utilisation ;
- textes ultérieurs applicables au type d’usage étudié.

Référence :
https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049962813

Les usages autorisés doivent dépendre du type d’eau, du traitement et de la destination.

## 12. Électricité

La série NF C 15-100 révisée en 2024 doit être référencée comme corpus normatif externe.

Référence de cadrage AFNOR :
https://www.afnor.org/actualites/excellence-efqm/installations-electriques-nf-c15-100/

Le logiciel ne doit pas reproduire illégalement un texte normatif non libre. Les règles implémentées doivent être documentées avec leurs références et leur base légale/licence.

## 13. Dessin technique

Le registre doit contenir les références ISO utilisées par `04_DRAWING_CONVENTIONS.md` :

- ISO 128 ;
- ISO 129-1 ;
- ISO 5455 ;
- ISO 5457 ;
- ISO 7200 ;
- ISO 13567.

## 14. Données environnementales

INIES doit être enregistré comme source de données, pas comme norme.

Référence :
https://www.inies.fr/

## 15. Données protégées

Le dépôt ne doit pas embarquer :

- texte intégral d’une norme commerciale sans droit ;
- tableaux protégés recopiés massivement ;
- données de fabricant sans droit de redistribution.

Il peut stocker :

- identifiants ;
- métadonnées ;
- liens ;
- règles reformulées lorsque juridiquement possible ;
- valeurs issues de sources ouvertes ou autorisées.

## 16. Versionnement

Exemple :

```text
fr-electrical-2024.1
fr-ventilation-1982.3
fr-rainwater-2024.1
re2020-2026-07
```

Le nom du pack ne suffit pas : stocker aussi les références officielles.

## 17. Tests de règles

Chaque règle doit avoir :

- cas PASS ;
- cas FAIL ;
- cas NOT_APPLICABLE ;
- cas UNKNOWN ;
- test de date/version si nécessaire.

## 18. Auditabilité

Dans l’UI, un contrôle doit pouvoir ouvrir :

```text
Règle
Valeur mesurée
Seuil utilisé
Version
Source
Date d’application
Objet concerné
```

## 19. Mise à jour

Les Rule Packs doivent pouvoir être mis à jour indépendamment du moteur graphique.

Un projet ancien doit conserver le pack utilisé lors de son calcul ou au minimum son identifiant/version.
