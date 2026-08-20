# Journal des versions

Les versions suivent [SemVer](https://semver.org/lang/fr/). Le format de
fichier `.houseproj` porte sa propre version, indépendante de celle de
l'application : `schemaVersion` dit ce qu'un fichier contient, la version de
l'application dit ce qui l'a écrit.

## 0.2.0-beta.1 — non publiée

Première version proposée à des utilisateurs. Elle permet le parcours complet :
créer un projet, choisir un climat, dessiner et corriger des murs, poser portes
et fenêtres, décrire niveaux, pièces, dalles et toiture, choisir matériaux et
assemblages, poser des équipements, créer des réseaux et les dimensionner,
lancer les calculs, voir ce qui manque, comparer un scénario, exporter un plan,
enregistrer et retrouver le projet après fermeture du navigateur.

### Compatibilité

- Format de projet : `schemaVersion` 1.0.0. Un fichier écrit par une version
  antérieure du schéma est migré à l'ouverture, et l'application dit qu'elle
  l'a fait ; un fichier annonçant une version future est refusé plutôt
  qu'ouvert à moitié.
- Conteneur `.houseproj` : version 1.x. Le manifeste est strict — ce qu'il
  annonce doit être présent et valide — et l'archive est bornée en taille, en
  nombre d'entrées et en facteur d'expansion.
- Sauvegarde locale : les instantanés laissés en `localStorage` par une version
  antérieure sont déplacés vers IndexedDB à la première ouverture.
- Réglages : `battery.offGrid` se saisit désormais comme une case à cocher ; la
  forme ancienne (`1` ou `0`) reste lue.

### Ajouté

- assistant de création de projet : nom, auteur, pays, niveaux, hauteur
  d'étage, sous-sol, orientation et localisation, ce qui reste vide restant
  inconnu ;
- zones : création, renommage, type, appartenance des pièces, suppression ;
- provenance saisissable pour chaque propriété de matériau ;
- espaces de travail regroupés en cinq familles ;
- gaines rectangulaires, charges électriques fixes, racines de réseau propres à
  chaque discipline ;
- transport du projet et de son climat dans un seul fichier `.houseproj` ;
- vérification d'accessibilité automatisée sur les onze espaces de travail ;
- budget de taille du chargement initial vérifié en intégration continue ;
- vérification du déploiement GitHub Pages après publication ;
- tests navigateur sur Chromium, Firefox et WebKit.

### Corrigé

- la sauvegarde locale n'annonce plus « sauvegardé » pour une révision qui
  n'est pas celle affichée, et elle enregistre le climat avec le projet ;
- l'export ne peut plus être annoncé pour une révision modifiée depuis ;
- les résultats de calcul ne peuvent plus être présentés comme ceux d'un autre
  projet ;
- les hypothèses silencieuses (cuivre implicite, pertes locales nulles) sont
  devenues des hypothèses déclarées ou des entrées manquantes ;
- les références mortes — pièce d'une zone, mur d'une cote, objet hôte d'un
  nœud — sont refusées à l'import, comme les identifiants dupliqués ;
- contrastes de texte insuffisants dans la barre de projet et les métriques.

### Connu, assumé

Feuilles et export PDF, orchestrateur de calcul persistant, invalidation
sélective par `ChangeSet`, régression visuelle pixel par pixel, réglages encore
invisibles alors que les moteurs les lisent. Le détail est dans
`docs/BETA_READINESS.md`.

## 0.1.0

Développement initial, sans publication. L'historique des passes d'audit et de
leurs correctifs est dans `docs/IMPLEMENTATION_STATUS.md`.
