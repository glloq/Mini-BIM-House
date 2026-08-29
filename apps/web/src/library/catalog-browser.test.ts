import { describe, expect, it } from 'vitest';
import {
  planSymbolFor,
  planSymbolSource,
  SYMBOL_LIBRARY_V1,
} from '@house-technical-designer/drawing-engine';
import { rawGenericEquipmentEntries } from '@house-technical-designer/equipment-catalog';
import {
  FAMILY_REGISTRY,
  catalogEvidence,
  installedCatalog,
  type CatalogSummary,
} from '@house-technical-designer/catalog-registry';
import {
  CATALOG_DOMAINS,
  catalogFamilyView,
  catalogRows,
  shownDomain,
  withChosenDomain,
  type CatalogFilter,
} from './catalog-browser.js';
import { CREATION_STAGES } from '../ux/creation-stages.js';
import { sectionFamilyDomains, sectionsOfStage } from '../editor/toolbox.js';

// Rows, not fiches: the panel draws a name and a version, and used to be
// handed whole catalogue entries to do it.
const repository = installedCatalog();
const entriesByFamily: Record<string, CatalogSummary[]> = {};
for (const summary of repository.index.byRegistry.get('EQUIPMENT') ?? [])
  if (summary.familyId !== undefined)
    (entriesByFamily[summary.familyId] ??= []).push(summary);
const known = {
  symbols: new Set(Object.keys(SYMBOL_LIBRARY_V1.definitions)),
  entries: [],
  evidence: catalogEvidence(repository.summaries),
};

describe('browsing the nomenclature', () => {
  it('offers the whole of it, not the nineteen entries somebody wrote', () => {
    // The panel listed nineteen while the rest of the application had been
    // checking the whole nomenclature for weeks. « The whole of it » is asked
    // of the nomenclature rather than written down, so that declaring a family
    // stays a data change.
    expect(FAMILY_REGISTRY.length).toBeGreaterThan(500);
    const inService = FAMILY_REGISTRY.filter(
      ({ lifecycle }) => (lifecycle ?? 'ACTIVE') === 'ACTIVE',
    );
    expect(catalogRows(entriesByFamily, known).length).toBe(inService.length);
    // The ones that left service still open the projects that hold them, and
    // are offered to nobody starting a design — but somebody reading the
    // nomenclature to understand it can still ask for them, and gets told what
    // took their place.
    const all = catalogRows(entriesByFamily, known, { withRetired: true });
    expect(all.length).toBe(FAMILY_REGISTRY.length);
    const retired = all.filter(({ replacedBy }) => replacedBy !== undefined);
    expect(retired.length).toBe(FAMILY_REGISTRY.length - inService.length);
    for (const row of retired) expect(row.retiredReason).toBeDefined();
  });

  it('narrows by trade, by wave and by word', () => {
    const heating = catalogRows(entriesByFamily, known, { domain: 'HEATING' });
    expect(heating.length).toBeGreaterThan(0);
    expect(heating.every(({ domain }) => domain === 'HEATING')).toBe(true);
    expect(
      catalogRows(entriesByFamily, known, { wave: 4 }).every(
        ({ wave }) => wave === 4,
      ),
    ).toBe(true);
    const searched = catalogRows(entriesByFamily, known, { search: 'pompe' });
    expect(searched.length).toBeGreaterThan(0);
    // A row matches on what the search looks at: the family's name, its
    // identifier, or the name of a fiche it holds. « Évacuation des
    // condensats » holds a « Pompe de relevage des condensats », and finding
    // it by that word is the point — the family label alone was enough only
    // while every fiche was named after its family.
    expect(
      searched.every(
        ({ familyId, label }) =>
          label.toLowerCase().includes('pompe') ||
          familyId.toLowerCase().includes('pompe') ||
          (entriesByFamily[familyId] ?? []).some(({ label: name }) =>
            name.toLowerCase().includes('pompe'),
          ),
      ),
    ).toBe(true);
  });

  it('answers « what can I actually place today »', () => {
    const placeable = catalogRows(entriesByFamily, known, {
      withGenericData: true,
    });
    // The families somebody has written a fiche for — counted from the fiches,
    // so a filling wave answers this question differently without editing it.
    const offerable = new Set(
      FAMILY_REGISTRY.filter(
        ({ lifecycle }) => (lifecycle ?? 'ACTIVE') === 'ACTIVE',
      ).map(({ id }) => id),
    );
    expect(placeable.length).toBe(
      new Set(
        rawGenericEquipmentEntries()
          .map(({ familyId }) => familyId)
          .filter((id) => offerable.has(id)),
      ).size,
    );
    expect(placeable.every(({ entryCount }) => entryCount > 0)).toBe(true);
  });

  it('puts what is furthest along first', () => {
    const rows = catalogRows(entriesByFamily, known);
    const scores = rows.map(({ progress }) => progress);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
  });

  it('says what a family is, not only what it is called', () => {
    const view = catalogFamilyView(
      'HEAT_PUMP_AIR_WATER_MONOBLOC',
      entriesByFamily,
      known,
    )!;
    expect(view.ports).toContain('Départ chauffage');
    expect(view.optionalPorts.length).toBeGreaterThan(0);
    expect(view.hosts).toContain('Dalle');
    expect(view.clearances).toContain('Prise d’air');
    expect(view.calculators).toContain('heating');
    expect(view.properties.some(({ unit }) => unit !== undefined)).toBe(true);
    expect(view.entries.map(({ id }) => id)).toEqual([
      'generic-air-water-heat-pump',
    ]);
  });

  it('has nothing left to say « rien du tout » about', () => {
    // This used to be « says plainly when a family has nothing to place », and
    // its subject was the eave: a family of the assembly registry that shipped
    // nothing, because a ridge is a length and the registry only knew how to
    // hold a stack of materials. CG-01 and CG-02 closed that, and with it the
    // last of the five hundred and twenty-seven.
    //
    // The assertion is worth more the other way round: every family the
    // application offers has something behind it, and the day one does not,
    // this fails and names it.
    const held = new Set(
      installedCatalog().summaries.flatMap(({ familyId }) =>
        familyId === undefined ? [] : [familyId],
      ),
    );
    // Of the families still in service: one that has left it is offered to
    // nobody, and asking it for a fiche is asking a retired thing to be
    // current.
    const empty = FAMILY_REGISTRY.filter(
      ({ id, lifecycle }) =>
        (lifecycle ?? 'ACTIVE') === 'ACTIVE' && !held.has(id),
    ).map(({ id }) => id);
    expect(empty).toEqual([]);
  });

  it('separates « nothing exists » from « nothing to place here »', () => {
    // A flue pipe family holds six catalogued products, so it has generic
    // data; it holds no equipment, so this panel has nothing to offer from it.
    // The evidence now counts all six registries, where it used to count the
    // equipment catalogue alone and call the rest empty.
    const view = catalogFamilyView('FLUE_PIPE', entriesByFamily, known)!;
    expect(view.entries).toEqual([]);
    expect(view.axes.find(({ axis }) => axis === 'GENERIC_DATA')?.value).toBe(
      'READY',
    );
  });

  it('offers only the trades that hold families', () => {
    expect(CATALOG_DOMAINS.length).toBeGreaterThan(5);
    expect(CATALOG_DOMAINS.map(({ id }) => id)).toContain('PLUMBING');
  });
});

