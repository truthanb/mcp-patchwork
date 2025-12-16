/**
 * MicroFreak Sequencer
 * 
 * Handles reading and writing sequence data (chunks 40-145 of preset dump).
 * 
 * Note: The internal binary format is not yet fully documented.
 * We store raw chunk data and will gradually decode as we learn the format.
 */

import type { HardwareMidiPort } from '../../midi/hardware-port.js';
import {
  buildPresetDataRequest,
  parsePresetDataResponse,
  buildArturiaSysEx,
} from '../../midi/sysex.js';

/**
 * MicroFreak sequence structure.
 * 
 * Initially stores raw binary data from chunks 40-145.
 * As we reverse engineer the format, we'll add typed fields.
 */
export interface MicroFreakSequence {
  /** Raw sequence data from SysEx chunks 40-145 (106 chunks × 32 bytes = 3392 bytes) */
  rawData: number[][];
  
  /** Decoded sequence data (to be implemented as we understand the format) */
  decoded?: {
    steps?: SequenceStep[];
    length?: number;       // Active steps (1-64)
    swing?: number;        // Swing amount (0-1)
    // More fields as we decode them...
  };
}

/**
 * Individual sequence step.
 * 
 * REVERSE ENGINEERING STATUS - 4-LANE STRUCTURE:
 * - Each chunk (32 bytes) = one sequencer step
 * - MicroFreak sequencer has 4 automation lanes that can record different parameters
 * 
 * Lane positions (0-127 values):
 * - Lane A: byte[1]  - Modulation lane 1
 * - Lane B: byte[10] - Main note (MIDI 36-96) or modulation
 * - Lane C: byte[19] - Modulation lane 2
 * - Lane D: byte[28] - Modulation lane 3
 * 
 * Other known bytes:
 * - byte[9]: Gate (0 = step ON, 127 = step OFF)
 * - byte[0], byte[24]: Flags/mode (common values: 0, 2, 14, 32, 64, 96, 112, 120)
 * 
 * Unknown (being decoded):
 * - Which parameter each modulation lane controls
 * - Velocity, slide, ties
 * - Metadata bytes between lanes
 */
export interface SequenceStep {
  note?: number;       // Main note (Lane B: byte[10]) - MIDI 0-127 (undefined = no note)
  gate?: boolean;      // Step on/off (byte[9]: 0=ON, 127=OFF)
  
  // Modulation lanes (can be 0-127 values for any parameter)
  // When value is in note range (36-96), might be pitch modulation
  // When value is 0-127, might be filter/wave/other parameter
  modA?: number;       // Lane A (byte[1]) - Modulation lane 1
  modC?: number;       // Lane C (byte[19]) - Modulation lane 2  
  modD?: number;       // Lane D (byte[28]) - Modulation lane 3
  
  // Not yet decoded:
  velocity?: number;   // Note velocity (position unknown)
  slide?: boolean;     // Glide to next note (position unknown)
}

/**
 * Get the current sequence from MicroFreak.
 * 
 * Reads chunks 40-145 (sequence data) from the currently active preset.
 * 
 * @param port - MIDI port connected to MicroFreak
 * @param onProgress - Progress callback (current chunk, total chunks)
 * @returns Sequence data or null on failure
 */
export async function getSequence(
  port: HardwareMidiPort,
  onProgress?: (current: number, total: number) => void
): Promise<MicroFreakSequence | null> {
  
  if (!port.opened) {
    return null;
  }

  const sequenceChunks: number[][] = [];
  const FIRST_SEQUENCE_CHUNK = 40;
  const LAST_SEQUENCE_CHUNK = 145;
  const TOTAL_SEQUENCE_CHUNKS = LAST_SEQUENCE_CHUNK - FIRST_SEQUENCE_CHUNK + 1; // 106 chunks

  // Note: This assumes you've already read the full preset (chunks 0-39)
  // and the MicroFreak is ready to send sequence data.
  // In practice, you'd call buildPresetDumpRequest first.

  // Request sequence chunks sequentially
  for (let chunkNum = FIRST_SEQUENCE_CHUNK; chunkNum <= LAST_SEQUENCE_CHUNK; chunkNum++) {
    const request = buildPresetDataRequest(chunkNum);
    
    if (!port.sendSysEx(request)) {
      return null;
    }

    // Wait for response (15ms recommended)
    await wait(15);

    // TODO: Implement SysEx input handling to receive the response
    // For now, this is a placeholder showing the structure

    if (onProgress) {
      onProgress(chunkNum - FIRST_SEQUENCE_CHUNK + 1, TOTAL_SEQUENCE_CHUNKS);
    }
  }

  console.warn('[MicroFreak Sequence] SysEx input handling not yet implemented');
  console.warn('[MicroFreak Sequence] Need to capture responses to build sequenceChunks array');

  return null;

  // TODO: Once we can receive SysEx responses:
  // return {
  //   rawData: sequenceChunks,
  //   decoded: decodeSequence(sequenceChunks)
  // };
}

