import { Parser, processors } from 'xml2js';

const options = {
  valueProcessors: [processors.parseNumbers, processors.parseBooleans],
  attrValueProcessors: [processors.parseNumbers, processors.parseBooleans],
};

export async function parseXml<T>(xmlFileName: string, enableProcessors?: boolean): Promise<T> {
  const xmlString = await Deno.readTextFile(xmlFileName);
  const parser = new Parser(enableProcessors ? options : {});
  return await parser.parseStringPromise(xmlString);
  // return parseToXml2jsStructure<T>(xmlString);
}

import { parse } from '@libs/xml';

/**
 * @libs/xml のパース結果を xml2js (explicitArray: true) 互換の構造に変換する汎用関数
 */
export function parseToXml2jsStructure<T>(xmlString: string): T {
  const raw = parse(xmlString, {
    // numbers: true にすることで、@libs/xml が自動で number 型に変換します
    revive: { numbers: true, booleans: true },
    clean: { comments: true },
  });
  const normalized = xml2jsNormalize(raw);
  if (!isRecord(normalized)) {
    throw new TypeError('Expected parsed XML to have a root element.');
  }
  const rootResult: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(normalized)) {
    if (key === '$') {
      rootResult[key] = value;
    } else {
      // 配列の先頭 [0] を取り出すことで、xml2js と同じオブジェクト構造にする
      rootResult[key] = Array.isArray(value) ? value[0] : value;
    }
  }
  return rootResult as T;
  // return xml2jsNormalize(raw) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 内部用：再帰的に構造をxml2jsに合わせる
function xml2jsNormalize(obj: unknown): unknown {
  if (obj === undefined) return '';
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(xml2jsNormalize);
  }

  const result: Record<string, unknown> = {};
  const dollar: Record<string, unknown> = {};
  let hasAttributes = false;

  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('@')) {
      const attrName = key.slice(1);
      dollar[attrName] = value;
      hasAttributes = true;
    } else {
      const convertedValue = xml2jsNormalize(value);
      // 子要素はタグ名に関わらず必ず配列でラップする（explicitArrayの挙動）
      result[key] = Array.isArray(convertedValue) ? convertedValue : [convertedValue];
    }
  }

  if (hasAttributes) {
    result['$'] = dollar;
  }

  return result;
}
