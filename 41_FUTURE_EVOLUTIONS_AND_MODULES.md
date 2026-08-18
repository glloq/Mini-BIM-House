# 41 — Évolutions futures et modules extensibles

> **Statut :** document de prospective architecturale  
> **Objectif :** identifier les modules et capacités qui pourront être ajoutés après le MVP, et réserver dès maintenant les points d’extension nécessaires pour éviter des refontes majeures.

---

# 1. Principe général

Le projet doit être conçu comme une **plateforme de conception technique d’habitation**, et non comme une application figée autour des premiers modules.

Le noyau doit rester capable d’accueillir :

- de nouvelles disciplines ;
- de nouveaux calculateurs ;
- de nouveaux types d’objets ;
- de nouveaux catalogues ;
- de nouveaux Rule Packs ;
- de nouvelles vues graphiques ;
- de nouveaux formats d’import/export ;
- de nouvelles méthodes de calcul ;
- des simulations temporelles ;
- des services externes optionnels.

La règle est :

```text
Core stable
   ↓
Domain extensions
   ↓
Modules
   ↓
Views / overlays
   ↓
Rules / reports
```

Les futurs modules ne doivent pas forcer une modification du cœur si les concepts génériques existent déjà.

---

# 2. Points à prévoir dès maintenant

Même si ces fonctions ne sont pas développées au MVP, l’architecture doit réserver les concepts suivants.

## 2.1 Coordonnées 3D

Le MVP peut rester principalement 2D/2.5D, mais tous les objets importants doivent pouvoir posséder :

```text
x
y
z
level
height
orientation
```

Objectifs futurs :

- coupes automatiques ;
- façades ;
- volumes ;
- réseaux superposés ;
- collisions ;
- rendu 3D ;
- IFC.

---

## 2.2 Phases de projet

Prévoir :

```text
EXISTING
TO_REMOVE
NEW
TEMPORARY
```

Cela permettra :

- rénovation ;
- extension ;
- comparaison avant/après ;
- métrés de démolition ;
- scénarios.

---

## 2.3 Zones

Le bâtiment doit pouvoir gérer plusieurs types de zones indépendantes :

```text
thermal zone
ventilation zone
acoustic zone
lighting zone
fire zone
electrical zone
water zone
security zone
```

Une pièce peut appartenir à plusieurs zones de disciplines différentes.

---

## 2.4 Scénarios

Prévoir une vraie notion de scénario :

```text
BASELINE
VARIANT_A
VARIANT_B
RENOVATION
AUTONOMY
LOW_COST
LOW_CARBON
```

Un scénario ne doit pas nécessiter une duplication complète du projet.

---

## 2.5 Temps

Certains futurs modules auront besoin de séries temporelles :

```text
hourly
daily
monthly
yearly
```

Le noyau doit donc permettre :

- profils horaires ;
- calendriers ;
- occupation ;
- météo ;
- tarifs ;
- production ;
- consommation.

---

## 2.6 Incertitude

Prévoir à terme :

```ts
interface Uncertainty {
  min?: number;
  nominal?: number;
  max?: number;
  distribution?: string;
  confidence?: number;
}
```

Utilité :

- matériaux non parfaitement connus ;
- rénovation ;
- données climatiques ;
- coûts ;
- performances réelles.

---

# 3. Architecture / dessin avancé

## 3.1 Façades automatiques

À partir du modèle :

- Nord ;
- Sud ;
- Est ;
- Ouest ;
- élévations personnalisées.

Afficher :

- ouvertures ;
- matériaux ;
- niveaux ;
- toiture ;
- équipements extérieurs.

---

## 3.2 Coupes automatiques

Créer un objet :

```text
SectionPlane
```

et générer :

- coupe bâtiment ;
- coupe mur ;
- coupe réseau ;
- détails d’assemblage.

---

## 3.3 Toitures complexes

Modules futurs :

- multi-pans ;
- noues ;
- arêtiers ;
- chiens-assis ;
- toits plats ;
- terrasses ;
- acrotères ;
- chéneaux.

---

## 3.4 Escaliers avancés

Solveur :

- hauteur ;
- nombre de marches ;
- giron ;
- échappée ;
- largeur ;
- palier ;
- encombrement.

---

