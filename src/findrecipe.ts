import { basename, join } from '@std/path';
import { program } from 'commander';
import { red } from '@std/fmt/colors';;
import { handleMain } from './utils/index.ts';
import { Recipes } from './utils/Recipes.ts';

program
  .name(basename(import.meta.filename!, '.ts'))
  .description('Find recipe')
  .option('-i, --input <inputFile>', 'path to recipes.xml')
  .option('-o, --output <outputDir>', 'path to the folder where items.json is created')
  .configureOutput({ outputError: (str, write) => write(red(str)) })
  .showHelpAfterError()
  .parse();

handleMain(async ({ gameConfigDir }) => {
  const options = program.opts();
  const inputFileName = options.input ?? join(gameConfigDir, 'recipes.xml');
  // const tag = program.args[0];
  const recipes = await Recipes.loadFromXml(inputFileName);
  const stats = new Map<string, number>();
  for (const recipe of recipes.recipes) {
    const m = recipe.name.match(/[A-Z0-9]/);
    const prefix = recipe.name.slice(0, m?.index ?? 0);
    stats.set(prefix, (stats.get(prefix) ?? 0) + 1);
    if (!prefix) console.log(recipe.name);
  }
  console.log(Object.fromEntries(stats));
});
