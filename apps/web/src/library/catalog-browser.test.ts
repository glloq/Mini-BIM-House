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
} from './catalog-browser.js';

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
