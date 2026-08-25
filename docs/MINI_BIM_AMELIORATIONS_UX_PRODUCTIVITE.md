# Mini-BIM-House — Améliorations UX et productivité de conception

**Statut :** document UX / productivité  
**Date :** 25 août 2026  
**Objectif :** réduire le nombre d'actions, de décisions techniques prématurées et d'allers-retours nécessaires pour concevoir une maison complète.

---

# 1. Principe général

Mini-BIM doit tendre vers une interface où l'utilisateur exprime une **intention métier**, et non une succession d'opérations de bas niveau.

Exemple actuel conceptuel :

```text
Créer réseau
→ choisir discipline
→ choisir système
→ créer nœud
→ choisir port
→ créer autre nœud
→ choisir autre port
→ connecter
→ ouvrir propriétés
→ dimensionner
```

Cible :

```text
Sélectionner 6 prises
→ Créer un circuit
→ accepter la proposition
```

Le modèle interne peut rester précis.  
L'utilisateur ne doit simplement pas être obligé de manipuler cette précision lorsqu'elle peut être déduite.

---

# 2. Audit UX de l'existant

## 2.1 Points très positifs

La direction actuelle est bonne :

- 7 espaces seulement ;
- plan de travail central ;
- sous-parties contextuelles ;
- une sous-partie ouverte à la fois ;
- outils recommandés avant les outils inactifs ;
- catalogue filtré depuis le métier courant ;
- inspecteur contextuel ;
- périmètre du projet ;
- état de conception calculé depuis le modèle ;
- palette de commande ;
- navigation transversale vers un objet/propriété ;
- gestion de réseaux déjà connectée au plan.

Ces briques permettent une interface beaucoup plus intelligente sans reconstruire la coque.

## 2.2 Principal problème restant

La complexité s'est déplacée du shell vers le **travail métier**.

Le panneau Réseaux expose encore directement :

- réseaux ;
- disciplines ;
- types ;
- nœuds ;
- ports ;
- tronçons ;
- connexions.

C'est utile comme outil avancé et pour le diagnostic, mais trop bas niveau comme parcours principal.

La règle UX future doit être :

> Les ports, nœuds et IDs sont visibles pour diagnostiquer, jamais nécessaires pour accomplir l'action normale.

---

# 3. Un workflow identique pour tous les systèmes

L'utilisateur doit retrouver la même logique partout :

```text
1. POSER
2. REGROUPER
3. RELIER
4. DIMENSIONNER
5. VÉRIFIER
```

Mais ces cinq mots ne nécessitent pas cinq onglets.

Ils doivent être des actions contextuelles dans la sous-partie courante.

## Exemple Eau

```text
Eau
  Appareils
  Collecteur
  Ballon
  Tuyau

[Créer alimentation]
[Dimensionner]
```

## Exemple Électricité

```text
Électricité
  Tableau
  Prise
  Interrupteur
  Point lumineux

[Créer circuit]
[Dimensionner]
```

---

# 4. Interaction "sélection d'abord"

Le plus gros gain de productivité peut venir de là.

Quand plusieurs objets compatibles sont sélectionnés, Mini-BIM doit proposer ce que l'utilisateur cherche probablement à faire.

## 4.1 Prises sélectionnées

```text
8 prises sélectionnées

[ Créer un circuit ]
[ Affecter à un circuit ]
[ Dupliquer ]
[ Aligner ]
```

## 4.2 Appareils sanitaires sélectionnés

```text
Lavabo · douche · WC

[ Créer alimentation eau ]
[ Créer évacuation ]
```

## 4.3 Radiateurs sélectionnés

```text
4 radiateurs

[ Créer circuit chauffage ]
[ Affecter au collecteur ]
```

## 4.4 Bouches VMC

```text
6 bouches

[ Créer réseau ]
[ Affecter à VMC-1 ]
```

Les actions doivent être dérivées des ports compatibles et des catégories sémantiques.

---

# 5. Connecter automatiquement les équipements

Lorsqu'un équipement possédant des ports est placé :

```text
Radiateur ajouté

Chauffage disponible à 1,8 m
[ Connecter ]
[ Plus tard ]
```

ou :

```text
Prise ajoutée

Circuit prises C03 à proximité
[ Affecter à C03 ]
[ Nouveau circuit ]
[ Plus tard ]
```

Ne jamais connecter silencieusement.

