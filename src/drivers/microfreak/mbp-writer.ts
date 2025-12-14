/**
 * MicroFreak .mbp File Writer
 * 
 * Writes .mbp files (Boost serialization format) that can be imported
 * via Arturia MIDI Control Center.
 */

import { writeFile } from 'fs/promises';

/**
 * Write a MicroFreak preset to .mbp format.
 * 
 * .mbp files use Boost serialization format with this structure:
 * - Header: "serialization::archive 19 0 0"
 * - Chunks: Each chunk is written as space-separated decimal values
 * 
 * @param chunks - All 146 preset chunks (32 bytes each)
 * @param outputPath - Output file path
 */
export async function writeMBP(chunks: number[][], outputPath: string): Promise<void> {
  if (chunks.length !== 146) {
    throw new Error(`Expected 146 chunks, got ${chunks.length}`);
  }

  // Verify each chunk is 32 bytes
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].length !== 32) {
      throw new Error(`Chunk ${i} has ${chunks[i].length} bytes, expected 32`);
    }
  }

  // Build .mbp content
  const lines: string[] = [];
  
  // Header
  lines.push('serialization::archive 19 0 0');
  
  // Write all chunks as space-separated decimal values
  for (const chunk of chunks) {
    lines.push(chunk.join(' '));
  }

  // Write to file
  const content = lines.join('\n') + '\n';
  await writeFile(outputPath, content, 'utf-8');
}
