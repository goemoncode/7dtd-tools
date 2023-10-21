import { createReadStream } from 'node:fs';
import { Parser, parse as csvParse } from 'csv-parse';

export const LANGUAGES = [
  'english', // en
  'german', // de
  'spanish', // es
  'french', // fr
  'italian', // it
  'japanese', // ja
  'koreana', // ko (korean)
  'polish', // pl
  'brazilian', // pt (portuguese)
  'russian', // ru
  'turkish', // tr
  'schinese', // zh-CN ("s"implified chinese)
  'tchinese', // zh-TW ("t"raditional chinese)
] as const;

export type Language = (typeof LANGUAGES)[number];

export type LabelId = string;

type LabelCore = {
  [lang in Language]: string;
};

export type Label = {
  key: LabelId;
  file: string;
} & LabelCore;

type LocalizationLine = {
  Key: LabelId;
  File: string;
} & LabelCore;

export async function parseL10nTxt(localizationFileName: string): Promise<Map<LabelId, Label>> {
  const parser = createReadStream(localizationFileName).pipe(csvParse({ columns: true, skip_empty_lines: true, relax_column_count: true }));
  return reduceToLabelMap(parser);
}

async function reduceToLabelMap(parser: Parser): Promise<Map<string, Label>> {
  const labels = new Map<string, Label>();
  for await (const line of parser) {
    if (isLocalizationLine(line)) {
      if (labels.has(line.Key)) console.warn('Unexpected line: duplicated label key: ', line.Key);
      labels.set(line.Key, {
        key: line.Key,
        file: line.File,
        ...LANGUAGES.reduce((acc, lang) => ({ ...acc, [lang]: line[lang] }), {} as LabelCore),
      });
    }
  }
  return labels;
}

function isLocalizationLine(line: unknown): line is LocalizationLine {
  return ((line as LocalizationLine).Key?.length ?? 0) > 0;
}