## 3.5 Rampes / garde-corps

Prévoir :

- pentes ;
- longueurs ;
- hauteurs ;
- zones de protection.

---

## 3.6 Mobilier

Bibliothèque :

- cuisine ;
- sanitaires ;
- lits ;
- rangements ;
- électroménager.

Objectifs :

- ergonomie ;
- dégagements ;
- accessibilité ;
- implantation électrique/eau.

---

# 4. Structure du bâtiment

## 4.1 Pré-dimensionnement structurel

Module futur :

```text
Structure
├── beams
├── columns
├── walls
├── slabs
├── foundations
└── loads
```

Calculs :

- charges permanentes ;
- charges d’exploitation ;
- réactions ;
- flexion ;
- compression ;
- flèche ;
- taux de travail.

Le logiciel ne doit pas se présenter comme logiciel de calcul structure certifié sans validation spécifique.

---

## 4.2 Bois

Calculs futurs :

- solives ;
- poutres ;
- chevrons ;
- pannes ;
- poteaux ;
- assemblages simplifiés.

---

## 4.3 Béton

Pré-dimensionnement :

- dalle ;
- poutre ;
- poteau ;
- semelle.

---

## 4.4 Acier

- poutrelles ;
- poteaux ;
- profils ;
- flambement simplifié.

---

## 4.5 Charges toiture

- neige ;
- vent ;
- photovoltaïque ;
- toiture végétalisée ;
- équipements.

Les données climatiques structurales doivent être indépendantes du dataset météo énergétique.

---

# 5. Géotechnique / fondations

## 5.1 Sol

Informations :

- type ;
- portance ;
- profondeur ;
- nappe ;
- pente ;
- argiles ;
- risques.

---

## 5.2 Fondations

Comparaison :

- semelles ;
- radier ;
- plots ;
- pieux ;
- dalle portée.

---

## 5.3 Terrassement

Calcul :

- déblais ;
- remblais ;
- volumes ;
- pente ;
- plateformes.

---

# 6. Terrain / site

## 6.1 Parcelle

Objets :

- limites ;
- accès ;
- voirie ;
- servitudes ;
- orientation ;
- voisins.

---

## 6.2 Topographie

Importer :

- points altimétriques ;
- courbes de niveau ;
- modèle numérique simple.

---

## 6.3 Ombrage du site

Objets :

- bâtiments voisins ;
- arbres ;
- relief.

Utilisé par :

- PV ;
- lumière naturelle ;
- confort d’été ;
- solaire passif.

---

## 6.4 Implantation

Calculer :

- recul ;
- distances ;
- orientation ;
- emprise ;
- surface imperméabilisée.

Les règles urbanistiques doivent être des Rule Packs locaux optionnels.

---

# 7. Thermique avancée

## 7.1 Simulation thermique dynamique

Évolution majeure :

```text
weather hourly
+
thermal mass
+
solar gains
+
occupancy
+
ventilation
+
systems
→
hourly indoor temperatures
```

Sorties :

- besoin chauffage ;
- besoin refroidissement ;
- température intérieure ;
- inconfort ;
- surchauffe.

---

## 7.2 Inertie

Propriétés nécessaires :

- masse volumique ;
- chaleur spécifique ;
- diffusivité ;
- effusivité.

---

## 7.3 Ponts thermiques avancés

Évolution :

- bibliothèque de jonctions ;
- calcul 2D ;
- température de surface ;
- coefficient ψ.

---

## 7.4 Confort d’été

Module dédié :

- apports solaires ;
- protections ;
- inertie ;
- ventilation nocturne ;
- surchauffe ;
- degrés-heures.

---

## 7.5 Protections solaires

Objets :

- volet ;
- store ;
- brise-soleil ;
- casquette ;
- pergola ;
- végétation.

---

# 8. Solaire avancé

## 8.1 Solaire thermique

Calcul :

- surface capteurs ;
- ballon ;
- ECS ;
- appoint ;
- rendement saisonnier.

---

## 8.2 Ombres 3D

Simulation :

- soleil ;
- bâtiments ;
- arbres ;
- relief ;
- obstacles toiture.

---

## 8.3 Optimisation orientation/inclinaison

Solveur :