/**
 * Set a sequence on the MicroFreak.
 * 
 * Writes sequence data (chunks 40-145) to the current preset.
 * 
 * WARNING: This modifies preset memory. Test carefully on non-critical slots.
 * 
 * @param port - MIDI port connected to MicroFreak
 * @param sequence - Sequence data to write
 * @returns Success status
 */
export async function setSequence(
  port: HardwareMidiPort,
  sequence: MicroFreakSequence
): Promise<boolean> {
  
  if (!port.opened) {
    return false;
  }

  // Validate sequence data
  if (!sequence.rawData || sequence.rawData.length !== 106) {
    return false;
  }

  // Based on MIDI capture analysis from Arturia MIDI Control Center:
  // Writing a preset involves:
  // 1. Sending chunk data to edit buffer (mechanism unknown - maybe via 0x23 command?)
  // 2. Sending 10-byte commit messages: F0 00 20 6B 07 01 [chunkNum] 00 18 F7
  //
  // Let's try sending commit messages only for sequence chunks (70-145).
  // This requires the edit buffer to already contain valid sequence data.
  // The edit buffer might be populated by:
  // - Loading a preset first
  // - Sending real-time parameter changes via CC/NRPN
  // - Some undiscovered chunk write command
  
  const FIRST_SEQUENCE_CHUNK = 70;
  const LAST_SEQUENCE_CHUNK = 145;
  
  console.log('[MicroFreak Sequence] Attempting sequence write via commit messages...');
  console.log('[MicroFreak Sequence] This is experimental - protocol not fully understood');
  
  // Try committing each sequence chunk from edit buffer to storage
  for (let chunkNum = FIRST_SEQUENCE_CHUNK; chunkNum <= LAST_SEQUENCE_CHUNK; chunkNum++) {
    // Build 10-byte commit message: F0 00 20 6B 07 01 [chunkNum] 00 18 F7
    const commitMsg = buildArturiaSysEx([
      0x01,      // Device ID field
      chunkNum,  // Chunk number to commit
      0x00,      // Unknown byte (always 0x00 in captures)
      0x18       // Command: Commit chunk from edit buffer
    ]);
    
    if (!port.sendSysEx(commitMsg)) {
      console.error(`[MicroFreak Sequence] Failed to send commit for chunk ${chunkNum}`);
      return false;
    }
    
    // Small delay between messages
    await wait(2);
  }
  
  console.log('[MicroFreak Sequence] Commit messages sent.');
  console.warn('[MicroFreak Sequence] ⚠️  LIMITATION: This only commits existing edit buffer data.');
  console.warn('[MicroFreak Sequence] To write custom sequences, we need to discover how to:');
  console.warn('[MicroFreak Sequence]   1. Write chunk data to edit buffer, OR');
  console.warn('[MicroFreak Sequence]   2. Send real-time parameter changes to modify sequence steps');
  console.warn('[MicroFreak Sequence] For now, manually program the sequence on hardware first,');
  console.warn('[MicroFreak Sequence] then call this to commit it to the current preset.');

  return true;
}

/**
 * Decode raw sequence data into structured format.
 * 
 * DECODING NOTES (from reverse engineering):
 * - Chunks 40-69: Default/padding (all 127)
 * - Chunks 70-145: Actual sequence steps (76 chunks total)
 * - Each chunk (32 bytes) = 1 sequencer step
 * - byte[10]: Main note (MIDI 36-96 for C2-C7)
 * - byte[9]: Gate flag (0 = active, 127 = inactive)
 * - Other bytes still being decoded (velocity, slide, mod lanes)
 * 
 * @param chunks - Raw sequence data (chunks 40-145, total 106 chunks)
 * @returns Decoded sequence structure
 */
