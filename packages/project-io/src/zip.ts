/**
 * The little of the ZIP format a project container needs.
 *
 * A project has to travel as one file with its climate beside it, and a ZIP is
 * what every operating system already opens. Only what is needed is
 * implemented — stored or deflated entries, no encryption, no spanning — and it
 * is implemented here rather than pulled in, so the format the application
 * writes is the format it can read back, with no third party in between.
 *
 * Timestamps are fixed: the same content produces the same bytes, which is what
 * makes a container comparable and a test meaningful.
 */
export interface ZipEntry {
  readonly name: string;
  readonly data: Uint8Array;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
/** 1980-01-01 00:00, the earliest a ZIP date can express. */
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 33;
const UTF8_NAME_FLAG = 0x0800;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function through(
  data: Uint8Array,
  transform: 'CompressionStream' | 'DecompressionStream',
): Promise<Uint8Array | undefined> {
  const factory = (globalThis as Record<string, unknown>)[transform];
  if (typeof factory !== 'function') return undefined;
  const stream = new (factory as new (format: string) => TransformStream)(
    'deflate-raw',
  );
  const writer = stream.writable.getWriter();
  void writer.write(data);
  void writer.close();
  const chunks: Uint8Array[] = [];
  const reader = (stream.readable as ReadableStream<Uint8Array>).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) chunks.push(value);
  }
  return concat(chunks);
}

function concat(chunks: readonly Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

class ByteWriter {
  #chunks: Uint8Array[] = [];
  #length = 0;
  get length(): number {
    return this.#length;
  }
  push(chunk: Uint8Array): void {
    this.#chunks.push(chunk);
    this.#length += chunk.length;
  }
  u16(value: number): void {
    const view = new DataView(new ArrayBuffer(2));
    view.setUint16(0, value, true);
    this.push(new Uint8Array(view.buffer));
  }
  u32(value: number): void {
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, value >>> 0, true);
    this.push(new Uint8Array(view.buffer));
  }
  bytes(): Uint8Array {
    return concat(this.#chunks);
  }
}

interface PreparedEntry {
  readonly name: Uint8Array;
  readonly crc: number;
  readonly compressed: Uint8Array;
  readonly uncompressedSize: number;
  readonly method: 0 | 8;
  readonly offset: number;
}

/** The archive holding these entries, in the order they were given. */
export async function writeZip(
  entries: readonly ZipEntry[],
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const body = new ByteWriter();
  const prepared: PreparedEntry[] = [];
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const deflated = await through(entry.data, 'CompressionStream');
    // Compression is a convenience, not a requirement: a runtime without it
    // still writes an archive every unzip tool opens.
    const useDeflate =
      deflated !== undefined && deflated.length < entry.data.length;
    const compressed = useDeflate ? deflated : entry.data;
    const offset = body.length;
    body.u32(LOCAL_HEADER);
    body.u16(20);
    body.u16(UTF8_NAME_FLAG);
    body.u16(useDeflate ? 8 : 0);
    body.u16(FIXED_DOS_TIME);
    body.u16(FIXED_DOS_DATE);
    const crc = crc32(entry.data);
    body.u32(crc);
    body.u32(compressed.length);
    body.u32(entry.data.length);
    body.u16(name.length);
    body.u16(0);
    body.push(name);
    body.push(compressed);
    prepared.push({
      name,
      crc,
      compressed,
      uncompressedSize: entry.data.length,
      method: useDeflate ? 8 : 0,
      offset,
    });
  }
  const directoryOffset = body.length;
  for (const entry of prepared) {
    body.u32(CENTRAL_HEADER);
    body.u16(20);
    body.u16(20);
    body.u16(UTF8_NAME_FLAG);
    body.u16(entry.method);
    body.u16(FIXED_DOS_TIME);
    body.u16(FIXED_DOS_DATE);
    body.u32(entry.crc);
    body.u32(entry.compressed.length);
    body.u32(entry.uncompressedSize);
    body.u16(entry.name.length);
    body.u16(0);
    body.u16(0);
    body.u16(0);
    body.u16(0);
    body.u32(0);
    body.u32(entry.offset);
    body.push(entry.name);
  }
  const directorySize = body.length - directoryOffset;
  body.u32(END_OF_CENTRAL_DIRECTORY);
  body.u16(0);
  body.u16(0);
  body.u16(prepared.length);
  body.u16(prepared.length);
  body.u32(directorySize);
  body.u32(directoryOffset);
  body.u16(0);
  return body.bytes();
}