describe('the drawing beside the name', () => {
  /*
   * Cinq cent dix-huit noms se ressemblent ; cinq cent dix-huit dessins non.
   *
   * La liste ne nommait que la famille — « Applique murale », « Hublot »,
   * « Réglette » — et on découvrait le dessin en posant. Chaque ligne porte
   * maintenant le glyphe que le plan prendra, résolu par la même chaîne.
   */
  it('porte la catégorie, sans quoi trente-trois familles perdent leur dessin', () => {
    const rows = catalogRows(entriesByFamily, known);
    /*
     * Le maillon du milieu, mesuré et non supposé.
     *
     * La chaîne va de la famille à sa catégorie, puis au carré générique. Une
     * ligne qui n'emporte pas sa catégorie saute le maillon du milieu : la
     * résolution reste *valide*, elle rend simplement le carré — et l'aperçu
     * montre alors un dessin que le plan ne fera pas. Rien n'échouerait ; on
     * verrait des carrés, ce qui est la panne muette qu'on cherche à éviter.
     *
     * On compare donc les deux résolutions, avec et sans, et on exige que la
     * différence soit exactement les familles tenues par leur catégorie.
     */
    const tenuesParCategorie = rows.filter(
      (row) =>
        planSymbolSource({ familyId: row.familyId, category: row.category }) ===
        'CATEGORY',
    );
    const perduesSansCategorie = rows.filter(
      (row) =>
        planSymbolFor({ familyId: row.familyId, category: row.category }) !==
        planSymbolFor({ familyId: row.familyId }),
    );
    expect(tenuesParCategorie.length).toBeGreaterThan(0);
    expect(perduesSansCategorie.map(({ familyId }) => familyId).sort()).toEqual(
      tenuesParCategorie.map(({ familyId }) => familyId).sort(),
    );
  });

  it('ne montre jamais un glyphe que la planche ne contient pas', () => {
    // Une case vide dans la liste serait le seul défaut vraiment visible :
    // la ligne garderait sa hauteur et rien ne s'y dessinerait.
    const rows = catalogRows(entriesByFamily, known);
    const manquants = rows
      .map((row) =>
        planSymbolFor({ familyId: row.familyId, category: row.category }),
      )
      .filter((id) => SYMBOL_LIBRARY_V1.definitions[id] === undefined);
    expect([...new Set(manquants)]).toEqual([]);
  });
});