```text
maximize annual energy
maximize winter energy
maximize self-consumption
```

---

## 8.4 Façades photovoltaïques

Prévoir PV sur :

- toiture ;
- façade ;
- garde-corps ;
- pergola ;
- auvent.

---

# 9. Chauffage / refroidissement avancé

## 9.1 Plancher chauffant

Dessin et calcul :

- boucles ;
- pas ;
- longueur ;
- débit ;
- pertes de charge ;
- puissance surfacique.

---

## 9.2 Radiateurs hydrauliques

- puissance ;
- régime ;
- débit ;
- équilibrage.

---

## 9.3 PAC avancée

- courbes fabricant ;
- bivalence ;
- dégivrage ;
- appoint ;
- SCOP ;
- profils horaires.

---

## 9.4 Climatisation

- charges été ;
- splits ;
- multi-split ;
- gainable ;
- puissance ;
- rendement.

---

## 9.5 Géothermie

Prévoir :

- capteur horizontal ;
- sondes verticales ;
- terrain ;
- longueurs ;
- échange thermique.

---

## 9.6 Poêle / biomasse

- puissance ;
- zone chauffée ;
- combustible ;
- stockage ;
- conduit.

---

# 10. Ventilation avancée

## 10.1 Double flux détaillée

- échangeur ;
- bypass ;
- antigel ;
- filtres ;
- équilibrage ;
- consommations ventilateurs.

---

## 10.2 Acoustique réseau

- bruit ventilateur ;
- vitesse ;
- silencieux ;
- atténuation ;
- transmission entre pièces.

---

## 10.3 CFD simplifiée / avancée

Futur module externe :

- distribution d’air ;
- températures ;
- vitesses ;
- zones mortes.

Ne pas intégrer un solveur CFD lourd dans le cœur.

Prévoir un adapter d’export/import.

---

# 11. Qualité de l’air avancée

## 11.1 Radon

- zone géographique ;
- ventilation ;
- sous-sol ;
- mesures ;
- stratégies d’atténuation.

---

## 11.2 COV

- matériaux ;
- émissions ;
- ventilation ;
- occupation.

---

## 11.3 Particules

- filtration ;
- air extérieur ;
- renouvellement.

---

## 11.4 Pollens

Option utile avec ventilation :

- filtres ;
- saison ;
- air extérieur.

---

# 12. Eau avancée

## 12.1 Eaux grises

Système :

```text
douche/lavabo
  ↓
traitement
  ↓
stockage
  ↓
usages compatibles
```

Séparation claire d’avec l’eau potable.

---

## 12.2 Traitement d’eau

- filtre ;
- adoucisseur ;
- UV ;
- osmose ;
- charbon actif.

Calcul :

- débit ;
- pertes ;
- entretien ;
- consommation.

---

## 12.3 Forage / puits

- profondeur ;
- niveau statique ;
- débit ;
- pompe ;
- réserve.

---

## 12.4 Assainissement autonome

Module futur :

- fosse ;
- filtre ;
- microstation ;
- épandage ;
- charge hydraulique.

Les règles locales doivent être totalement séparées.

---

## 12.5 Gestion des eaux pluviales du terrain

Au-delà de la cuve :

- infiltration ;
- noue ;
- bassin ;
- débit de fuite ;
- surface imperméabilisée.

---

# 13. Électricité avancée

## 13.1 Triphasé

- répartition des phases ;
- déséquilibre ;
- charges ;
- tableau.

---

## 13.2 Parafoudre / terre

Objets :

- prise de terre ;
- liaisons ;
- SPD ;
- équipotentialité.

Calculs possibles selon méthodes autorisées.

---

## 13.3 Groupe électrogène

- puissance ;
- démarrage ;
- autonomie ;
- commutation.

---

## 13.4 Onduleur / secours

- circuits prioritaires ;
- autonomie ;
- bascule réseau.

---

## 13.5 Recharge véhicule électrique

- borne ;
- puissance ;
- délestage ;
- solaire ;
- batterie ;
- calendrier de charge.

---

## 13.6 Micro-réseau domestique

Flux :

```text
grid
PV
battery
EV
generator
loads
```

Optimisation énergétique globale.

---

# 14. Smart home / domotique

## 14.1 Capteurs

Objets :

