/**
 * Retires the families that describe an object somebody else already describes.
 *
 * It was invisible while nobody had written a fiche: two empty families do not
 * look alike. Once each had one, they turned up side by side in the same list
 * — three pairs down to the same name, which gave a project two objects of the
 * same identifier — and CG-08 wrote them down.
 *
 * The rule the merges follow is the one CG-06 already applied to nine site
 * families: **a place is not a nature of object**. A piquet de terre is a
 * piquet de terre whether the electrician specifies it or the site plan draws
 * it; a fosse toutes eaux does not become another thing for standing outdoors.
 * `SITE_`, `SAFETY_` and `DATA_` were prefixes for a viewpoint, and the family
 * that survives is the one whose trade specifies the object. Where being
 * outdoors matters, it is `placement.allowedHosts`, not a second family.
 *
 * Nothing is deleted. A record that only ever grows is a catalogue nobody can
 * correct, so the lifecycle the registry already has does the work: the family
 * leaves service, says what replaces it and why, and the files that hold it go
 * on opening.
 */
import { readFileSync, writeFileSync, globSync } from 'node:fs';

interface Merge {
  readonly from: string;
  readonly to: string;
  readonly why: string;
}

const MERGED: readonly Merge[] = [
  {
    from: 'SITE_EXTERIOR_LIGHT',
    to: 'EXTERIOR_LIGHT',
    why: 'un luminaire extérieur est le même objet, qu’il soit décrit par le lot éclairage ou par le plan de masse',
  },
  {
    from: 'SITE_EXTERIOR_SOCKET',
    to: 'EXTERIOR_SOCKET',
    why: 'une prise étanche est le même objet, dehors comme dedans : c’est son indice de protection qui le dit',
  },
  {
    from: 'SITE_EARTH_ROD',
    to: 'EARTH_ROD',
    why: 'un piquet de terre est toujours enfoui ; le lot électricité en décrit la résistance, pas le plan de masse',
  },
  {
    from: 'SITE_SEPTIC_TANK',
    to: 'SEPTIC_TANK',
    why: 'une fosse toutes eaux est un ouvrage d’assainissement, et elle est toujours sur la parcelle',
  },
  {
    from: 'SITE_MICRO_TREATMENT_PLANT',
    to: 'MICRO_TREATMENT_PLANT',
    why: 'même objet, même métier : l’assainissement non collectif',
  },
  {
    from: 'SITE_RAINWATER_CHAMBER',
    to: 'RAINWATER_CHAMBER',
    why: 'un regard pluvial appartient au réseau d’eaux pluviales, où qu’il soit posé',
  },
  {
    from: 'SITE_WATER_METER',
    to: 'WATER_METER',
    why: 'un compteur d’eau en regard reste un compteur d’eau',
  },
  {
    from: 'SITE_EV_CHARGER',
    to: 'EV_CHARGER',
    why: 'une borne sur pied et une borne murale sont la même famille ; le support est une donnée de pose',
  },
  {
    from: 'UTILITY_METER',
    to: 'SERVICE_METER',
    why: 'le compteur de concession est le compteur de branchement',
  },
  {
    from: 'DATA_PRESENCE_SENSOR',
    to: 'PRESENCE_SENSOR',
    why: 'un détecteur de présence est le même capteur, qu’il commande l’éclairage ou une automatisation',
  },
  {
    from: 'SAFETY_MOTION_DETECTOR',
    to: 'MOTION_SENSOR',
    why: 'un détecteur de mouvement infrarouge est le même appareil ; ce qu’il alimente est une affaire de réseau',
  },
  {
    from: 'SAFETY_CO2_DETECTOR',
    to: 'CO2_SENSOR',
    why: 'le dioxyde de carbone se mesure, il ne se détecte pas comme un danger : le monoxyde a sa propre famille',
  },
  {
    from: 'WINDOW_SENSOR',
    to: 'DOOR_CONTACT',
    why: 'un contact d’ouvrant est le même composant sur une porte et sur une fenêtre',
  },
  {
    from: 'SAFETY_EMERGENCY_LIGHT',
    to: 'EMERGENCY_LIGHT',
    why: 'un bloc autonome d’éclairage de sécurité est un luminaire, décrit une fois',
  },
  // Le conduit de fumée existait dans deux registres : un tronçon droit est un
  // produit de réseau, qui se compte au mètre et se choisit par diamètre. Un
  // coude, un té, une souche restent des équipements. Le métré comptait deux
  // fois le même mètre linéaire.
  {
    from: 'ROOF_WINDOW',
    to: 'WINDOW_ROOF',
    why: 'le registre des menuiseries déclarait déjà la fenêtre de toit ; celle-ci en était une copie rangée chez les assemblages',
  },
  {
    from: 'SINGLE_WALL_FLUE',
    to: 'FLUE_PIPE',
    why: 'un tronçon droit se compte au mètre : c’est un produit de réseau, et le métré le comptait deux fois',
  },
  {
    from: 'INSULATED_FLUE',
    to: 'FLUE_PIPE',
    why: 'un tronçon droit se compte au mètre : c’est un produit de réseau, et le métré le comptait deux fois',
  },
  {
    from: 'FLEXIBLE_LINER',
    to: 'FLUE_PIPE',
    why: 'un tubage se compte au mètre : c’est un produit de réseau, et le métré le comptait deux fois',
  },
];

