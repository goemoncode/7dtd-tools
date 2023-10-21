import { join } from 'node:path';
import { handleMain, readJsonFile } from './utils';

handleMain(main);

async function main() {
  const jsonFile = join('public', 'prefabs', 'index.json');
  const prefabs = await readJsonFile<{ tags: string; [key: string]: unknown }[]>(jsonFile);
  const stats = new Map<string, number>();
  prefabs
    .flatMap((props) => (props.tags ? props.tags.split(',') : []))
    .forEach((tag) => {
      stats.set(tag, (stats.get(tag) ?? 0) + 1);
    });
  console.log(Object.fromEntries(stats));
}
