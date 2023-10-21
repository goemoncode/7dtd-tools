import { basename, join } from 'node:path';
import { program } from 'commander';
import { red, blue, cyan } from 'ansi-colors';
import { AppConfig, handleMain } from './utils';
import { Loot, LootTable } from './utils/Loot';
import { Blocks } from './utils/Blocks';

program
  .name(basename(__filename, ".ts"))
  .description('Find blocks can loot item')
  .argument('<pattern>', 'Regular expression for item name you want loot')
  .configureOutput({ outputError: (str, write) => write(red(str)) })
  .showHelpAfterError()
  .parse();

handleMain(main);

async function main({ gameConfigDir }: AppConfig) {
  const pattern = new RegExp(program.args[0]);
  const loot = await Loot.loadFromXml(join(gameConfigDir, 'loot.xml'));
  const lootContainers = loot.findLootContainer(pattern);
  const items = flattenItems(lootContainers);

  if (items.size) {
    console.group(cyan('Loot Items'));
    console.log(blue.italic(`${items.size} items matched`));
    printArray(Array.from(items));
    console.groupEnd();
    console.log();
  } else {
    console.log(red('No loot items matched'));
    return;
  }

  console.group(cyan('Loot Containers'));
  console.log(blue.italic(`${lootContainers.length} loot containers matched`));
  printArray(lootContainers.map((c) => c.name));
  console.groupEnd();
  console.log();

  const blocks = await Blocks.loadFromXml(join(gameConfigDir, 'blocks.xml'));
  const matchedBlocks = blocks.findByLootIds(new Set(lootContainers.map((c) => c.name)));
  console.group(cyan('Container Blocks'));
  if (matchedBlocks.length) {
    console.log(blue.italic(`${matchedBlocks.length} blocks matched`));
    printArray(matchedBlocks.map((b) => b.name));
  } else {
    console.log(red('No blocks matched'));
  }
  console.groupEnd();
  console.log();

  const downgradeGraph = matchedBlocks.flatMap((b) => blocks.getDowngradeGraphs([b])).filter((g) => g.length > 1);
  if (downgradeGraph.length) {
    console.group(cyan('Downgrade Graphs'));
    downgradeGraph.forEach((g) => console.log(g.map((b) => b.name).join(' -> ')));
    console.groupEnd();
    console.log();
  }
}

function flattenItems(lootContainers: LootTable[]): Set<string> {
  return new Set(lootContainers.flatMap((c) => c.items.concat(Array.from(flattenItems(c.groups)))));
}

function printArray(values: string[], lineWidth = process.stdout.columns - 2) {
  const chunk: string[] = [];
  for (const s of values) {
    if (chunk.join(', ').length + s.length + 2 > lineWidth) {
      console.log(chunk.join(', '));
      chunk.splice(0, chunk.length);
    }
    chunk.push(s);
  }
  if (chunk.length) {
    console.log(chunk.join(', '));
  }
}