describe('ouvrir la nomenclature sur plusieurs métiers', () => {
  /*
   * Une sous-partie n'est pas un métier.
   *
   * La salle de bain pose des WC, des douches et des lavabos — de la
   * Plomberie — et aussi des meubles sous vasque et des colonnes ; la cuisine
   * mêle l'électroménager et le mobilier. Ouverte sur le seul métier le plus
   * servi, l'autre moitié de ce qu'elle pose restait derrière un
   * élargissement à la main que personne ne devine — et une recherche qui ne
   * rend rien parce qu'on regarde le mauvais métier est pire qu'une recherche
   * vide : elle fait croire que la famille n'existe pas.
   */
  const idsOf = (rows: readonly { readonly familyId: string }[]) =>
    rows.map(({ familyId }) => familyId).sort();

  it('rend l’union des métiers ouverts, et non le premier seul', () => {
    const plomberie = catalogRows(entriesByFamily, known, {
      domain: 'PLUMBING',
    });
    const mobilier = catalogRows(entriesByFamily, known, {
      domain: 'FURNITURE',
    });
    const salleDeBain = catalogRows(entriesByFamily, known, {
      domains: ['PLUMBING', 'FURNITURE'],
    });
    // Exactement les deux métiers réunis : ni le premier seul — ce que le
    // sélecteur faisait — ni la nomenclature entière, ce que rendrait un
    // filtre qui ignorerait la liste.
    expect(idsOf(salleDeBain)).toEqual(idsOf([...plomberie, ...mobilier]));
    expect(salleDeBain.length).toBe(plomberie.length + mobilier.length);
    expect(salleDeBain.length).toBeGreaterThan(plomberie.length);
    // Et la famille par laquelle on s'en est aperçu : « bidet » est de la
    // Plomberie, une colonne de rangement du Mobilier, et la salle de bain
    // pose les deux.
    expect(salleDeBain.some(({ domain }) => domain === 'FURNITURE')).toBe(true);
    expect(salleDeBain.some(({ domain }) => domain === 'PLUMBING')).toBe(true);
  });

  it('ne filtre rien sur une liste vide, et filtre sur une liste pleine', () => {
    // Une sous-partie qui ne déclare aucun métier ouvre la nomenclature telle
    // qu'elle est : lui rendre zéro famille serait la punir de ne rien
    // savoir, alors que « tout » est la bonne réponse à « je ne sais pas où
    // chercher ».
    expect(catalogRows(entriesByFamily, known, { domains: [] }).length).toBe(
      catalogRows(entriesByFamily, known).length,
    );
    const deux = catalogRows(entriesByFamily, known, {
      domains: ['LIGHTING', 'SAFETY'],
    });
    expect(deux.length).toBeGreaterThan(0);
    expect(
      deux.every(({ domain }) => domain === 'LIGHTING' || domain === 'SAFETY'),
    ).toBe(true);
    expect(deux.length).toBeLessThan(
      catalogRows(entriesByFamily, known).length,
    );
  });

  it('cumule le métier choisi et les métiers ouverts', () => {
    // Deux critères posés ensemble se lisent « et », comme le métier et la
    // vague : on ne rend jamais plus large que ce qui a été demandé. L'écran
    // ne les pose jamais ensemble — choisir efface l'ouverture — mais le
    // filtre doit répondre quand même.
    const croise = catalogRows(entriesByFamily, known, {
      domain: 'FURNITURE',
      domains: ['PLUMBING', 'FURNITURE'],
    });
    expect(idsOf(croise)).toEqual(
      idsOf(catalogRows(entriesByFamily, known, { domain: 'FURNITURE' })),
    );
    expect(
      catalogRows(entriesByFamily, known, {
        domain: 'FURNITURE',
        domains: ['PLUMBING'],
      }),
    ).toEqual([]);
  });

  it('montre le premier métier ouvert, et le choix efface l’ouverture', () => {
    const ouvert: CatalogFilter = { domains: ['PLUMBING', 'FURNITURE'] };
    // La case ne peut pas rester vide : elle dirait « Tous » au-dessus d'une
    // liste qui n'en montre que deux sur seize.
    expect(shownDomain(ouvert)).toBe('PLUMBING');
    expect(shownDomain({})).toBe('');
    expect(shownDomain({ domain: 'HEATING', domains: ['PLUMBING'] })).toBe(
      'HEATING',
    );
    // Choisir remplace : demander « Mobilier » depuis une salle de bain
    // ouverte sur Plomberie + Mobilier rend le Mobilier et rien d'autre.
    const choisi = withChosenDomain(ouvert, 'FURNITURE');
    expect(choisi.domain).toBe('FURNITURE');
    expect(choisi.domains).toBeUndefined();
    expect(idsOf(catalogRows(entriesByFamily, known, choisi))).toEqual(
      idsOf(catalogRows(entriesByFamily, known, { domain: 'FURNITURE' })),
    );
    // Et « Tous » efface les deux : le mot promet la nomenclature entière.
    const tous = withChosenDomain(choisi, '');
    expect(tous.domain).toBeUndefined();
    expect(tous.domains).toBeUndefined();
    expect(catalogRows(entriesByFamily, known, tous).length).toBe(
      catalogRows(entriesByFamily, known).length,
    );
  });

  it('ouvre chaque sous-partie sur tout ce qu’elle pose', () => {
    /*
     * Le bout du chemin, mesuré sur la boîte à outils elle-même.
     *
     * `sectionFamilyDomains` rend les métiers qu'une sous-partie sert
     * vraiment, du plus servi au moins ; « Autre… » les passe tous. Ce test
     * refuse le retour en arrière : une sous-partie qui n'ouvrirait que sur
     * le premier laisserait ses autres métiers derrière un geste à la main.
     *
     * Rien n'est écrit en dur ici : les comptes viennent de la nomenclature,
     * de sorte qu'une famille ajoutée demain les déplace sans toucher au
     * test.
     */
    const placing = CREATION_STAGES.flatMap((stage) =>
      sectionsOfStage(stage).filter(({ entries }) =>
        entries.some(({ family: named }) => named !== undefined),
      ),
    );
    expect(placing.length).toBeGreaterThanOrEqual(19);
    let premierSeul = 0;
    let tousLesMetiers = 0;
    let melangees = 0;
    for (const section of placing) {
      const domains = sectionFamilyDomains(section);
      const premier = domains[0];
      if (premier === undefined) continue;
      const avant = catalogRows(entriesByFamily, known, {
        domain: premier,
        withGenericData: true,
      });
      const apres = catalogRows(entriesByFamily, known, {
        domains,
        withGenericData: true,
      });
      premierSeul += avant.length;
      tousLesMetiers += apres.length;
      if (domains.length > 1) melangees += 1;
      // Ouvrir sur tous les métiers ne peut que rendre au moins autant que sur
      // le premier seul, et jamais rien d'un métier que la sous-partie ne sert
      // pas : « tous ses métiers » n'est pas « toute la nomenclature », qui
      // serait le mur de cinq cents lignes qu'on ne lit pas.
      expect(apres.length, section.id).toBeGreaterThanOrEqual(avant.length);
      expect(
        apres.every((row) => domains.includes(row.domain)),
        section.id,
      ).toBe(true);
      // Et chaque métier déclaré est atteignable sans rien élargir — sauf
      // celui dont aucune famille n'a encore de fiche, qu'aucun filtre ne
      // peut faire apparaître.
      for (const domain of domains)
        expect(
          apres.some((row) => row.domain === domain) ||
            catalogRows(entriesByFamily, known, {
              domain,
              withGenericData: true,
            }).length === 0,
          `${section.id} · ${domain}`,
        ).toBe(true);
    }
    // Une bonne moitié des sous-parties mêle deux métiers ou plus : c'est ce
    // qui rend l'écart mesurable, et un jour où plus aucune n'en mêlerait,
    // ce test passerait sans rien prouver.
    expect(melangees).toBeGreaterThanOrEqual(8);
    expect(tousLesMetiers).toBeGreaterThan(premierSeul);
  });
});
