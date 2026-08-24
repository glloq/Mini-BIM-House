/**
 * Une image choisie devient un calque de papier.
 *
 * Le fichier est lu en `data:` URI et non gardé par son chemin : un plan
 * rouvert sur une autre machine sans son relevé est un plan qu'on ne peut pas
 * continuer, et un chemin local ne se transporte pas.
 *
 * Ce qui se mesure ici est le **rapport** de l'image, pas sa taille en pixels :
 * un cadastre n'a pas de millimètres, il a une forme. La largeur en mètres est
 * dite par la personne — c'est la seule chose qu'elle sait et que le fichier
 * ignore — et la hauteur en découle.
 */
import type { SiteUnderlay } from '@house-technical-designer/core-domain';

/**
 * Ce qu'un calque de papier pèse au plus, en octets de fichier.
 *
 * Il voyage dans le projet, et un projet de trente mégaoctets est un projet
 * qu'on n'envoie pas. Six mégaoctets tiennent un scan A3 à 200 points par
 * pouce, ce qui est déjà plus qu'il n'en faut pour tracer par-dessus.
 */
export const UNDERLAY_MAXIMUM_BYTES = 6 * 1024 * 1024;

/** Une largeur par défaut : vingt mètres, l'ordre de grandeur d'une parcelle. */
export const UNDERLAY_DEFAULT_WIDTH_MM = 20_000;

export type UnderlayLoad =
  | { readonly status: 'OK'; readonly underlay: SiteUnderlay }
  | { readonly status: 'ERROR'; readonly message: string };

/** Le rapport d'une image, lu du fichier lui-même. */
async function proportions(
  source: string,
): Promise<{ readonly width: number; readonly height: number } | undefined> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener('load', () =>
      resolve({ width: image.naturalWidth, height: image.naturalHeight }),
    );
    image.addEventListener('error', () => resolve(undefined));
    image.src = source;
  });
}

function dataUri(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener('load', () =>
      resolve(typeof reader.result === 'string' ? reader.result : undefined),
    );
    reader.addEventListener('error', () => resolve(undefined));
    reader.readAsDataURL(file);
  });
}

export async function underlayFromFile(
  file: File,
  options: {
    readonly originMm: { readonly x: number; readonly y: number };
    readonly widthMm?: number;
  },
): Promise<UnderlayLoad> {
  if (!file.type.startsWith('image/'))
    return {
      status: 'ERROR',
      message: `« ${file.name} » n’est pas une image.`,
    };
  if (file.size > UNDERLAY_MAXIMUM_BYTES)
    return {
      status: 'ERROR',
      message: `« ${file.name} » pèse ${Math.round(file.size / 1024 / 1024)} Mio ; le calque de fond en accepte ${UNDERLAY_MAXIMUM_BYTES / 1024 / 1024}.`,
    };
  const image = await dataUri(file);
  if (image === undefined)
    return { status: 'ERROR', message: `« ${file.name} » n’a pas pu être lu.` };
  const shape = await proportions(image);
  if (shape === undefined || shape.width === 0)
    return {
      status: 'ERROR',
      message: `« ${file.name} » n’a pas de dimensions lisibles.`,
    };
  const widthMm = options.widthMm ?? UNDERLAY_DEFAULT_WIDTH_MM;
  return {
    status: 'OK',
    underlay: {
      image,
      originMm: { ...options.originMm },
      widthMm,
      heightMm: (widthMm * shape.height) / shape.width,
      opacity: 0.55,
      name: file.name,
    },
  };
}

/** La même image, redimensionnée par sa largeur — son rapport est gardé. */
export function underlayAtWidth(
  underlay: SiteUnderlay,
  widthMm: number,
): SiteUnderlay {
  const ratio = underlay.heightMm / underlay.widthMm;
  return { ...underlay, widthMm, heightMm: widthMm * ratio };
}
