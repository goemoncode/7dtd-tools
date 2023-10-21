import { readFile } from 'node:fs/promises';
import { parseString as parseXmlString } from 'xml2js';

export async function parseXml<T>(xmlFileName: string): Promise<T> {
  const xml = await readFile(xmlFileName);
  return new Promise((resolve, reject) => {
    parseXmlString(xml, (err, result) => {
      if (err) reject(err);
      if (result) resolve(result);
      reject(Error('Unexpected state'));
    });
  });
}