Toujours :

```text
proposer → montrer → appliquer
```

---

# 6. Prévisualisation avant toute automatisation

Toute action intelligente doit avoir un aperçu.

Exemple :

```text
Proposition de réseau EF

Longueur       18,4 m
Coudes         7
Percements     2
Conflits       0

──────── chemin affiché en surbrillance ────────

[ Appliquer ]
[ Autre proposition ]
[ Modifier ]
[ Annuler ]
```

Cela permet d'avoir une automatisation puissante sans perte de contrôle.

---

# 7. Routage assisté plutôt qu'auto-routing opaque

Prévoir trois modes cohérents :

```text
Manuel
Assisté
Automatique
```

## Manuel

L'utilisateur pose chaque point.

## Assisté

L'utilisateur donne :

```text
départ → éventuellement points de passage → arrivée
```

Mini-BIM complète le chemin.

## Automatique

Mini-BIM propose plusieurs routes.

Le mode **Assisté** doit être le défaut : meilleur compromis entre simplicité et contrôle.

---

# 8. Zones techniques explicites

Permettre à l'utilisateur de dessiner ou déclarer :

- gaine technique ;
- faux plafond ;
- doublage ;
- vide sanitaire ;
- plénum ;
- chemin de câble ;
- zone de passage préférée ;
- zone interdite.

Ces informations simplifient tous les routages futurs.

Un utilisateur peut ainsi définir une fois :

```text
"les réseaux passent ici"
```

au lieu de guider chaque câble et tuyau.

---

# 9. Design intent / objets provisoires

Ne pas bloquer l'utilisateur parce qu'il ne connaît pas encore :

- DN ;
- section ;
- modèle exact ;
- débit ;
- protection ;
- longueur finale.

Autoriser :

```text
Câble : Auto
Tuyau : Auto
Radiateur : générique 1200 W
PAC : modèle à choisir
```

État visuel :

```text
○ Esquisse
◐ À dimensionner
✓ Dimensionné
⚠ À corriger
```

Cela simplifie énormément le début de conception.

---

# 10. Valeur "Auto" partout où elle a un sens

Exemples :

```text
Section câble      [ Auto ▼ ]
Protection         [ Auto ▼ ]
DN eau             [ Auto ▼ ]
Diamètre gaine     [ Auto ▼ ]
Débit              [ Auto ▼ ]
Radiateur          [ Auto ▼ ]
```

`Auto` ne doit pas signifier une valeur cachée.

L'inspecteur doit afficher :

```text
Section : Auto → 2,5 mm²
Raison : courant 14,2 A + critères projet
```

Puis :

```text
[ Fixer à 2,5 mm² ]
```

---

# 11. Suggestions explicables

Toute suggestion technique doit répondre à :

```text
Pourquoi ?
```

Exemple :

```text
Ø 16 mm recommandé

Débit de calcul      0,18 l/s
Vitesse              0,91 m/s
Perte linéaire       …
```

Pas besoin d'afficher ces détails par défaut.

Un simple :

```text
ⓘ Pourquoi ?
```

suffit.

---

# 12. Conception centrée sur la pièce

Une maison se conçoit souvent pièce par pièce.

Mini-BIM possède déjà des `Space`. Il faut davantage les exploiter.

Cliquer une pièce pourrait afficher :

```text
SÉJOUR · 31,4 m²

Architecture
  2 portes · 3 fenêtres

Électricité
  7 prises
  2 luminaires
  3 commandes

Chauffage
  Besoin : 1,42 kW
  1 radiateur

Ventilation
  Soufflage : 45 m³/h

[ Compléter la pièce ]
```

---

# 13. Assistant "Compléter la pièce"

Ce n'est pas un générateur opaque.

Exemple pour une chambre :

```text
Suggestions

☑ 3 prises
☑ 1 point lumineux
☑ 1 interrupteur
☑ 1 radiateur
☐ RJ45
☐ détecteur

[ Prévisualiser ]
```

L'utilisateur peut déplacer ensuite chaque objet.

Cela peut réduire considérablement le temps de saisie répétitive.

---

# 14. Presets de pièce

Prévoir des profils modifiables :

```text
Chambre
Cuisine
Salle de bain
WC
Séjour
Garage
Buanderie
Bureau
Local technique
```

Chaque profil peut définir des **suggestions**, pas des obligations.

Exemple Cuisine :

