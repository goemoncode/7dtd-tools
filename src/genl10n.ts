import { basename, join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { program, Argument } from 'commander';
import { glob } from 'glob';
import { handleMain, writeJsonFile } from './utils';
import { parseL10nTxt, LANGUAGES, Language, Label } from './utils/parseL10nTxt';

handleMain(async ({ steamAppsGameDir }) => {
  const defaultInputDir = join(steamAppsGameDir, 'Data', 'Config');
  const defaultOutputDir = join('public', 'prefabs');
  program
    .name(basename(__filename, '.ts'))
    .description('Generate l10n files for 7dtd-map')
    .addArgument(
      new Argument('<inputDir>', 'The path to the folder that contains Localization.txt').argOptional().default('', defaultInputDir)
    )
    .addArgument(
      new Argument('<outputDir>', 'The path to the folder where output file is created').argOptional().default('', defaultOutputDir)
    )
    .showHelpAfterError()
    .parse();

  const inputDir = program.args[0] || defaultInputDir;
  const outputDir = program.args[1] || defaultOutputDir;
  await main(inputDir, outputDir);
});

async function main(inputDir: string, outputDir: string) {
  const globPattern = join(inputDir, '**', 'Localization.txt');
  const txtFiles = await glob(globPattern, { windowsPathsNoEscape: true });
  const labelMaps = await Promise.all(txtFiles.map((file) => parseL10nTxt(file)));
  const labels = labelMaps.map((map) => Object.fromEntries(map)).reduce((a, c) => Object.assign(a, c), {});
  const langDir = join(outputDir, 'l10n');
  await mkdir(langDir, { recursive: true });
  for (const lang of LANGUAGES) {
    console.group(lang);
    await extract(labels, ['blocks', 'POI'], lang, join(langDir, lang + '.json'));
    console.groupEnd();
  }
}

async function extract(labels: { [key: string]: Label }, files: string[], lang: Language, outputFile: string) {
  const extracted = Object.fromEntries(
    (function* () {
      for (const [key, label] of Object.entries(labels)) {
        if (!files.includes(label.file)) continue;
        if (!label[lang]) continue;
        yield [key, label[lang]];
      }
    })()
  );
  console.log('Load %d labels for %s', Object.keys(extracted).length, basename(outputFile));
  await writeJsonFile(outputFile, extracted);
}