- température ;
- humidité ;
- CO₂ ;
- mouvement ;
- luminosité ;
- énergie ;
- eau ;
- fuite ;
- fumée.

---

## 14.2 Actionneurs

- volets ;
- chauffage ;
- VMC ;
- lumière ;
- vannes ;
- délestage.

---

## 14.3 Protocoles

Prévoir des métadonnées, pas une dépendance dans le noyau :

```text
KNX
Matter
Thread
Zigbee
Z-Wave
Modbus
MQTT
Home Assistant
```

---

## 14.4 Automatisations

Le logiciel pourrait générer :

```text
si CO2 > seuil
→ augmenter ventilation
```

mais la simulation doit rester distincte du déploiement réel.

---

# 15. Éclairage avancé

## 15.1 Lumière naturelle

- facteur lumière du jour ;
- orientation ;
- fenêtres ;
- masques ;
- réflexion.

---

## 15.2 Simulation solaire intérieure

Visualiser :

- taches solaires ;
- heures ;
- saisons ;
- surchauffe.

---

## 15.3 Photométrie complète

Importer :

```text
IES
LDT
```

Puis calcul de grille de lux.

---

# 16. Acoustique avancée

## 16.1 Isolation entre pièces

- parois ;
- portes ;
- transmissions latérales ;
- planchers.

---

## 16.2 Bruits de choc

- plancher ;
- revêtement ;
- sous-couche.

---

## 16.3 Bruit extérieur

- route ;
- train ;
- industrie ;
- façade.

---

## 16.4 Bruit équipements

- VMC ;
- PAC ;
- pompe ;
- plomberie.

---

# 17. Incendie / sécurité

## 17.1 Détection incendie

Objets :

- détecteurs ;
- alarmes ;
- extincteurs ;
- équipements.

---

## 17.2 Compartimentage

Zones :

```text
fire compartment
protected route
technical room
```

---

## 17.3 Évacuation

Calculs :

- distances ;
- passages ;
- sorties ;
- largeur.

Pour l’habitation individuelle, rester adapté au périmètre réel et aux règles applicables.

---

# 18. Accessibilité / ergonomie

## 18.1 Circulation

Vérifier :

- largeur ;
- demi-tour ;
- portes ;
- obstacles.

---

## 18.2 Salle d’eau

- zones d’usage ;
- dégagements ;
- accès.

---

## 18.3 Cuisine

- triangle d’usage ;
- dégagements ;
- hauteur équipements.

---

## 18.4 Escaliers

- giron ;
- hauteur ;
- main courante ;
- échappée.

Toutes les valeurs réglementaires doivent venir d’un Rule Pack.

---

# 19. Sécurité / intrusion

Module optionnel :

- alarmes ;
- détecteurs ;
- caméras ;
- zones ;
- couverture.

Le logiciel ne doit pas exposer publiquement de détails de sécurité par défaut dans les exports.

---

# 20. Réseaux numériques

## 20.1 Ethernet

- prises ;
- baie ;
- switch ;
- PoE ;
- longueurs.

---

## 20.2 Wi-Fi

Simulation simplifiée :

- points d’accès ;
- murs ;
- matériaux ;
- atténuation.

---

## 20.3 Fibre / télécom

- arrivée ;
- distribution ;
- prises.

---

# 21. Maintenance et exploitation

## 21.1 Carnet d’entretien

Chaque équipement peut porter :

```text
installation date
maintenance interval
life expectancy
replacement date
documentation
```

---

## 21.2 Filtres

Exemples :

- VMC ;
- eau ;
- PAC.

Le logiciel peut générer une liste d’entretien.

---

## 21.3 Durée de vie

Pour matériaux/équipements :

- durée de vie ;
- remplacements ;
- coût cycle de vie ;
- impact environnemental.

---

# 22. Digital twin / bâtiment réel

Évolution possible après conception :

```text
design model
   +
sensors
   +
actual consumption
   ↓
comparison design vs real
```

Exemples :

- température ;
- énergie ;
- eau ;
- CO₂ ;
- humidité ;
- production PV.

Le modèle doit distinguer :

```text
DESIGN_VALUE
MEASURED_VALUE
ESTIMATED_VALUE
```

---

# 23. Diagnostics de rénovation

