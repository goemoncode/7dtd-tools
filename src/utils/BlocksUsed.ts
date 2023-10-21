export interface BlocksUsedCsv {
  id: number;
  name: string;
  count: number;
}

export type BlocksUsed = { [blockName: string]: number };

export function csvToObject(records: BlocksUsedCsv[]): BlocksUsed {
  const obj = records
    .filter(({ id }) => id > 2) // excluding 2:terrainFiller
    .map(({ name, count }) => ({ [name]: count }))
    .reduce((a, c) => Object.assign(a, c), {});

  Object.entries(obj).forEach(([name, count]) => {
    const colon = name.indexOf(':');
    if (colon >= 1) {
      const key = name.slice(0, colon) + ':VariantHelper';
      obj[key] = (obj[key] ?? 0) + count;
      delete obj[name];
    }
  });

  return obj;
}
