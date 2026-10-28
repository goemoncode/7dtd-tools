export class ByteReader {
  #reader: ReadableStreamDefaultReader<Uint8Array>;
  #chunk: Uint8Array<ArrayBufferLike> = new Uint8Array();
  #chunkOffset = 0;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#reader = stream.getReader();
  }

  async read(bytesNum: number): Promise<Uint8Array> {
    const bytes = new Uint8Array(bytesNum);
    let bytesRead = 0;
    while (bytesRead < bytesNum) {
      if (this.#chunkOffset >= this.#chunk.length) {
        const result = await this.#reader.read();
        if (result.done) throw Error(`Unexpected byte length: ${bytesNum}`);
        this.#chunk = result.value;
        this.#chunkOffset = 0;
      }

      const length = Math.min(bytesNum - bytesRead, this.#chunk.length - this.#chunkOffset);
      bytes.set(this.#chunk.subarray(this.#chunkOffset, this.#chunkOffset + length), bytesRead);
      bytesRead += length;
      this.#chunkOffset += length;
    }
    return bytes;
  }

  close() {
    this.#reader.releaseLock();
  }
}