Module très intéressant à terme.

Entrées :

- maison existante ;
- matériaux connus/inconnus ;
- factures ;
- mesures ;
- photos/données manuelles.

Le moteur propose :

- isolation ;
- fenêtres ;
- ventilation ;
- chauffage ;
- PV.

Comparer :

```text
coût
économie
énergie
confort
carbone
```

---

# 24. Optimiseur global

Évolution majeure.

Objectifs :

```text
MIN_COST
MIN_ENERGY
MIN_CARBON
MAX_AUTONOMY
MAX_COMFORT
CUSTOM
```

Variables :

- isolation ;
- vitrage ;
- chauffage ;
- PV ;
- batterie ;
- ventilation ;
- eau ;
- matériaux.

Contraintes :

- budget ;
- dimensions ;
- réglementation ;
- surface ;
- puissance.

Sortie :

- solutions admissibles ;
- front de Pareto ;
- compromis.

Ne pas produire un score unique opaque.

---

# 25. Analyse de sensibilité

Pour chaque paramètre :

```text
variation ±10 %
→ variation résultat
```

Permet de savoir quels paramètres sont réellement importants.

Exemples :

- épaisseur isolant ;
- rendement VMC ;
- taille batterie ;
- consommation ECS.

---

# 26. Monte Carlo / incertitude

Futur module avancé :

- distributions ;
- centaines/milliers de simulations ;
- intervalles de confiance.

Applicable à :

- coûts ;
- météo ;
- consommation ;
- performance matériaux.

---

# 27. Gestion financière

## 27.1 Coût complet

- matériaux ;
- main-d’œuvre ;
- équipements ;
- maintenance ;
- énergie ;
- remplacement.

---

## 27.2 Retour sur investissement

- investissement ;
- économies ;
- durée ;
- scénarios énergie.

---

## 27.3 Tarifs énergie

Interface extensible pour :

- heures creuses ;
- prix dynamique ;
- abonnement ;
- export PV.

Les prix externes doivent être importés comme données datées.

---

# 28. Planning chantier

Module futur :

```text
tasks
dependencies
resources
durations
milestones
```

Utiliser les quantités du projet.

Exemples :

- murs ;
- isolation ;
- réseaux ;
- finitions.

---

# 29. Logistique chantier

- matériaux ;
- volumes ;
- livraisons ;
- stockage ;
- déchets.

---

# 30. Déchets et réemploi

Module :

- quantité déchets ;
- réemploi ;
- recyclage ;
- dépose sélective.

Particulièrement pertinent pour rénovation.

---

# 31. Génération documentaire

## 31.1 Nomenclatures

Automatique :

- matériaux ;
- équipements ;
- réseaux ;
- symboles.

---

## 31.2 Plans techniques

- architecture ;
- plomberie ;
- ventilation ;
- électrique ;
- chauffage ;
- PV.

---

## 31.3 Rapports

Générer :

- hypothèses ;
- calculs ;
- résultats ;
- warnings ;
- sources ;
- Rule Packs.

---

## 31.4 Cahier de matériaux

Pour chaque matériau :

- utilisation ;
- quantité ;
- propriétés ;
- sources ;
- environnement.

---

# 32. Interopérabilité CAO/BIM

## 32.1 DXF

Priorité future raisonnable :

- lignes ;
- calques ;
- cotes ;
- symboles ;
- polylignes.

---

## 32.2 IFC

Évolution importante.

Il faut éviter de prétendre supporter IFC tant que les mappings ne sont pas robustes.

Préparer cependant les correspondances :

```text
Wall
Space
Slab
Roof
Opening
Equipment
DistributionSystem
```

---

## 32.3 gbXML / formats énergétiques

Possible pour échange avec moteurs de simulation.

---

## 32.4 GeoJSON / GIS

Pour :

- parcelle ;
- site ;
- réseaux extérieurs ;
- données territoriales.

---

# 33. Moteurs externes

L’architecture doit pouvoir brancher des adapters vers :

- moteur thermique dynamique ;
- moteur CFD ;
- calcul structure ;
- analyse solaire ;
- ACV ;
- géospatial.

Le noyau transmet des données normalisées et récupère des résultats traçables.

---

# 34. Plugins

Évolution possible :

