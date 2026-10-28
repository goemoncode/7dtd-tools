import { Command } from '@cliffy/command';
import { red, blue, cyan, bold } from '@std/fmt/colors';
import { type AppConfig, handleMain } from './utils/index.ts';
import { type CalculatedLootTreeNode, LootTable as Loot } from './utils/Loot.ts';
import { Blocks } from './utils/Blocks.ts';
import { Items } from './utils/Items.ts';
import { parseCVars } from './utils/CommandTypes.ts';

const command = await new Command()
  .name('findlootitem')
  .description('Find blocks containing the specified item.')
  .type('cvarType', parseCVars)
  .argument('<pattern:string>', 'Regular expression to match item names for looting.')
  .option('--lootStage <lootStage:number>', 'The loot stage used to calculate drop rates.', { default: 10 })
  .option('--bookworm', 'Enable the perkBookwormChance calculation.')
  .option('--biome <biome:string>', 'The biome standing on (e.g., pine_forest, desert, snow, wasteland).', { default: 'pine_forest' })
  .option('-t, --tier, --poiTier <tier:number>', 'The POI tier (0-5).', { default: 0 })
  .parse(Deno.args);

handleMain(main);

async function main({ itemsXmlPath, lootXmlPath, blocksXmlPath }: AppConfig) {
  const [arg1] = command.args;
  const { lootStage = 10, bookworm, biome = 'pine_forest', tier = 0 } = command.options;
  const cvars: Record<string, number> = {};
  if (bookworm) cvars['$perkBookwormChance'] = 25;

  const regex = new RegExp(arg1);
  const items = await Items.loadFromXml(itemsXmlPath);
  const item = items.items.find((item) => regex.test(item.name));
  if (item == null) {
    console.error(bold(red(`No Item matched by pattern: ${regex}`)));
    return 1;
  }
  console.log(`Item matched: ${bold(blue(item.name))}`);
  console.log();

  const loot = await Loot.loadFromXml(lootXmlPath);
  const lootContainers = loot.findLootTree(item.name, {
    lootStage,
    cvars,
    biomeStandingOn: biome,
    poiTier: tier,
  });
  const blocks = await Blocks.loadFromXml(blocksXmlPath);

  const matched = lootContainers.length;
  console.log(`${matched} loot containers contains this item.`);
  console.log();
  for (let i = 0; i < matched; i++) {
    const lootContainer = lootContainers[i];
    console.log(`${i + 1}) ${lootContainer.name}`);
    for (const child of lootContainer.children) {
      printLootTree(child as CalculatedLootTreeNode, 1);
    }
    const matchedBlocks = blocks.lootContainers.get(lootContainer.name);
    console.log();
    if (matchedBlocks) {
      console.log(`${matchedBlocks.length} blocks found that has this loot list.`);
      console.log(blue(matchedBlocks.map((block) => block.name).join(', ')));
    } else {
      console.log(red(`No blocks found that has this loot list.`));
    }
    console.log();
  }
}

function printLootTree(node: CalculatedLootTreeNode, depth: number = 0): void {
  const indent = '  '.repeat(depth);
  const rollProb = node.rollProb !== undefined ? `${(node.rollProb * 100).toFixed(2)}%` : '100%';
  const absoluteProb = node.absoluteProb !== undefined ? `${(node.absoluteProb * 100).toFixed(2)}%` : '100%';
  if (node.type === 'group') {
    const prob = node.loot_prob_template ? `${absoluteProb} ${rollProb}(${node.loot_prob_template})` : `${absoluteProb} ${rollProb}`;
    console.log(`${indent}┗ ${cyan(node.name)} (rollCount: ${node.rollCount || '1'}; prob: ${prob}; count: ${node.count || '1'})`);
  } else if (node.type === 'item') {
    const req = node.requirements
      ?.map((req) => {
        switch (req.class) {
          case 'RandomRoll':
            return `${req.class}={prob=${req.value}}`;
          case 'Progression':
            return `${req.class}={${req.name}${req.operation}${req.value}}`;
          case 'Biome':
            return `${req.class}={${req.biomes}}`;
        }
      })
      .join(';');
    const prob = node.loot_prob_template
      ? `${bold(red(absoluteProb))} ${rollProb}(${node.loot_prob_template})`
      : `${bold(red(absoluteProb))} ${rollProb}`;
    console.log(`${indent}┗ ${red(node.name)} (prob: ${prob}; count: ${node.count || '1'}) ${req ?? ''}`);
  }
  if ('children' in node) {
    for (const child of node.children) {
      printLootTree(child as CalculatedLootTreeNode, depth + 1);
    }
  }
}
