import { basename, dirname, join } from '@std/path';
import { program, Argument } from 'commander';
import { blue, cyan } from '@std/fmt/colors';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { consoleGroup, fileExists, glob, handleMain } from './utils/index.ts';
import { parseTts } from './utils/parseTts.ts';
import { parseNim } from './utils/parseNim.ts';
import type { BlocksUsedCsv } from './utils/BlocksUsed.ts';

handleMain(async ({ steamAppsGameDir }) => {
  program.name(basename(import.meta.filename!, '.ts')).description('Prebuild prefab files for 7dtd-map');

  const defaultInputDir = join(steamAppsGameDir, 'Data', 'Prefabs');
  const defaultOutputDir = join('public', 'Prefabs');
  program
    .command('prefabs', { isDefault: true })
    .addArgument(new Argument('<inputDir>', 'The path to the folder that contains prefab files').argOptional().default('', defaultInputDir))
    .addArgument(
      new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', defaultOutputDir),
    )
    .action(async (...args) => {
      const inputDir = args[0] || defaultInputDir;
      const outputDir = args[1] || defaultOutputDir;
      await setupPrefabFiles(inputDir, outputDir);
    });

  const defaultInputModsDir = join(steamAppsGameDir, 'Mods');
  const defaultOutputModsDir = join('public', 'Mods');
  program
    .command('mods')
    .addArgument(
      new Argument('<inputDir>', 'The path to the folder that contains mod files').argOptional().default('', defaultInputModsDir),
    )
    .addArgument(
      new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', defaultOutputModsDir),
    )
    .action(async (...args) => {
      const inputModsDir = args[0] || defaultInputModsDir;
      const outputModsDir = args[1] || defaultOutputModsDir;
      const globPattern = join(inputModsDir, '**', 'ModInfo.xml');
      const modInfoFiles = await glob(globPattern);
      for (const file of modInfoFiles) {
        const modRootDir = dirname(file);
        const inputDir = join(modRootDir, 'Prefabs');
        if (await fileExists(inputDir)) {
          const modName = basename(modRootDir);
          const outputModDir = join(outputModsDir, modName.replace(/ /g, '_').replace(/'/g, ''));
          await Deno.mkdir(outputModDir, { recursive: true });
          await copyFileWithLog(file, join(outputModDir, basename(file)));
          const outputDir = join(outputModDir, 'Prefabs');
          await setupPrefabFiles(inputDir, outputDir);
        }
      }
    });

  await program.showHelpAfterError().parseAsync();
});

async function setupPrefabFiles(inputDir: string, outputDir: string) {
  const globPattern = join(inputDir, '**', '*.xml');
  const files = await glob(globPattern);
  let processed = 0;
  for (const xmlFileName of files) {
    const baseName = basename(xmlFileName, '.xml');
    if (baseName.endsWith('_signs')) continue;

    using _ = consoleGroup(`[${String(++processed).padStart(5, ' ')}/${String(files.length).padStart(5, ' ')}] ${xmlFileName}`);

    const folderDir = dirname(xmlFileName);
    const folderName = inputDir !== folderDir ? basename(folderDir) : '';
    await Deno.mkdir(join(outputDir, folderName), { recursive: true });

    const jpgFileName = xmlFileName.replace(/\.xml$/i, '.jpg');
    const nimFileName = xmlFileName.replace(/\.xml$/i, '.blocks.nim');
    const ttsFileName = xmlFileName.replace(/\.xml$/i, '.tts');

    if (!await fileExists(nimFileName)) {
      console.log(blue(`File not found: ${nimFileName}`));
      continue;
    }
    if (!await fileExists(ttsFileName)) {
      console.log(blue(`File not found: ${ttsFileName}`));
      continue;
    }

    await copyFileWithLog(xmlFileName, join(outputDir, folderName, baseName + '.xml'));
    await copyFileWithLog(jpgFileName, join(outputDir, folderName, baseName + '.jpg'));

    const csvFileName = join(outputDir, folderName, baseName + '.csv');
    if (await fileExists(csvFileName)) {
      console.log(blue(`File already exists: ${csvFileName}`));
    } else {
      const [tts, blocks] = await Promise.all([parseTts(ttsFileName), parseNim(nimFileName)]);
      const rows = Array.from(blocks)
        .filter(([id]) => id > 0 && tts.blockNums.has(id))
        .map(([id, name]) => ({ id, name, count: tts.blockNums.get(id)! }) as BlocksUsedCsv);
      const csvText = csvStringify(rows, { header: true });
      await Deno.writeTextFile(csvFileName, csvText);
      console.log(cyan(`File created: ${csvFileName}`));
    }
  }
}

async function copyFileWithLog(src: string, dest: string) {
  if (!await fileExists(src)) {
    console.log(blue(`File not found: ${src}`));
  } else if (
    !await fileExists(dest) ||
    (await Deno.stat(src)).mtime?.getTime() !== (await Deno.stat(dest)).mtime?.getTime()
  ) {
    await Deno.copyFile(src, dest);
    console.log(cyan(`File copied: ${dest}`));
  } else {
    console.log(blue(`File not modified: ${dest}`));
  }
}
