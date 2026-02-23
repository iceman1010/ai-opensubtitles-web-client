/**
 * OpenSubtitles.com movie hash algorithm — browser implementation.
 *
 * Algorithm:
 * 1. Start with file size as initial hash value (8 little-endian bytes)
 * 2. Read first 64KB chunk and add all bytes
 * 3. Read last 64KB chunk and add all bytes
 * 4. Propagate carries between bytes
 * 5. Convert to 16-character hexadecimal string
 *
 * Only reads 128KB total regardless of file size — works instantly for multi-GB files.
 */

const HASH_CHUNK_SIZE = 65536; // 64 * 1024

export async function calculateMovieHash(file: File): Promise<string> {
  const fileSize = file.size;

  if (fileSize < HASH_CHUNK_SIZE) {
    throw new Error('File is too small to calculate hash (minimum 64KB required)');
  }

  // Initialize 8 integers with file size (little-endian decomposition)
  const longs = new Array(8).fill(0);
  let temp = fileSize;
  for (let i = 0; i < 8; i++) {
    longs[i] = temp & 0xff;
    temp = Math.floor(temp / 256);
  }

  // Read first 64KB via File.slice()
  const firstSlice = file.slice(0, HASH_CHUNK_SIZE);
  const firstBuffer = new Uint8Array(await firstSlice.arrayBuffer());
  processChunk(firstBuffer, longs);

  // Read last 64KB via File.slice()
  const lastSlice = file.slice(fileSize - HASH_CHUNK_SIZE);
  const lastBuffer = new Uint8Array(await lastSlice.arrayBuffer());
  processChunk(lastBuffer, longs);

  return binl2hex(longs);
}

/**
 * Process a chunk of data and add bytes to the hash array
 */
function processChunk(chunk: Uint8Array, longs: number[]): void {
  for (let i = 0; i < chunk.length; i++) {
    longs[(i + 8) % 8] += chunk[i];
  }
}

/**
 * Convert array of 8 integers to hexadecimal string.
 * Handles overflow by propagating carries between bytes.
 */
function binl2hex(a: number[]): string {
  const b = 255;
  const d = '0123456789abcdef';
  let e = '';

  // Propagate carries
  a[1] += a[0] >> 8; a[0] = a[0] & b;
  a[2] += a[1] >> 8; a[1] = a[1] & b;
  a[3] += a[2] >> 8; a[2] = a[2] & b;
  a[4] += a[3] >> 8; a[3] = a[3] & b;
  a[5] += a[4] >> 8; a[4] = a[4] & b;
  a[6] += a[5] >> 8; a[5] = a[5] & b;
  a[7] += a[6] >> 8; a[6] = a[6] & b;
  a[7] = a[7] & b;

  // Convert to hex string (big-endian output)
  for (let c = 7; c > -1; c--) {
    e += d.charAt((a[c] >> 4) & 15) + d.charAt(a[c] & 15);
  }

  return e;
}
