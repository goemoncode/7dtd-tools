import { existsSync, mkdirSync, statSync } from 'node:fs';
import { copyFile, writeFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { program, Argument } from 'commander';
import { blue, cyan, red } from 'ansi-colors';
import { glob } from 'glob';
import { stringify as csvStringify } from 'csv-stringify/sync';
import { handleMain } from './utils';
import { parseTts } from './utils/parseTts';
import { parseNim } from './utils/parseNim';
import { BlocksUsedCsv } from './utils/BlocksUsed';

handleMain(async ({ steamAppsGameDir }) => {
  program.name(basename(__filename, '.ts')).description('Prebuild prefab files for 7dtd-map');

  const defaultInputDir = join(steamAppsGameDir, 'Data', 'Prefabs');
  const defaultOutputDir = join('public', 'Prefabs');
  program
    .command('prefabs', { isDefault: true })
    .addArgument(new Argument('<inputDir>', 'The path to the folder that contains prefab files').argOptional().default('', defaultInputDir))
    .addArgument(
      new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', defaultOutputDir)
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
      new Argument('<inputDir>', 'The path to the folder that contains mod files').argOptional().default('', defaultInputModsDir)
    )
    .addArgument(
      new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', defaultOutputModsDir)
    )
    .action(async (...args) => {
      const inputModsDir = args[0] || defaultInputModsDir;
      const outputModsDir = args[1] || defaultOutputModsDir;
      const globPattern = join(inputModsDir, '**', 'ModInfo.xml');
      const modInfoFiles = await glob(globPattern, { windowsPathsNoEscape: true });
      for (const file of modInfoFiles) {
        const modRootDir = dirname(file);
        const inputDir = join(modRootDir, 'Prefabs');
        if (existsSync(inputDir)) {
          const modName = basename(modRootDir);
          const outputModDir = join(outputModsDir, modName.replace(/ /g, '_').replace(/'/g, ''));
          mkdirSync(outputModDir, { recursive: true });
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
  const files = await glob(globPattern, { windowsPathsNoEscape: true });
  let processed = 0;
  for (const xmlFileName of files) {
    console.group(`[${String(++processed).padStart(5, ' ')}/${String(files.length).padStart(5, ' ')}] %s`, xmlFileName);
    const folderDir = dirname(xmlFileName);
    const folderName = inputDir !== folderDir ? basename(folderDir) : '';
    const baseName = basename(xmlFileName, '.xml');

    const jpgFileName = xmlFileName.replace(/\.xml$/i, '.jpg');
    const nimFileName = xmlFileName.replace(/\.xml$/i, '.blocks.nim');
    const ttsFileName = xmlFileName.replace(/\.xml$/i, '.tts');

    mkdirSync(join(outputDir, folderName), { recursive: true });

    await copyFileWithLog(xmlFileName, join(outputDir, folderName, baseName + '.xml'));
    await copyFileWithLog(jpgFileName, join(outputDir, folderName, baseName + '.jpg'));

    const csvFileName = join(outputDir, folderName, baseName + '.csv');
    if (existsSync(csvFileName)) {
      console.log(blue('File already exists: %s'), csvFileName);
    } else {
      const [tts, blocks] = await Promise.all([parseTts(ttsFileName), parseNim(nimFileName)]);
      const rows = Array.from(blocks)
        .filter(([id]) => id > 0 && tts.blockNums.has(id))
        .map(([id, name]) => ({ id, name, count: tts.blockNums.get(id)! } as BlocksUsedCsv));
      const csvText = csvStringify(rows, { header: true });
      await writeFile(csvFileName, csvText);
      console.log(cyan('File created: %s'), csvFileName);
    }
    console.groupEnd();
  }
}

async function copyFileWithLog(src: string, dest: string) {
  try {
    if (statSync(src).mtimeMs !== statSync(dest).mtimeMs) {
      await copyFile(src, dest);
      return console.log(cyan('File copied: %s'), dest);
    } else {
      return console.log(blue('File not modified: %s'), dest);
    }
  } catch {
    return console.error(red('File could not be copied: %s'), src);
  }
}