function decodeSequence(chunks: number[][]): MicroFreakSequence['decoded'] {
  const steps: SequenceStep[] = [];
  
  // Sequence data starts at chunk 70 (index 30 in chunks array since chunks start at 40)
  const SEQUENCE_START_CHUNK = 30; // chunk 70 = index 30 (70-40)
  const MAX_STEPS = 64;
  
  for (let i = 0; i < MAX_STEPS; i++) {
    const chunkIndex = SEQUENCE_START_CHUNK + i;
    if (chunkIndex >= chunks.length) break;
    
    const chunk = chunks[chunkIndex];
    const step: SequenceStep = {};
    
    // Extract gate from byte 9
    // 0 = step active, 127 = step inactive/empty
    step.gate = chunk[9] === 0;
    
    // Extract all 4 lanes
    const laneA = chunk[1];   // Modulation lane A
    const laneB = chunk[10];  // Main note / modulation lane B
    const laneC = chunk[19];  // Modulation lane C
    const laneD = chunk[28];  // Modulation lane D
    
    // Lane B: If in note range (36-96), treat as main note
    if (laneB >= 36 && laneB <= 96) {
      step.note = laneB;
    }
    
    // Modulation lanes: Store if not default values (127 = empty, 1 = minimal)
    if (laneA !== 127 && laneA !== 1) {
      step.modA = laneA;
    }
    if (laneC !== 127 && laneC !== 1) {
      step.modC = laneC;
    }
    if (laneD !== 127 && laneD !== 1) {
      step.modD = laneD;
    }
    
    // Check if step is completely empty
    const hasAnyData = step.note || step.modA !== undefined || step.modC !== undefined || step.modD !== undefined || step.gate;
    if (!hasAnyData) {
      const isEmpty = chunk.every(b => b === 0 || b === 127 || b === 100 || b === 123);
      if (isEmpty && i > 0) {
        // Likely end of active sequence
        break;
      }
    }
    
    steps.push(step);
  }
  
  return {
    steps,
    length: steps.length,
    swing: 0  // Not yet decoded
  };
}

/**
 * Encode structured sequence data into raw binary format.
 * 
 * ENCODING NOTES (best-effort implementation):
 * - Creates 106 chunks (40-145)
 * - Chunks 0-29 (40-69): All 127 (default/metadata)
 * - Chunks 30+ (70+): Sequence steps (1 chunk per step)
 * - byte[10]: Note value
 * - byte[9]: Gate (0 = on, 127 = off)
 * - byte[0], byte[24]: Set to reasonable defaults based on observed patterns
 * 
 * WARNING: This encoder is based on limited reverse engineering.
 * Encoded sequences may not preserve all MicroFreak features (velocity, slide, mod).
 * Test carefully before using on important presets.
 * 
 * @param steps - Sequence steps (max 64)
 * @param length - Active step count (1-64)
 * @param swing - Swing amount 0-1 (not yet implemented)
 * @returns Raw chunk data (106 chunks × 32 bytes)
 */
export function encodeSequence(
  steps: SequenceStep[],
  length: number,
  swing: number = 0
): number[][] {
  const chunks: number[][] = [];
  const totalSteps = Math.min(steps.length, 64);
  
  // Chunks 0-29 (representing preset chunks 40-69): Default/padding
  for (let i = 0; i < 30; i++) {
    chunks.push(new Array(32).fill(127));
  }
  
  // Chunks 30-93 (representing preset chunks 70-133): Sequence steps (up to 64 steps)
  for (let i = 0; i < 64; i++) {
    const chunk = new Array(32).fill(127);
    
    if (i < totalSteps) {
      const step = steps[i];
      
      // Set gate at byte 9
      if (step.gate) {
        chunk[9] = 0;  // Gate on
        
        // Set common flag values observed in active steps
        chunk[0] = 0;      // Common flag when step active
        chunk[24] = 112;   // Common flag value
      } else {
        chunk[9] = 127;  // Gate off/empty
      }
      
      // Set Lane B (main note) at byte 10
      if (step.note !== undefined) {
        chunk[10] = Math.max(0, Math.min(127, Math.round(step.note)));
      } else {
        chunk[10] = 1;  // Minimal value when no note
      }
      
      // Set modulation lanes
      if (step.modA !== undefined) {
        chunk[1] = Math.max(0, Math.min(127, Math.round(step.modA)));
      } else if (step.gate) {
        chunk[1] = 127;  // Default when no modulation
      }
      
      if (step.modC !== undefined) {
        chunk[19] = Math.max(0, Math.min(127, Math.round(step.modC)));
      } else if (step.gate) {
        chunk[19] = 127;  // Default when no modulation
      }
      
      if (step.modD !== undefined) {
        chunk[28] = Math.max(0, Math.min(127, Math.round(step.modD)));
      } else if (step.gate) {
        chunk[28] = 1;  // Observed default for lane D
      }
      
      // TODO: Encode velocity, slide when positions are identified
    }
    
    chunks.push(chunk);
  }
  
  // Remaining chunks to reach 106 total (chunks 134-145): Padding/metadata
  while (chunks.length < 106) {
    chunks.push(new Array(32).fill(127));
  }
  
  return chunks;
  
  return chunks;
}

/**
 * Utility: Wait for a specified time.
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
