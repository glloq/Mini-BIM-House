/**
 * The glyph an architectural plan draws a placed thing with.
 *
 * A plan of a house shows a bath as a bath: a shape somebody can see does not
 * fit against the wall it is drawn against. Every placed thing used to be the
 * same three-hundred-millimetre square, so a bathroom held three identical
 * squares and said nothing about whether anyone could stand in it.
 *
 * The family of the catalogue entry decides, as it does for an opening: one
 * table rather than a scattering of identifiers compared by hand.
 */
const BY_FAMILY: Readonly<Record<string, string>> = {
  WC: 'architecture.fixture.wc',
  WALL_HUNG_WC: 'architecture.fixture.wc',
  BIDET: 'architecture.fixture.basin',
  WASHBASIN: 'architecture.fixture.washbasin',
  DOUBLE_WASHBASIN: 'architecture.fixture.double-washbasin',
  BASIN: 'architecture.fixture.basin',
  BATHTUB: 'architecture.fixture.bathtub',
  SHOWER: 'architecture.fixture.shower',
  SHOWER_TRAY: 'architecture.fixture.shower',
  WALK_IN_SHOWER: 'architecture.fixture.shower',
  KITCHEN_SINK: 'architecture.fixture.kitchen-sink',
  UTILITY_SINK: 'architecture.fixture.kitchen-sink',
  DOUBLE_SINK: 'architecture.fixture.double-sink',
  HOB: 'architecture.fixture.hob',
  DISHWASHER: 'architecture.fixture.dishwasher',
  WASHING_MACHINE: 'architecture.fixture.washing-machine',
  ELECTRIC_DHW_TANK: 'architecture.fixture.dhw-tank',
  INDIRECT_TANK: 'architecture.fixture.dhw-tank',
  SOLAR_DHW_TANK: 'architecture.fixture.dhw-tank',
  BUFFER_DHW: 'architecture.fixture.dhw-tank',
  BUFFER_TANK: 'architecture.fixture.dhw-tank',
  HEAT_PUMP_DHW: 'architecture.fixture.dhw-tank',
  HEAT_PUMP_AIR_WATER_SPLIT: 'architecture.fixture.heat-pump-indoor',
  HEAT_PUMP_WATER_WATER: 'architecture.fixture.heat-pump-indoor',
  HEAT_PUMP_GROUND_WATER: 'architecture.fixture.heat-pump-indoor',
  EXHAUST_AIR_HEAT_PUMP: 'architecture.fixture.heat-pump-indoor',
  REVERSIBLE_HEAT_PUMP: 'architecture.fixture.heat-pump-indoor',
  OUTDOOR_HEAT_PUMP: 'architecture.fixture.heat-pump-outdoor',
  HEAT_PUMP_AIR_WATER_MONOBLOC: 'architecture.fixture.heat-pump-outdoor',
  HEAT_PUMP_AIR_AIR: 'architecture.fixture.heat-pump-outdoor',
  BALANCED_VENTILATION_UNIT: 'architecture.fixture.ventilation-unit',
  EXTRACT_VENTILATION_UNIT: 'architecture.fixture.ventilation-unit',
  MAIN_DISTRIBUTION_BOARD: 'architecture.fixture.distribution-board',
  SUB_DISTRIBUTION_BOARD: 'architecture.fixture.distribution-board',
  RADIATOR: 'architecture.fixture.radiator',
  TOWEL_RADIATOR: 'architecture.fixture.radiator',
  WOOD_STOVE: 'architecture.fixture.stove',
  PELLET_STOVE: 'architecture.fixture.stove',
  BOILER_STOVE: 'architecture.fixture.stove',
};

/**
 * The fixture glyph a family is drawn with, when this version has one.
 *
 * Nothing when it does not: the caller then falls back on whatever the
 * catalogue entry itself declares, and on the plain mark after that. A thing
 * whose family is unknown is still drawn.
 */
export function architecturalFixtureSymbol(
  familyId: string | undefined,
): string | undefined {
  return familyId === undefined ? undefined : BY_FAMILY[familyId];
}