/**
 * What an archive is allowed to be.
 *
 * Everything here runs in the reader's own browser, so a hostile or merely
 * enormous file cannot reach a server — it freezes the tab instead. A file that
 * would expand to hundreds of megabytes is refused before it is expanded rather
 * than after.
 */
export interface ZipLimits {
  readonly maxArchiveBytes: number;
  readonly maxEntries: number;
  readonly maxEntryBytes: number;
  readonly maxTotalBytes: number;
  /** How much larger than its stored form one entry may become. */
  readonly maxCompressionRatio: number;
}

export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 128 * 1024 * 1024,
  maxEntries: 128,
  maxEntryBytes: 32 * 1024 * 1024,
  maxTotalBytes: 256 * 1024 * 1024,
  maxCompressionRatio: 1000,
};

export class ZipFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZipFormatError';
  }
}

/** Whether these bytes start like an archive, so a reader can tell them apart. */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

/** The entries an archive holds, checked against their recorded checksums. */
export async function readZip(
  bytes: Uint8Array,
  limits: ZipLimits = DEFAULT_ZIP_LIMITS,
): Promise<readonly ZipEntry[]> {
  if (bytes.length > limits.maxArchiveBytes)
    throw new ZipFormatError(
      `This archive is ${Math.round(bytes.length / 1024 / 1024)} MB; the reader accepts ${Math.round(limits.maxArchiveBytes / 1024 / 1024)} MB.`,
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(view, bytes.length);
  const count = view.getUint16(end + 10, true);
  if (count > limits.maxEntries)
    throw new ZipFormatError(
      `This archive declares ${count} entries; the reader accepts ${limits.maxEntries}.`,
    );
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: ZipEntry[] = [];
  let totalBytes = 0;
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(cursor, true) !== CENTRAL_HEADER)
      throw new ZipFormatError('Central directory entry is missing.');
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    cursor += 46 + nameLength + extraLength + commentLength;
    // Only stored and deflated entries are read. Treating every other method as
    // deflate would try to decompress something that is not deflate.
    if (method !== 0 && method !== 8)
      throw new ZipFormatError(
        `Entry ${name} uses compression method ${method}, which this reader does not support.`,
      );
    if (uncompressedSize > limits.maxEntryBytes)
      throw new ZipFormatError(
        `Entry ${name} declares ${Math.round(uncompressedSize / 1024 / 1024)} MB; the reader accepts ${Math.round(limits.maxEntryBytes / 1024 / 1024)} MB per entry.`,
      );
    if (
      compressedSize > 0 &&
      uncompressedSize / compressedSize > limits.maxCompressionRatio
    )
      throw new ZipFormatError(
        `Entry ${name} expands ${Math.round(uncompressedSize / compressedSize)} times; the reader accepts ${limits.maxCompressionRatio}.`,
      );
    totalBytes += uncompressedSize;
    if (totalBytes > limits.maxTotalBytes)
      throw new ZipFormatError(
        `This archive expands past ${Math.round(limits.maxTotalBytes / 1024 / 1024)} MB.`,
      );
    if (view.getUint32(localOffset, true) !== LOCAL_HEADER)
      throw new ZipFormatError(`Entry ${name} has no local header.`);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const stored = bytes.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 0 ? stored : await inflate(stored, name, uncompressedSize);
    if (crc32(data) !== crc)
      throw new ZipFormatError(`Entry ${name} does not match its checksum.`);
    entries.push({ name, data });
  }
  return entries;
}

async function inflate(
  stored: Uint8Array,
  name: string,
  expectedSize: number,
): Promise<Uint8Array> {
  const inflated = await through(stored, 'DecompressionStream');
  if (inflated === undefined)
    throw new ZipFormatError(
      `Entry ${name} is compressed and this browser cannot decompress it.`,
    );
  if (inflated.length !== expectedSize)
    throw new ZipFormatError(`Entry ${name} has an unexpected size.`);
  return inflated;
}

function findEndOfCentralDirectory(view: DataView, length: number): number {
  for (let offset = length - 22; offset >= 0; offset -= 1)
    if (view.getUint32(offset, true) === END_OF_CENTRAL_DIRECTORY)
      return offset;
  throw new ZipFormatError('This file is not a ZIP archive.');
}