- prises plan de travail ;
- prises spécialisées ;
- éclairage ;
- eau ;
- évacuation ;
- ventilation ;
- appareils principaux.

---

# 15. Répétition intelligente

Fonctions de productivité :

## Répéter le dernier

```text
Répéter prise
Répéter fenêtre
Répéter radiateur
```

## Dupliquer avec relations

Lorsqu'une prise est dupliquée :

```text
Conserver le circuit C03 ?
● Oui
○ Nouveau circuit
○ Non affecté
```

## Copier une pièce

Option :

```text
Copier avec :
☑ mobilier
☑ électricité
☑ chauffage
☐ réseaux physiques
```

---

# 16. Outils de distribution

Pour les objets répétitifs :

```text
Répartir sur mur
Espacement régulier
Nombre d'éléments
Distance depuis angles
```

Usages :

- prises ;
- spots ;
- radiateurs ;
- panneaux PV ;
- solives/poteaux ultérieurement.

---

# 17. Placement intelligent sur host

Un objet doit comprendre son support.

Exemples :

- prise → mur ;
- fenêtre → mur ;
- luminaire → plafond ;
- radiateur → mur ;
- panneau PV → toiture ;
- bouche VMC → plafond/mur ;
- équipement extérieur → sol/façade.

Au survol :

```text
aperçu + orientation + hauteur
```

Au clic :

```text
placement valide immédiatement
```

Éviter les coordonnées manuelles lorsque le support suffit.

---

# 18. Dimensions dynamiques lors du placement

Pendant déplacement/pose :

```text
← 850 mm → objet ← 1250 mm →
```

Permettre de cliquer directement une cote pour la saisir.

Même principe :

- distance au mur ;
- distance angle ;
- hauteur ;
- entraxe ;
- alignement.

Objectif : limiter les allers-retours vers l'inspecteur.

---

# 19. Alignements et contraintes temporaires

Afficher automatiquement :

- axe de mur ;
- centre de pièce ;
- alignement avec objet voisin ;
- hauteur commune ;
- équidistance ;
- orthogonalité.

Utiliser une contrainte **temporaire**, pas nécessairement persistante.

---

# 20. Recherche universelle orientée action

`Ctrl+K` doit répondre à :

```text
"prise"
"circuit cuisine"
"radiateur chambre"
"schéma électrique"
"fenêtre F12"
```

Résultats mélangés mais groupés :

```text
OUTILS
OBJETS
SYSTÈMES
DOCUMENTS
COMMANDES
```

Actions directes :

```text
Localiser
Modifier
Poser
Ouvrir schéma
```

---

# 21. Favoris et récents

Le catalogue est très riche. L'utilisateur ne doit pas le rechercher à chaque pose.

Chaque sous-partie doit afficher :

```text
Récents
Favoris
Recommandés
Autre…
```

Exemple :

```text
Électricité

[ Prise 16A ★ ]
[ Interrupteur ]
[ Point lumineux ]
[ Tableau ]

Récents
[ RJ45 ]
[ Détecteur ]

[ Autre… ]
```

---

# 22. Différencier catalogue utilisateur et catalogue technique

L'écran normal ne doit pas mettre en avant :

- progression d'implémentation ;
- axes `MODEL`, `PORTS`, `CALCULATION`, etc. ;
- détails de registre.

Ces données sont utiles au développeur et au diagnostic.

Prévoir deux niveaux :

### Sélecteur normal

```text
photo/symbole
nom
dimensions utiles
propriétés clés
```

### Détails techniques

```text
▶ Données avancées
▶ Sources
▶ Ports
▶ Capacités
```

---

# 23. État de santé directement dans la sous-partie

Aujourd'hui le nombre de réseaux est déjà connu.

Étendre à :

```text
Électricité     ✓
Eau             ⚠ 2
Chauffage       ◐
Ventilation     ○
```

Signification :

```text
✓ cohérent
◐ en cours / non dimensionné
⚠ problème
○ rien créé
```

Un clic sur `⚠ 2` filtre directement les problèmes correspondants.

---

# 24. Enrichir DesignState pour les systèmes

Ajouter des faits dérivés, par métier.

## Génériques

```text
unconnectedPorts
unsizedEdges
disconnectedComponents
unassignedTerminals
openBranches
systemsWithErrors
```

## Électricité

