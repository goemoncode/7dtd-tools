import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PNG } from 'pngjs';

export class DTM {
  constructor(private raw: Buffer, private size = Math.sqrt(raw.length / 2)) {
    if (raw.length % 2 !== 0) {
      throw Error(`Invalid raw data format: dataLength=${raw.length}`);
    }
    if (!Number.isSafeInteger(size)) {
      throw Error(`Invalid raw data or size: dataLength=${raw.length} size=${size}`);
    }
  }

  static async load(srcFileName: string) {
    const raw = await readFile(srcFileName);
    return new DTM(raw);
  }

  toPng() {
    const png = new PNG({
      width: this.size,
      height: this.size,
      colorType: 4, // grayscale & alpha
    });
    for (let i = 0, j = 0; i < this.raw.length; i += 2, j += 4) {
      // raw[i] Sub height
      // raw[i + 1] Height
      png.data[j] = this.raw[i + 1];
      png.data[j + 1] = this.raw[i + 1];
      png.data[j + 2] = this.raw[i + 1];
      png.data[j + 3] = this.raw[i];
    }
    return png;
  }

  async saveAsPng(dstFileName: string) {
    const png = this.toPng();
    await new Promise((resolve, reject) => {
      png.pack().pipe(createWriteStream(dstFileName)).on('finish', resolve).on('error', reject);
    });
  }
}

export class Stamp {
  constructor(private raw: Buffer, private size = Math.sqrt(raw.length / 6)) {
    if (raw.length % 6 !== 0) {
      throw Error(`Invalid raw data format: dataLength=${raw.length}`);
    }
    if (!Number.isSafeInteger(size)) {
      throw Error(`Invalid raw data or size: dataLength=${raw.length} size=${size}`);
    }
  }

  static async load(srcFileName: string) {
    const raw = await readFile(srcFileName);
    return new Stamp(raw);
  }

  toPng() {
    const png = new PNG({
      width: this.size,
      height: this.size,
      colorType: 6, // color & alpha
    });
    for (let i = 0, j = 0; i < this.raw.length; i += 6, j += 4) {
      const r = (this.raw[i + 0] | this.raw[i + 1] << 8);
      const a = (this.raw[i + 2] | this.raw[i + 3] << 8);
      const b = (this.raw[i + 4] | this.raw[i + 5] << 8);
      png.data[j] = r;
      png.data[j + 1] = r;
      png.data[j + 2] = b;
      png.data[j + 3] = a;
    }
    return png;
  }

  async saveAsPng(dstFileName: string) {
    const png = this.toPng();
    await new Promise((resolve, reject) => {
      png.pack().pipe(createWriteStream(dstFileName)).on('finish', resolve).on('error', reject);
    });
  }
}
