/**
 * Le reste du métier, posable en deux gestes.
 *
 * La boîte à outils nomme soixante-dix-neuf familles ; la nomenclature en tient
 * trois cent quatre-vingts qu'on peut poser, dont deux cent soixante-six ont
 * déjà une fiche générique. Les deux cent soixante-six autres étaient
 * atteignables — la bibliothèque les tient toutes — mais y arriver demandait de
 * quitter le plan, d'aller dans « Équipements », de chercher, d'ajouter au
 * projet, de revenir, de reprendre l'outil composant, puis de retrouver la
 * fiche dans une liste déroulante. Six gestes pour poser un mitigeur.
 *
 * Trois cent une entrées de plus ne sont pas la réponse : c'est le mur de
 * boutons que la boîte à outils a démonté. La réponse est **une** entrée par
 * sous-partie — « Autre… » — qui ouvre la nomenclature déjà filtrée sur les
 * métiers de cette sous-partie, et qui, sur le choix d'une famille, installe sa
 * fiche **et** prend l'outil avec elle. Il reste un clic sur le plan, comme
 * pour n'importe quel bouton nommé.
 *
 * Sur *les* métiers, au pluriel : une sous-partie en mêle souvent deux — la
 * salle de bain le sanitaire et le mobilier, la cuisine l'électroménager et le
 * mobilier — et n'en ouvrir qu'un laissait l'autre moitié de ce qu'elle pose
 * derrière un élargissement à la main.
 *
 * Rien n'est écrit ici que la bibliothèque ne sache déjà : c'est le même
 * `CatalogBrowser`, le même dépôt, la même commande d'installation.
 */
import { useMemo } from 'react';
import type { Project } from '@house-technical-designer/core-domain';
import {
  isHostType,
  type HostType,
} from '@house-technical-designer/core-domain';
import type { EquipmentDefinition } from '@house-technical-designer/equipment-catalog';
import { SYMBOL_LIBRARY_V1 } from '@house-technical-designer/drawing-engine';
import {
  AddEquipmentCommand,
  type ProjectCommand,
} from '@house-technical-designer/editor-core';
import {
  catalogEvidence,
  family,
  familyCapabilities,
  installedCatalog,
  type CatalogSummary,
  type DataDomain,
} from '@house-technical-designer/catalog-registry';

import { CatalogBrowser } from './CatalogBrowser.js';
import type { CatalogFilter } from './catalog-browser.js';
import { projectEquipmentFromCatalog } from './library-model.js';

export interface FamilyPickerProps {
  readonly project: Project;
  /** Le métier de la sous-partie d'où on l'ouvre : la nomenclature s'y ouvre. */
  readonly domain?: DataDomain;
  /**
   * Tous les métiers que la sous-partie sert, du plus servi au moins servi.
   *
   * Une sous-partie n'en sert pas qu'un : la salle de bain pose des sanitaires
   * **et** des meubles, la cuisine de l'électroménager **et** des meubles. Le
   * sélecteur n'en prenait qu'un, et l'autre moitié de ce qu'elle pose restait
   * derrière un élargissement à la main — sur le chemin de toutes les familles
   * que la boîte à outils ne nomme pas, c'est-à-dire l'immense majorité.
   *
   * La coque envoie des chaînes, pas une fonction de la nomenclature : le
   * registre pèse soixante et onze kio et n'a rien à faire dans le premier
   * écran, que cette bibliothèque est justement chargée à la demande pour ne
   * pas alourdir.
   */
  readonly domains?: readonly DataDomain[];
  /** Ce qu'on lit en tête : « Électricité — le reste du métier ». */
  readonly title: string;
  readonly onCommand: (command: ProjectCommand) => boolean;
  /**
   * La fiche installée, et sa catégorie — de quoi prendre l'outil composant.
   *
   * Le sélecteur ne prend pas l'outil lui-même : il ne sait pas ce qu'est un
   * outil, et n'a pas à l'apprendre.
   */
  readonly onPlace: (equipmentId: string, category: string) => void;
  readonly onClose: () => void;
  readonly onMessage: (message: string) => void;
}

