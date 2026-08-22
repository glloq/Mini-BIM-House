import type { ClimateDataset, ClimateLocation } from './climate.js';

/**
 * The weather of one place, in the resolutions it is known at.
 *
 * A project asks for a climate by name and gets several files: monthly
 * normals, a design day, sometimes an hourly year. They belong together
 * because they describe the same place — not because they happened to be
 * loaded at the same time.
 *
 * The application used to pick, in order: the dataset the project named, then
 * any dataset that was not hourly, then simply the first one. A project asking
 * for Bordeaux and given Paris and Nantes was computed with one of them, and
 * nothing said so. That contradicts the rule this application is built on: an
 * unknown must stay unknown.
 */
export interface ClimateBundle {
  /** The dataset the project named, which is what identifies the bundle. */
  readonly id: string;
  readonly location: ClimateLocation;
  readonly datasets: readonly ClimateDataset[];
  /** Design conditions, when the place has them. */
  readonly design?: ClimateDataset;
  /** The coarse series a yearly balance is run on. */
  readonly monthly?: ClimateDataset;
  /** The regular sub-daily series a dispatch needs. */
  readonly hourly?: ClimateDataset;
}

export type ClimateSelection =
  | { readonly status: 'OK'; readonly bundle: ClimateBundle }
  /** The project named a climate and it is not among the ones supplied. */
  | {
      readonly status: 'MISSING';
      readonly requested: string;
      readonly available: readonly string[];
      readonly message: string;
    }
  /** Climate data was supplied and the project names none of it. */
  | {
      readonly status: 'UNSPECIFIED';
      readonly available: readonly string[];
      readonly message: string;
    }
  /** No climate at all, which is not an error — it is a project without one. */
  | { readonly status: 'NONE' };

/** A tenth of a degree of latitude is about eleven kilometres. */
const LOCATION_TOLERANCE_DEG = 0.05;

function samePlace(first: ClimateLocation, second: ClimateLocation): boolean {
  return (
    first.timezone === second.timezone &&
    Math.abs(first.latitude - second.latitude) <= LOCATION_TOLERANCE_DEG &&
    Math.abs(first.longitude - second.longitude) <= LOCATION_TOLERANCE_DEG
  );
}

function ofResolution(
  datasets: readonly ClimateDataset[],
  ...resolutions: readonly ClimateDataset['resolution'][]
): ClimateDataset | undefined {
  for (const resolution of resolutions) {
    const found = datasets.find((dataset) => dataset.resolution === resolution);
    if (found !== undefined) return found;
  }
  return undefined;
}

/**
 * The weather to compute with, or why there is none.
 *
 * The bundle is every dataset describing the same place as the one the project
 * named. An hourly file of another town is not this town's hourly file, and
 * pairing them would give a house a design day from one place and a year from
 * another.
 */
export function selectClimate(
  datasets: readonly ClimateDataset[],
  climateProfileId: string | undefined,
): ClimateSelection {
  const available = datasets.map(({ id }) => id);
  if (climateProfileId === undefined)
    return datasets.length === 0
      ? { status: 'NONE' }
      : {
          status: 'UNSPECIFIED',
          available,
          message: `Ce projet ne dit pas quel climat il utilise ; ${available.length} jeu(x) sont chargés (${available.join(', ')}) et aucun n’est choisi à sa place.`,
        };
  const named = datasets.find(({ id }) => id === climateProfileId);
  if (named === undefined)
    return {
      status: 'MISSING',
      requested: climateProfileId,
      available,
      message:
        available.length === 0
          ? `Le projet demande le climat ${climateProfileId} et aucun jeu climatique n’est chargé.`
          : `Le projet demande le climat ${climateProfileId}, absent des jeux chargés (${available.join(', ')}) : aucun autre n’est utilisé à sa place.`,
    };
  const here = datasets.filter((dataset) =>
    samePlace(dataset.location, named.location),
  );
  const design = ofResolution(here, 'DESIGN_CONDITIONS');
  const hourly = ofResolution(here, 'HOURLY');
  const monthly = ofResolution(here, 'MONTHLY', 'DAILY');
  return {
    status: 'OK',
    bundle: {
      id: named.id,
      location: named.location,
      datasets: here,
      ...(design === undefined ? {} : { design }),
      ...(monthly === undefined ? {} : { monthly }),
      ...(hourly === undefined ? {} : { hourly }),
    },
  };
}

/**
 * The series a yearly or steady-state calculation reads.
 *
 * The named dataset first — a project asking for a design day gets its design
 * day — then the coarse series of the same place.
 */
export function primarySeries(bundle: ClimateBundle): ClimateDataset {
  return (
    bundle.datasets.find(({ id }) => id === bundle.id) ??
    bundle.monthly ??
    bundle.design ??
    bundle.datasets[0]!
  );
}
