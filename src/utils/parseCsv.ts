import { parse } from 'csv-parse/sync';

export async function parseCsv<T>(csvFileName: string) {
  const csvText = await Deno.readTextFile(csvFileName);
  return parse(csvText, { columns: true, skip_empty_lines: true, cast: true }) as T[];
}
