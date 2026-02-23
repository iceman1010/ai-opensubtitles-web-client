import { describe, it, expect } from 'vitest';
import { calculateMovieHash } from './movieHashService';

describe('calculateMovieHash', () => {
  it('throws for files smaller than 64KB', async () => {
    const small = new File([new Uint8Array(1000)], 'tiny.mp4');
    await expect(calculateMovieHash(small)).rejects.toThrow('too small');
  });

  it('produces a 16-character hex string for a valid file', async () => {
    // Create a 128KB file with deterministic content
    const size = 128 * 1024;
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = i % 256;
    }
    const file = new File([data], 'test.mp4');
    const hash = await calculateMovieHash(file);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces consistent output for same input', async () => {
    const size = 65536; // exactly 64KB — first and last chunks overlap completely
    const data = new Uint8Array(size);
    for (let i = 0; i < size; i++) {
      data[i] = (i * 7) % 256;
    }
    const file = new File([data], 'test.mp4');
    const hash1 = await calculateMovieHash(file);
    const hash2 = await calculateMovieHash(file);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different content', async () => {
    const size = 128 * 1024;
    const data1 = new Uint8Array(size).fill(0);
    const data2 = new Uint8Array(size).fill(1);
    const file1 = new File([data1], 'a.mp4');
    const file2 = new File([data2], 'b.mp4');
    const hash1 = await calculateMovieHash(file1);
    const hash2 = await calculateMovieHash(file2);
    expect(hash1).not.toBe(hash2);
  });
});
