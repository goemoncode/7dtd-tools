import { basename, join } from '@std/path';
import { program, Argument } from 'commander';
import { glob, handleMain, writeJsonFile } from './utils/index.ts';
import { parseL10nCsv, LANGUAGES, type Language, type Label } from './utils/parseL10nTxt.ts';

handleMain(async ({ gameConfigDir }) => {
  const defaultInputDir = gameConfigDir;
  const defaultOutputDir = join('public', 'prefabs');
  program
    .name(basename(import.meta.filename!, '.ts'))
    .description('Generate l10n files for 7dtd-map')
    .addArgument(
      new Argument('<inputDir>', 'The path to the folder that contains Localization.csv').argOptional().default('', defaultInputDir)
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
  const globPattern = join(inputDir, '**', 'Localization.csv');
  const txtFiles = await glob(globPattern);
  const labelMaps = await Promise.all(txtFiles.map((file) => parseL10nCsv(file)));
  const labels = labelMaps.map((map) => Object.fromEntries(map)).reduce((a, c) => Object.assign(a, c), {});
  const langDir = join(outputDir, 'l10n');
  await Deno.mkdir(langDir, { recursive: true });
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