/** Ce à quoi la nomenclature dit qu'un objet de cette famille se fixe. */
function allowedHostsOfFamily(
  familyId: string,
): readonly HostType[] | undefined {
  const hosts = family(familyId)?.placement?.allowedHosts;
  return hosts === undefined ? undefined : hosts.filter(isHostType);
}

export function FamilyPicker({
  project,
  domain,
  domains,
  title,
  onCommand,
  onPlace,
  onClose,
  onMessage,
}: FamilyPickerProps) {
  const repository = useMemo(() => installedCatalog(), []);
  const summariesByFamily = useMemo(() => {
    const groups: Record<string, CatalogSummary[]> = {};
    for (const summary of repository.index.byRegistry.get('EQUIPMENT') ?? [])
      if (summary.familyId !== undefined)
        (groups[summary.familyId] ??= []).push(summary);
    return groups;
  }, [repository]);
  const known = useMemo(
    () => ({
      symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
      entries: [],
      evidence: catalogEvidence(repository.summaries),
    }),
    [repository],
  );
  const takenIds = (project.equipment ?? []).map(({ id }) => id);
  /*
   * Ce sur quoi la nomenclature s'ouvre, monté ici et non dans le JSX.
   *
   * Rien n'est passé quand on ne sait rien : un `openOn` vide n'est pas
   * neutre, il coche « seulement ce qui est posable ». Ouvrir sans métier
   * connu doit rendre la nomenclature telle qu'elle est, sans case cochée
   * dans le dos de la personne.
   */
  const openOn: CatalogFilter = {
    ...(domain === undefined ? {} : { domain }),
    ...(domains === undefined || domains.length === 0 ? {} : { domains }),
  };
  const opened = Object.keys(openOn).length > 0;

  return (
    <div
      className="family-picker panel"
      role="dialog"
      aria-label="Depuis la nomenclature"
    >
      <header className="panel-heading">
        <div>
          <p className="panel-label">Depuis la nomenclature</p>
          <h2>{title}</h2>
        </div>
        <button type="button" className="secondary" onClick={onClose}>
          Fermer
        </button>
      </header>
      {/*
       * Ouvert sur les métiers de la sous-partie, et sur ce qui a une fiche.
       *
       * Une nomenclature de cinq cents familles ouverte à plat est une liste
       * qu'on ne lit pas ; ouverte sur les soixante-quatre de l'électricité,
       * elle est un catalogue. Sur *tous* ses métiers plutôt que sur le seul
       * plus servi, parce qu'une sous-partie en sert souvent deux et que
       * l'élargissement à la main est le geste que personne ne devine. Les
       * filtres restent là : on les rétrécit ou on les élargit d'un clic.
       */}
      <CatalogBrowser
        summariesByFamily={summariesByFamily}
        known={known}
        {...(opened ? { openOn } : {})}
        placeLabel="Poser sur le plan"
        onAdd={(summary) => {
          void repository.entry(summary.ref).then((body) => {
            const definition = body as EquipmentDefinition | undefined;
            const familyId = summary.familyId ?? '';
            if (definition === undefined) {
              onMessage(`La fiche ${summary.id} est introuvable.`);
              return;
            }
            /*
             * Déjà installée, on ne la réinstalle pas.
             *
             * Poser deux radiateurs ne veut pas dire tenir deux fois la même
             * fiche : une fiche est un modèle, et le projet en garde un
             * exemplaire.
             */
            const held = (project.equipment ?? []).find(
              (item) => item.familyId === familyId,
            );
            if (held !== undefined) {
              onPlace(held.id, held.kind);
              onClose();
              return;
            }
            const added = projectEquipmentFromCatalog(
              definition,
              takenIds,
              allowedHostsOfFamily(familyId),
              family(familyId)?.clearances,
              familyCapabilities(familyId),
            );
            if (!onCommand(new AddEquipmentCommand(added))) return;
            onPlace(added.id, added.kind);
            onClose();
          });
        }}
      />
    </div>
  );
}