/**
 * Ce que deux noms identiques cachaient : deux objets bel et bien différents.
 *
 * Fusionner ceux-là serait la faute inverse — une sonde de circuit et un
 * capteur d'ambiance ne mesurent pas la même chose, un drain périphérique
 * n'est pas une naissance de gouttière, et une coupure d'urgence de branchement
 * n'est pas un arrêt d'urgence à champignon. Ce qui manquait n'était pas une
 * fusion, c'était un libellé qui dise lequel est lequel.
 */
const RELABELLED: Readonly<Record<string, string>> = {
  // Un mot de métier partagé par deux métiers. Un té d'eau et un té de gaine
  // ne sont pas le même objet, et « té » tout court ne dit pas lequel on pose.
  VALLEY: 'Noue de toiture',
  VALLEY_GUTTER: 'Chéneau de noue',
  VENT_OUTLET: 'Sortie de toit ventilée',
  CHIMNEY_TERMINAL: 'Terminal de conduit de fumée',
  FILTER: 'Filtre d’eau',
  VENTILATION_FILTER: 'Filtre de ventilation',
  TEE: 'Té d’eau',
  VENTILATION_TEE: 'Té de gaine',
  ELBOW: 'Coude d’eau',
  VENTILATION_ELBOW: 'Coude de gaine',
  REDUCER: 'Réduction d’eau',
  WASTE_REDUCER: 'Réduction d’évacuation',
  VENTILATION_REDUCER: 'Réduction de gaine',
  ISOLATION_VALVE: 'Vanne d’isolement d’eau',
  HEATING_ISOLATION_VALVE: 'Vanne d’isolement de chauffage',
  CHECK_VALVE: 'Clapet anti-retour d’eau',
  BACKWATER_VALVE: 'Clapet anti-retour d’évacuation',
  BACKDRAFT_DAMPER: 'Clapet anti-retour d’air',
  BALANCING_VALVE: 'Vanne d’équilibrage d’eau',
  HEATING_BALANCING_VALVE: 'Vanne d’équilibrage de chauffage',
  AIR_VENT: 'Purgeur d’air de distribution',
  HEATING_AIR_VENT: 'Purgeur d’air de chauffage',
  EXPANSION_VESSEL: 'Vase d’expansion sanitaire',
  HEATING_EXPANSION_VESSEL: 'Vase d’expansion de chauffage',
  WYE: 'Culotte d’évacuation',
  Y_BRANCH: 'Culotte de gaine',
  RELAY: 'Relais électrique',
  DATA_RELAY: 'Relais domotique',
  BATTERY_RACK: 'Armoire batterie de stockage',
  WARDROBE: 'Armoire de rangement',
  TEMPERATURE_SENSOR: 'Sonde de température de circuit',
  DATA_TEMPERATURE_SENSOR: 'Capteur de température ambiante',
  SUB_METER: 'Sous-compteur d’eau',
  ELECTRICAL_SUB_METER: 'Sous-compteur électrique',
  SITE_DRAIN: 'Drain périphérique de fondation',
  ROOF_DRAIN: 'Naissance de descente pluviale',
  ELECTRICAL_EMERGENCY_CUTOFF: 'Coupure d’urgence de branchement',
  EMERGENCY_STOP: 'Arrêt d’urgence à champignon',
};

const files = globSync('packages/catalog-registry/data/families/**/*.json');
const byId = new Map<string, { id: string; label?: string }>();
for (const file of files) {
  const held = JSON.parse(readFileSync(file, 'utf8')) as {
    families?: { id: string; label?: string }[];
  };
  for (const family of held.families ?? []) byId.set(family.id, family);
}

for (const { from, to } of MERGED) {
  if (!byId.has(from)) {
    console.error(`Famille inconnue : ${from}`);
    process.exit(1);
  }
  if (!byId.has(to)) {
    console.error(`Famille de remplacement inconnue : ${to}`);
    process.exit(1);
  }
}
for (const id of Object.keys(RELABELLED))
  if (!byId.has(id)) {
    console.error(`Famille inconnue : ${id}`);
    process.exit(1);
  }

let retired = 0;
let renamed = 0;
for (const file of files) {
  const held = JSON.parse(readFileSync(file, 'utf8')) as {
    families?: Record<string, unknown>[];
  };
  let touched = false;
  for (const family of held.families ?? []) {
    const id = family['id'] as string;
    const merge = MERGED.find((one) => one.from === id);
    if (merge !== undefined) {
      family['lifecycle'] = 'DEPRECATED';
      family['replacedBy'] = merge.to;
      family['retiredReason'] = merge.why;
      retired += 1;
      touched = true;
    }
    const label = RELABELLED[id];
    if (label !== undefined && family['label'] !== label) {
      family['label'] = label;
      renamed += 1;
      touched = true;
    }
  }
  if (touched)
    writeFileSync(file, `${JSON.stringify(held, undefined, 2)}\n`, 'utf8');
}

console.log(`${retired} familles retirées du service, ${renamed} renommées.`);
