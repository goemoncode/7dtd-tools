import { join } from '@std/path';
import { Command } from '@cliffy/command';
import { parseSizeQuery, parseTierQuery, parseVector2IntArg } from './utils/CommandTypes.ts';
import { type AppConfig, handleMain } from './utils/index.ts';
import { loadPrefabData, type PrefabData, Tags } from './utils/PrefabData.ts';
import { parseL10nCsv } from './utils/parseL10nTxt.ts';
import { countBy, countNestedBy } from './utils/stats.ts';

const command = await new Command()
  .name('findprefab')
  .description('Find Prefab')
  .type('Tags', ({ value }) => new Tags(value))
  .type('Vector2Int', parseVector2IntArg)
  .type('sizeQuery', parseSizeQuery)
  .type('tierQuery', parseTierQuery)
  .option('--group <group:string>', 'Filter by prefab group (default: POIs)')
  .option('--name <pattern:string>', 'Filter by prefab name (case-insensitive substring)')
  .option('--label <pattern:string>', 'Filter by prefab label (case-insensitive substring)')
  .option('--tags <tags:Tags>', 'Filter by all specified Tags (AND)')
  .option('--tags-any <tags:Tags>', 'Filter by any specified Tags (OR)')
  .option('--exclude-tags <tags:Tags>', 'Exclude Tags')
  .option('--themeTags <tags:Tags>', 'Filter by any specified ThemeTags (OR)')
  .option('--questTags <tags:Tags>', 'Filter by any specified QuestTags (OR)')
  .option('--size <query:sizeQuery>', "Filter prefab sizes (width,depth). Wrap in quotes if using < or > (e.g., '>=50,100', '10-20,<=100'")
  .option('--non-square', 'Filter for non-square prefab sizes')
  .option('--tier <query:tierQuery>', "Filter DifficultyTier (e.g., '4-5', '2,3', '0')")
  .option('--all', 'Include details for all matches')
  .option('--top <top:integer>', 'Include details for the first <top> matches only')
  .option('--props <props:string[]>', 'Additional properties to output (comma-separated list)')
  .option('--stats <stats:string[]>', 'Additional properties to aggregate (comma-separated list)')
  .parse();

handleMain(main);

async function main({ gamePrefabsDir, gameConfigDir }: AppConfig) {
  const l10nCsv = join(gameConfigDir, 'Localization.csv');
  const l10nLabels = await parseL10nCsv(l10nCsv);
  const {
    group = 'POIs',
    name,
    label,
    tags = new Tags(),
    tagsAny = new Tags(),
    excludeTags = new Tags(),
    themeTags = new Tags(),
    questTags = new Tags(),
    size: sizeQuery,
    nonSquare,
    tier: tierQuery,
    top: topCount = 0,
    all = false,
    props = [],
    stats: statProps = [],
  } = command.options;
  const prefabs = await loadPrefabData(join(gamePrefabsDir, group));
  const matches: PrefabData[] = [];
  for (const prefab of prefabs) {
    prefab.label = l10nLabels.get(prefab.name)?.english ?? '';
    if (name && !prefab.name.toLowerCase().includes(name)) continue;
    if (label && !prefab.label.toLowerCase().includes(label)) continue;
    if (!excludeTags.isEmpty && prefab.tags.matchAny(excludeTags)) continue;
    if (!tags.isEmpty && !prefab.tags.matchAll(tags)) continue;
    if (!tagsAny.isEmpty && !prefab.tags.matchAny(tagsAny)) continue;
    if (!themeTags.isEmpty && !prefab.themeTags.matchAny(themeTags)) continue;
    if (!questTags.isEmpty && !prefab.questTags.matchAny(questTags)) continue;
    if (sizeQuery && !sizeQuery({ width: prefab.size.x, depth: prefab.size.z })) continue;
    if (nonSquare && prefab.size.x == prefab.size.z) continue;
    if (tierQuery && !tierQuery(prefab.tier)) continue;
    matches.push(prefab);
  }

  const stats: Record<string, Record<string, number>> = {
    tags: countNestedBy(matches, (prefab) => prefab.tags.tags),
  };
  if (group === 'POIs') {
    props.push('tier');
    stats.difficulty = countBy(matches, (prefab) => prefab.tier);
    stats.size = countBy(matches, (prefab) => `${prefab.size.x}x${prefab.size.z}`);
  } else if (group === 'RWGTiles') {
    props.push('poiSpawns');
    stats.poiSpawns = countNestedBy(matches, (prefab) => prefab.poiSpawns.map((m) => `${m.size.x}x${m.size.z}`));
  }
  if (statProps && statProps.length > 0) {
    for (const key of statProps) {
      if (key in stats) continue;
      const firstValidValue = matches.find((p) => p.getPropString(key) !== undefined)?.getPropString(key);
      if (Array.isArray(firstValidValue)) {
        stats[key] = countNestedBy(matches, (prefab) => prefab.getPropString(key) as string[] | undefined);
      } else {
        stats[key] = countBy(matches, (prefab) => prefab.getPropString(key) as string | undefined);
      }
    }
  }

  let details: PrefabData[] = [];
  if (all) details = matches;
  else if (topCount > 0) details = matches.slice(0, topCount);

  if (details.length > 0) {
    console.dir({ match: matches.length, stats, details: details.map((p) => p.toDict(props)) }, { depth: null });
  } else {
    console.dir({ match: matches.length, stats }, { depth: null });
  }
}
