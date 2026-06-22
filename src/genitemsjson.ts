import { basename, join } from 'node:path';
import { program } from 'commander';
import { red } from 'ansi-colors';
import { handleMain } from './utils';
import { Items } from './utils/Items';

program
  .name(basename(__filename, '.ts'))
  .description('Generate items.json')
  .option('-i, --input <inputFile>', 'path to items.xml')
  .option('-o, --output <outputDir>', 'path to the folder where items.json is created')
  .configureOutput({ outputError: (str, write) => write(red(str)) })
  .showHelpAfterError()
  .parse();

handleMain(async ({ gameConfigDir }) => {
  const options = program.opts();
  const tag = program.args[0];
  const items = await Items.loadFromXml(options.input ?? join(gameConfigDir, 'items.xml'));
  const stat = items.hasTag(tag).items.map((x) => x.name);
  for (const name of stat) {
    console.log(name);
  }
  // const stat = items.hasTag("melee").statTags()
  // console.log(Object.fromEntries(stat));
});
