import type { QuantityResult } from './quantities.js';

export function quantitiesToCsv(result: QuantityResult): string {
  const header = [
    'id',
    'sourceEntityId',
    'materialId',
    'assemblyId',
    'quantityType',
    'level',
    'value',
    'unit',
    'methodId',
  ];
  const rows = result.items.map((item) => [
    item.id,
    item.sourceEntityId,
    item.materialId ?? '',
    item.assemblyId ?? '',
    item.quantityType,
    item.level,
    String(item.value),
    item.unit,
    item.trace.methodId,
  ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

function csvCell(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