```text
unassignedElectricalLoads
circuitsWithoutProtection
circuitsWithoutCable
circuitsOverVoltageDropLimit
boardCount
```

## Eau

```text
fixturesWithoutColdWater
fixturesWithoutHotWater
unsizedWaterRuns
lowPressureTerminals
```

## Chauffage

```text
roomsWithoutEmitter
undersizedRooms
unassignedEmitters
unbalancedCircuits
```

L'UI pourra alors réellement proposer l'action utile.

---

# 25. Issue Center réellement actionnable

Chaque problème doit fournir :

```text
Problème
Cause
Objet
Action proposée
```

Exemple :

```text
⚠ Circuit C04 : section non définie

Courant calculé : 18,4 A

[ Utiliser 2,5 mm² ]
[ Ouvrir le circuit ]
```

Ou :

```text
⚠ Douche non raccordée à l'ECS

[ Connecter à Collecteur ECS-1 ]
[ Localiser ]
```

La correction simple doit pouvoir se faire depuis le problème.

---

# 26. Trois niveaux de sévérité

Éviter de transformer un projet en mur d'alertes.

```text
⛔ Bloquant
⚠ À vérifier
ⓘ Suggestion
```

Exemple :

- port incompatible → bloquant ;
- tuyau non dimensionné → à vérifier ;
- route plus courte disponible → suggestion.

Filtres par défaut :

```text
Bloquants + À vérifier
```

---

# 27. Calculs intégrés au contexte

Ne pas obliger à quitter le métier pour consulter une valeur importante.

Sur un câble :

```text
C03
2,5 mm²
14,2 A
ΔU 1,4 %
✓
```

Sur un tuyau :

```text
EF Ø16
0,18 l/s
0,91 m/s
✓
```

Sur un radiateur :

```text
1320 W
Besoin pièce 1150 W
+15 %
```

L'espace Études reste nécessaire pour l'analyse globale, mais les résultats locaux doivent être visibles localement.

---

# 28. Mode comparaison avant modification automatique

Lors d'une optimisation :

```text
ACTUEL           PROPOSÉ
23,8 m           18,4 m
9 coudes          6
3 percements      2
1 conflit         0
```

[Appliquer]

Cette approche rend les automatismes compréhensibles.

---

# 29. Modifications groupées

Sélection multiple :

```text
12 prises

Hauteur     [ 300 mm ]
Modèle      [ ... ]
Circuit     [ C03 ]
```

Les champs différents peuvent afficher :

```text
— valeurs multiples —
```

Ne jamais forcer l'édition objet par objet.

---

# 30. Numérotation automatique

L'utilisateur ne devrait pas saisir systématiquement :

```text
C01
C02
R1
R2
EF-01
```

Créer des règles de projet :

```text
Circuits : C01…
Tableaux : TD1…
Radiateurs : RAD-01…
Réseaux : EF-01…
```

L'utilisateur peut renommer.

---

# 31. Nommage contextuel automatique

Exemples :

```text
Circuit prises séjour
Circuit éclairage RDC
Collecteur chauffage RDC
Extraction cuisine
ECS salle de bain
```

Utiliser :

- type ;
- pièce ;
- étage ;
- système.

---

# 32. Standardiser les tailles du projet

Paramètres techniques projet :

```text
Sections câble utilisées
DN eau utilisés
Diamètres évacuation
Diamètres gaine
Types de tube
Types de câble
```

Les menus proposent d'abord ces tailles.

Bouton :

```text
Autre…
```

pour sortir du standard.

Cela limite les incohérences.

---

# 33. Favoriser les choix compatibles

Quand l'utilisateur relie un port :

- mettre en évidence les ports compatibles ;
- estomper les incompatibles ;
- expliquer pourquoi un port est incompatible au survol.

Exemple :

```text
ECS sortie 20 mm
```

surbrillance uniquement des entrées ECS compatibles.

---

# 34. Création automatique des raccords

Lors d'une branche :

```text
cliquer tronçon
→ cliquer destination
```

Mini-BIM doit insérer :

- té ;
- dérivation ;
- transition ;
- coude ;

selon la discipline et le catalogue.

Le raccord reste un véritable nœud BIM.

---

# 35. Action "Insérer dans le réseau"

Sélectionner un tronçon puis poser :

- vanne ;
- compteur ;
- filtre ;
- pompe ;
- protection ;
- sectionneur.

Mini-BIM :

