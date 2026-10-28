import { basename, dirname, join, relative } from '@std/path';
import { program, Argument } from 'commander';
import { MultiBar, SingleBar, Presets } from 'cli-progress';
import { fileExists, glob, handleMain, writeJsonFile } from './utils/index.ts';
import { parseCsv } from './utils/parseCsv.ts';
import { parsePrefabXml } from './utils/parsePrefabXml.ts';
import { type BlocksUsedCsv, csvToObject } from './utils/BlocksUsed.ts';

handleMain(async () => {
  program.name(basename(import.meta.filename!, '.ts')).description('Generate index.json for 7dtd-map');

  const defaultInputDir = join('public', 'Prefabs');
  program
    .command('prefabs', { isDefault: true })
    .addArgument(
      new Argument('<inputDir>', 'The path to the folder that contains prebuilt prefab files').argOptional().default('', defaultInputDir),
    )
    .addArgument(new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', 'inputDir'))
    .action(async (...args) => {
      const inputDir = args[0] || defaultInputDir;
      const outputDir = args[1] || inputDir;
      const prefabs = await readPrefabs(inputDir);
      const outputFile = join(outputDir, 'index.json');
      await writeJsonFile(outputFile, prefabs);
    });

  const defaultInputModsDir = join('public', 'Mods');
  program
    .command('mods')
    .addArgument(
      new Argument('<inputDir>', 'The path to the folder that contains mod files (and that contains prebuilt prefab files)')
        .argOptional()
        .default('', defaultInputModsDir),
    )
    .addArgument(new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', 'inputDir'))
    .action(async (...args) => {
      const inputModsDir = args[0] || defaultInputModsDir;
      const outputDir = args[1] || inputModsDir;
      const globPattern = join(inputModsDir, '**', 'ModInfo.xml');
      const modInfoFiles = await glob(globPattern);
      const multibar = new MultiBar({
        ...Presets.shades_classic,
        format: ' {modName} | {bar} {percentage}% | {value}/{total}',
        stopOnComplete: true,
        autopadding: true,
      });
      const prefabs = await Promise.all(
        modInfoFiles.map(async (file) => {
          const modRootDir = dirname(file);
          const inputDir = join(modRootDir, 'Prefabs');
          if (await fileExists(inputDir)) {
            const modName = basename(modRootDir);
            return await readPrefabs(inputDir, modName, (total) => multibar.create(total, 0, { modName }));
          } else {
            return [];
          }
        }),
      );
      multibar.stop();
      const outputFile = join(outputDir, 'index.json');
      await writeJsonFile(
        outputFile,
        prefabs.flatMap((rows) => rows),
      );
    });

  await program.showHelpAfterError().parseAsync();
});

async function readPrefabs(inputDir: string, modName?: string, progressBar: (total: number) => SingleBar = singleBar) {
  const globPattern = join(inputDir, '**', '*.xml');
  const xmlFiles = await glob(globPattern);
  const bar = progressBar(xmlFiles.length);
  const result = await Promise.all(
    xmlFiles
      .filter((xmlFileName) => !basename(xmlFileName, '.xml').endsWith('_signs'))
      .map(async (xmlFileName) => {
        const relativeGroup = relative(inputDir, dirname(xmlFileName)).replaceAll('\\', '/');
        const group = relativeGroup === '.' ? '' : relativeGroup;
        const prefabName = basename(xmlFileName, '.xml');
        const props = await parsePrefabXml(xmlFileName).then((props) => new Map(props.map(({ name, value }) => [name, value])));
        const csvFileName = xmlFileName.replace(/\.xml$/i, '.csv');
        const blocks = await parseCsv<BlocksUsedCsv>(csvFileName).then(csvToObject);
        const [width, height, depth] = props.get('PrefabSize')?.split(',').map(Number) ?? [];
        bar.increment();
        return {
          name: prefabName,
          modName,
          group,
          difficulty: Number(props.get('DifficultyTier') ?? 0),
          width,
          height,
          depth,
          rotationToFaceNorth: Number(props.get('RotationToFaceNorth') ?? 0),
          tags: props.get('Tags') ?? '',
          blocks,
        };
      }),
  );
  bar.stop();
  return result;
}

function singleBar(total: number) {
  const bar = new SingleBar({ stopOnComplete: true, autopadding: true }, Presets.shades_classic);
  bar.start(total, 0);
  return bar;
}