```text
Plugin
├── domain extension
├── calculation module
├── view
├── symbols
├── catalogs
└── rules
```

Ne pas rendre les plugins capables d’exécuter arbitrairement du code distant dans le navigateur.

Au début, préférer des plugins compilés/validés au build.

---

# 35. IA / assistant de conception

Option future, non essentielle au noyau.

Usages possibles :

- expliquer un warning ;
- proposer des variantes ;
- chercher des objets du catalogue ;
- générer des hypothèses à confirmer ;
- aider à remplir les données manquantes.

L’IA ne doit jamais :

- modifier silencieusement le projet ;
- inventer une conformité ;
- remplacer un calcul déterministe ;
- masquer la provenance.

Le modèle reste piloté par commandes explicites.

---

# 36. Import depuis plans existants

Futur :

- DXF ;
- SVG ;
- image comme fond ;
- PDF comme référence ;
- éventuellement reconnaissance assistée.

Le fond importé doit rester distinct de la géométrie paramétrique.

---

# 37. Scan / relevé de bâtiment existant

Évolution :

- import LiDAR ;
- nuage de points ;
- mesures ;
- plans relevés.

Le modèle paramétrique reste séparé du nuage brut.

---

# 38. Mobile / tablette

L’éditeur desktop reste prioritaire.

Prévoir cependant :

- lecture de projet ;
- prise de mesures ;
- photos ;
- annotations chantier ;
- checklist.

---

# 39. Collaboration

Futur :

- commentaires ;
- revisions ;
- branches/scénarios ;
- comparaison ;
- historique.

Ne pas bloquer l’architecture avec un système de collaboration temps réel dès le MVP.

---

# 40. Internationalisation

Prévoir :

- unités métriques/impériales ;
- formats de nombre ;
- langues ;
- symboles ;
- conventions ;
- Rule Packs par pays.

Le stockage interne reste indépendant de la locale.

---

# 41. Modules environnementaux futurs

## 41.1 Eau grise
## 41.2 Biodiversité / végétalisation
## 41.3 Toiture végétalisée
## 41.4 Empreinte eau
## 41.5 Circularité
## 41.6 Réemploi
## 41.7 Fin de vie
## 41.8 Stockage carbone biogénique

Chaque méthode doit avoir sa référence propre.

---

# 42. Risques climatiques / résilience

Module très utile à long terme :

- canicule ;
- gel ;
- sécheresse ;
- inondation ;
- ruissellement ;
- vent ;
- incendie ;
- coupure électrique ;
- pénurie d’eau.

Le bâtiment peut être évalué selon plusieurs scénarios.

---

# 43. Mode autonomie / maison résiliente

Vue dédiée combinant :

```text
PV
battery
water
rainwater
heating
food storage optional
backup
```

Indicateurs :

- autonomie électrique ;
- autonomie eau ;
- durée de secours ;
- énergie non servie ;
- consommation critique.

---

# 44. Piscine / spa

Module optionnel mais cohérent :

- volume ;
- filtration ;
- pompe ;
- chauffage ;
- pertes thermiques ;
- consommation eau ;
- couverture solaire.

---

# 45. Serre / jardin

Module extérieur optionnel :

- irrigation ;
- eau pluie ;
- éclairage ;
- serre ;
- thermique simplifiée.

---

# 46. Atelier / garage

Modules particuliers :

- ventilation ;
- extraction ;
- éclairage ;
- puissance électrique ;
- recharge véhicule ;
- bruit.

---

# 47. Sécurité des données

À prévoir dès le départ :

- projets locaux par défaut ;
- aucune transmission nécessaire pour calculs locaux ;
- données externes explicitement demandées ;
- export/import transparent ;
- aucune donnée privée cachée dans les fichiers.

---

# 48. Architecture de métadonnées

Tous les objets importants devraient pouvoir accepter :

```ts
interface CommonMetadata {
  tags?: string[];
  notes?: string;
  externalIds?: Record<string, string>;
  customProperties?: Record<string, unknown>;
}
```

Ceci permet des extensions sans modifier immédiatement le schéma principal.

Les `customProperties` doivent être namespacées à terme.

---

# 49. Système d’extensions

Prévoir :

```text
extensions:
  namespace:
    ...
```