```text
coupe le tronçon
insère le composant
reconnecte les ports
```

en une seule transaction.

---

# 36. Actions rapides par discipline

## Électricité

```text
Créer circuit
Affecter circuit
Tracer câble
Dimensionner
Schéma
```

## Eau

```text
Créer alimentation
Affecter collecteur
Tracer
Dimensionner
Schéma
```

## Chauffage

```text
Dimensionner pièce
Créer circuit
Tracer départ/retour
Équilibrer
Schéma
```

## Ventilation

```text
Calculer débits
Créer réseau
Tracer
Dimensionner
Équilibrer
Schéma
```

La position des actions doit rester cohérente entre disciplines.

---

# 37. Vue système rapide

Sans quitter le plan :

```text
[ Plan ] [ Schéma ] [ Tableau ]
```

Cette bascule peut apparaître uniquement dans `Systèmes`.

## Plan

géométrie physique.

## Schéma

topologie logique.

## Tableau

liste/paramètres/résultats.

Le même objet sélectionné reste sélectionné lors du changement de représentation.

---

# 38. Sélection synchronisée

Sélectionner `C03` dans le tableau :

- surligne le circuit sur le plan ;
- surligne la branche dans le schéma.

Sélectionner une prise sur le plan :

- montre son circuit dans le tableau ;
- surligne le terminal dans le schéma.

Cette synchronisation est essentielle pour que les trois vues ressemblent à une seule application.

---

# 39. Génération documentaire sans travail supplémentaire

Une vue technique finalisée doit pouvoir devenir un document en un clic :

```text
[ Ajouter aux documents ]
```

Mini-BIM crée :

- vue enregistrée ;
- échelle/profil ;
- légende ;
- cartouche via feuille.

Les changements futurs du modèle doivent mettre à jour la vue dérivée.

---

# 40. Barre d'état métier

La barre basse peut changer légèrement selon la discipline.

Exemple électrique :

```text
RDC | Électricité | C03 | 8 charges | 14,2 A | ΔU 1,4 % | ✓
```

Exemple évacuation :

```text
RDC | EU | DN100 | pente 2 % | Z 0,12 → -0,08 | ✓
```

Informations immédiates, sans ouvrir un panneau.

---

# 41. Raccourcis centrés sur les actions fréquentes

Conserver les raccourcis génériques mais permettre :

```text
R = répéter dernier outil
Tab = changer point d'accrochage / solution
Entrée = terminer
Échap = annuler
Espace = rotation rapide
```

Ne pas exiger la mémorisation : afficher le raccourci dans l'instruction contextuelle.

---

# 42. Historique d'actions compréhensible

Au lieu de :

```text
UpdateNetworkEdgeCommand
```

l'historique doit pouvoir exprimer :

```text
Créer circuit prises séjour
Raccorder douche à ECS
Proposer route ventilation
Dimensionner réseau EF
```

Même si l'implémentation interne appelle plusieurs commandes.

---

# 43. Assistant de modification après changement architectural

Lorsque la maison change :

```text
Mur déplacé de 400 mm.

Impact :
• 2 prises hébergées
• 1 radiateur
• 3 tronçons traversent ce mur

[ Adapter automatiquement ]
[ Examiner ]
```

À terme, c'est une amélioration majeure par rapport à un simple CAD.

---

# 44. Objets dépendants du host

Définir une politique par type :

```text
MOVE_WITH_HOST
KEEP_WORLD_POSITION
ASK
```

Exemple :

- fenêtre → suit le mur ;
- prise → suit le mur ;
- radiateur → suit le mur ;
- conduite traversant le mur → recalcul de traversée ;
- mobilier libre → ne suit pas.

---

# 45. Multi-étage intelligent

Actions :

```text
Copier au niveau supérieur
Aligner verticalement
Créer colonne montante
Créer chute
Créer gaine technique
```

L'utilisateur ne doit pas reconstruire manuellement la même infrastructure à chaque étage.

---

# 46. Presets techniques réutilisables

Exemples :

```text
Tableau maison monophasé
Distribution eau par collecteur
PAC + radiateurs
PAC + plancher chauffant
VMC double flux
Installation PV + batterie
```

Un preset doit afficher avant application :

```text
Ce qui sera créé :
• 1 générateur
• 1 collecteur
• 2 circuits
• paramètres initiaux ...
```

Pas de configuration cachée.

---

# 47. Mesurer la simplicité

Ajouter des scénarios E2E orientés utilisateur, pas seulement des tests de composants.

## Scénario Électricité

Objectif :

```text
tableau + 10 prises + 2 circuits + schéma
```

Mesurer :

- nombre de clics ;
- changements d'écran ;
- champs saisis ;
- erreurs rencontrées.

Cible :

- aucun ID interne ;
- aucun choix de port manuel ;
- pas de passage obligatoire dans un tableau de nœuds.

## Scénario Eau

```text
5 appareils + collecteur + EF/ECS + dimensionnement
```

Même métrique.

## Scénario Chauffage

```text
4 pièces + dimensionnement + émetteurs + circuit
```

---

# 48. Budgets UX proposés

Pour les actions courantes :

| Action | Cible |
|---|---:|
| poser un objet déjà utilisé | 1–2 actions |
| créer un circuit depuis sélection | ≤ 3 décisions |
| affecter un objet à un système | ≤ 2 actions |
| ouvrir les propriétés | 1 action |
| localiser un problème | 1 action |
| appliquer une correction simple | 1–2 actions |
| passer Plan → Schéma | 1 action |
| retourner à l'objet plan depuis schéma | 1 action |
| répéter un équipement | 1 action |

---

# 49. Ce qu'il ne faut pas faire

Ne pas :

- ajouter un nouvel onglet principal par module ;
- créer un "mode expert" séparé ;
- afficher systématiquement tous les paramètres ;
- forcer le passage par le panneau Réseaux ;
- faire saisir des identifiants techniques ;
- connecter automatiquement sans prévisualisation ;
- générer des objets impossibles à modifier ;
- dupliquer les données du BIM dans les schémas ;
- masquer les raisons d'un calcul automatique ;
- bloquer la conception parce qu'une donnée finale manque.

---

# 50. Priorité UX proposée

## UX-P0

- actions depuis sélection ;
- auto-affectation port/système ;
- état système enrichi ;
- valeur `Auto` explicable ;
- preview avant automatisation ;
- synchronisation Plan/Schéma/Tableau.

## UX-P1

- workflow électrique simplifié ;
- favoris/récents ;
- batch edit ;
- Issue Center actionnable ;
- insertion intelligente dans réseau ;
- propositions de routes.

## UX-P2

- assistants de pièce ;
- presets techniques ;
- répétition/copie intelligente ;
- multi-étage ;
- route par zones préférées.

## UX-P3

- propagation des changements architecturaux ;
- optimisation multi-réseaux ;
- coordination/reservations ;
- scénarios d'optimisation automatiques.

---

# 51. Architecture UX finale visée

Dans `Systèmes > Électricité` :

```text
┌──────────────────────┬─────────────────────────────────────┐
│ ÉLECTRICITÉ          │ [ Plan | Schéma | Tableau ]         │
│                      │                                     │
│ Tableau              │                                     │
│ Prise                │             CANVAS                  │
│ Interrupteur         │                                     │
│ Point lumineux       │                                     │
│                      │                                     │
│ ──────────────────   │                                     │
│ Circuits             │                                     │
│ C01 ✓                │                                     │
│ C02 ⚠                │                                     │
│ C03 ✓                │                                     │
│                      │                                     │
│ [+ Créer circuit]    │                                     │
└──────────────────────┴─────────────────────────────────────┘
```

En sélectionnant plusieurs prises :

```text
┌────────────────────────────────────────────────────────────┐
│ 8 prises │ [Créer circuit] [Affecter] [Aligner] [Dupliquer]│
└────────────────────────────────────────────────────────────┘
```

C'est ce type d'interface qui permet de conserver un moteur BIM complexe avec une utilisation comparable à un logiciel de conception beaucoup plus simple.

---

# 52. Conclusion

Le prochain objectif UX n'est plus principalement :

```text
"où ranger les fonctions ?"
```

Cette question est désormais largement résolue par les 7 espaces et les sous-parties.

La prochaine question est :

```text
"combien d'étapes l'utilisateur doit-il encore accomplir lui-même
alors que Mini-BIM possède déjà assez d'information pour les déduire ?"
```

La réponse doit guider les futures PR :

> **ne jamais demander deux fois une information déjà connue, ne jamais demander une donnée interne qui peut être déduite, et ne jamais automatiser une décision importante sans la montrer avant application.**