Exemple :

```json
{
  "extensions": {
    "org.example.custom-module": {
      "foo": "bar"
    }
  }
}
```

Le cœur doit préserver les extensions inconnues lors d’un chargement/sauvegarde.

---

# 50. Priorités recommandées après le MVP

## Priorité A — forte valeur

1. confort d’été ;
2. simulation thermique temporelle ;
3. lumière naturelle ;
4. eaux grises ;
5. chauffage hydraulique détaillé ;
6. coûts cycle de vie ;
7. rénovation ;
8. plans/coupes/façades complets ;
9. DXF ;
10. IFC initial.

## Priorité B — forte profondeur technique

11. structure simplifiée ;
12. géotechnique ;
13. solaire thermique ;
14. acoustique avancée ;
15. assainissement autonome ;
16. triphasé ;
17. EV charging ;
18. domotique ;
19. maintenance ;
20. digital twin.

## Priorité C — avancé / spécialisé

21. CFD ;
22. calcul structure avancé ;
23. Monte Carlo ;
24. optimisation globale ;
25. scan/LiDAR ;
26. collaboration temps réel ;
27. plugins externes ;
28. IA assistant.

---

# 51. Matrice dépendances futures

| Module futur | Dépendances principales |
|---|---|
| Thermique dynamique | géométrie, climat, matériaux, occupation |
| Confort été | thermique dynamique, solaire, ventilation |
| Structure | géométrie, matériaux, charges |
| Géotechnique | site, terrain |
| Lumière naturelle | géométrie, ouvertures, climat, ombrage |
| Eaux grises | eau, évacuation, équipements |
| Assainissement | évacuation, site, sol |
| EV | électricité, énergie, PV, batterie |
| Smart home | équipements, réseaux, profils |
| Digital twin | projet, capteurs, séries temporelles |
| Optimiseur | tous modules sélectionnés |
| IFC | modèle domaine, relations, unités |
| Rénovation | phases, scénarios, incertitude |
| Planning chantier | quantités, phases |
| Maintenance | équipements, dates, catalogues |

---

# 52. Extensions à réserver dans le modèle maintenant

Ces points doivent être décidés avant PR-001 à PR-010 :

```text
✓ coordonnées 3D possibles
✓ plusieurs bâtiments
✓ plusieurs niveaux
✓ phases
✓ scénarios
✓ metadata extensibles
✓ zones multiples
✓ références externes
✓ ports équipements
✓ réseaux génériques
✓ catalogues versionnés
✓ données temporelles
✓ provenance
✓ incertitude future
✓ Rule Packs composables
✓ adapters externes
✓ extensions namespacées
```

---

# 53. Ce qu’il ne faut pas mettre dans le noyau

Éviter absolument :

```text
NF C 15-100 hardcodée
RE2020 hardcodée
débits VMC hardcodés
prix hardcodés
climat distant obligatoire
catalogue fabricant obligatoire
couleurs de réseaux hardcodées
formules physiques dans React
API externe dans core-domain
IA dans moteur de calcul
```

---

# 54. Critère d’extensibilité

Une nouvelle discipline devrait pouvoir être ajoutée en créant principalement :

```text
modules/new-domain/
catalogs/new-domain/
rules/new-domain/
symbols/new-domain/
views/new-domain/
```

sans modifier :

```text
geometry core
project I/O fundamental model
editor command architecture
calculation orchestrator
rendering pipeline
```

sauf ajout d’un concept réellement générique manquant.

---

# 55. Objectif final possible

À long terme, le projet peut devenir :

```text
HOUSE TECHNICAL DESIGNER
        │
        ├── Architecture
        ├── Site
        ├── Structure
        ├── Thermal
        ├── Energy
        ├── Water
        ├── Air
        ├── Electrical
        ├── Lighting
        ├── Acoustic
        ├── Environment
        ├── Cost
        ├── Regulations
        ├── Construction
        └── Operation
```

avec un principe toujours identique :

```text
dessiner
   ↓
décrire
   ↓
calculer
   ↓
visualiser
   ↓
comparer
   ↓
contrôler
```

Le logiciel reste utilisable module par module, mais l’intérêt maximal vient de la cohérence entre tous les systèmes de la maison.
