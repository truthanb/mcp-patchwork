/**
 * MicroFreak Preset Handling
 * 
 * Implements preset dump and load via SysEx.
 * Based on reverse engineering from francoisgeorgy/microfreak-reader.
 */

import type { HardwareMidiPort } from '../../midi/hardware-port.js';
import {
  buildPresetNameRequest,
  buildPresetDumpRequest,
  buildPresetDataRequest,
  parsePresetNameResponse,
  parsePresetDataResponse,
  PRESET_CATEGORIES,
  getCategoryName,
} from '../../midi/sysex.js';

/**
 * MicroFreak preset structure.
 */
export interface MicroFreakPreset {
  /** Preset slot number (0-255) */
  slot: number;
  /** Bank number (0 or 1) */
  bank: number;
  /** Preset number within bank (0-127) */
  presetNumber: number;
  /** Preset name (up to 12 characters) */
  name: string;
  /** Category (0-10) */
  category: number;
  /** Category name */
  categoryName: string;
  /** Firmware version (1 or 2) */
  firmware: number;
  /** Whether the preset format is supported */
  supported: boolean;
  /** Raw preset data chunks (40-146 chunks of 32 bytes each) */
  data: number[][];
}

/**
 * Read a preset from MicroFreak via SysEx.
 * 
 * Implementation notes:
 * - Needs to request preset name first (gets name + category)
 * - Then requests preset dump initialization
 * - Then requests data chunks sequentially (40 chunks minimum, 146 for complete dump)
 * - MicroFreak typically responds within 2ms
 * - Recommended wait time between messages: 15ms
 * 
 * @param port - MIDI port to use
 * @param slot - Preset slot (0-255)
 * @param chunkCount - Number of chunks to read (40-146, default 146 for complete preset)
 * @param onProgress - Progress callback (current chunk, total chunks)
 * @returns Preset data or null on failure
 */
export async function readPreset(
  port: HardwareMidiPort,
  slot: number,
  chunkCount: number = 146,
  onProgress?: (current: number, total: number) => void
): Promise<MicroFreakPreset | null> {
  
  if (!port.opened) {
    return null;
  }

  if (slot < 0 || slot > 255) {
    return null;
  }

  if (chunkCount < 40 || chunkCount > 146) {
    return null;
  }

  const bank = slot > 127 ? 1 : 0;
  const presetNumber = slot % 128;

  console.log(`[MicroFreak Preset] Reading slot ${slot} (bank ${bank}, preset ${presetNumber})`);

  return new Promise((resolve, reject) => {
    let presetName = '';
    let category = 0;
    const dataChunks: number[][] = [];
    let currentChunk = 0;
    let waitingForName = true;
    let waitingForDump = false;
    let waitingForData = false;
    
    // Set up SysEx listener
    port.enableSysExInput((message) => {
      try {
        if (waitingForName) {
          const parsed = parsePresetNameResponse(message);
          if (parsed) {
            presetName = parsed.name;
            category = parsed.category;
            console.log(`[MicroFreak Preset] Got name: "${presetName}", category: ${getCategoryName(parsed.category)}`);
            waitingForName = false;
            waitingForDump = true;
            
            // Request preset dump initialization
            setTimeout(() => {
              const dumpRequest = buildPresetDumpRequest(bank, presetNumber);
              port.sendSysEx(dumpRequest);
              
              // After dump request, start requesting chunks
              setTimeout(() => {
                waitingForDump = false;
                waitingForData = true;
                requestNextChunk();
              }, 15);
            }, 15);
          }
        } else if (waitingForData) {
          const parsed = parsePresetDataResponse(message);
          if (parsed && parsed.length === 32) {
            dataChunks.push(parsed);
            currentChunk++;
            
            if (onProgress) {
              onProgress(currentChunk, chunkCount);
            }
            
            if (currentChunk >= chunkCount) {
              // Done!
              port.disableSysExInput();
              
              const firmware = detectFirmware(dataChunks);
              const supported = isPresetSupported(dataChunks);
              
              resolve({
                slot,
                bank,
                presetNumber,
                name: presetName,
                category,
                categoryName: getCategoryName(category),
                firmware,
                supported,
                data: dataChunks,
              });
            } else {
              // Request next chunk
              setTimeout(() => requestNextChunk(), 15);
            }
          }
        }
      } catch (error) {
        port.disableSysExInput();
        reject(error);
      }
    });
    
    // Helper to request next chunk
    const requestNextChunk = () => {
      const chunkRequest = buildPresetDataRequest(currentChunk);
      port.sendSysEx(chunkRequest);
    };
    
    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      port.disableSysExInput();
      reject(new Error('Preset read timeout - MicroFreak not responding'));
    }, 30000);
    
    // Start by requesting preset name
    const nameRequest = buildPresetNameRequest(bank, presetNumber);
    if (!port.sendSysEx(nameRequest)) {
      clearTimeout(timeout);
      reject(new Error('Failed to send preset name request'));
    }
  });
}

/**
 * Write a preset to MicroFreak via SysEx.
 * 
 * Note: Writing presets requires understanding the complete preset format.
 * This is more complex than reading and requires extensive testing.
 * 
 * @param port - MIDI port to use
 * @param preset - Preset data to write
 * @returns Success status
 */
export async function writePreset(
  port: HardwareMidiPort,
  preset: MicroFreakPreset
): Promise<boolean> {
  
  return false;

  // TODO: Implement preset writing
  // The full implementation would:
  // 1. Build SysEx messages for each data chunk
  // 2. Send preset name
  // 3. Send all data chunks
  // 4. Verify write success
}

/**
 * Utility: Wait for a specified time.
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Estimate firmware version from preset data.
 * FW1 has a marker at data[0][12] === 0x0C
 * Otherwise assume FW2 (current)
 */
export function detectFirmware(data: number[][]): number {
  if (data.length > 0 && data[0].length > 12) {
    return data[0][12] === 0x0C ? 1 : 2;
  }
  return 2; // Default to FW2
}

/**
 * Check if a preset format is supported.
 * Some old factory presets use an unsupported mod matrix format.
 * 
 * Unsupported pattern:
 * data[16].slice(-7) === [0x45, 0x50, 0x61, 0x6E, 0x65, 0x6C, 0x63]
 * AND data[17].slice(0, 4) === [0x00, 0x03, 0x00, 0x00]
 */
export function isPresetSupported(data: number[][]): boolean {
  if (data.length < 18) return true; // Not enough data to check

  const pattern16 = data[16]?.slice(-7);
  const pattern17 = data[17]?.slice(0, 4);

  if (!pattern16 || !pattern17) return true;

  const isUnsupported = 
    pattern16[0] === 0x45 && pattern16[1] === 0x50 && pattern16[2] === 0x61 &&
    pattern16[3] === 0x6E && pattern16[4] === 0x65 && pattern16[5] === 0x6C &&
    pattern16[6] === 0x63 &&
    pattern17[0] === 0x00 && pattern17[1] === 0x03 && 
    pattern17[2] === 0x00 && pattern17[3] === 0x00;

  return !isUnsupported;
}

/**
 * Export preset to JSON file format.
 * This is NOT a .syx file - it's a custom JSON format for easy storage.
 */
export function presetToJSON(preset: MicroFreakPreset): string {
  return JSON.stringify(preset, null, 2);
}

/**
 * Import preset from JSON file format.
 */
export function presetFromJSON(json: string): MicroFreakPreset | null {
  try {
    const preset = JSON.parse(json);
    // Basic validation
    if (!preset.name || preset.data === undefined || preset.slot === undefined) {
      return null;
    }
    return preset as MicroFreakPreset;
  } catch (error) {
    return null;
  }
}

/**
 * Preset metadata (lightweight info without full data chunks).
 */
export interface PresetMetadata {
  slot: number;
  bank: number;
  presetNumber: number;
  name: string;
  category: number;
  categoryName: string;
  isEmpty: boolean;  // True if preset is "INIT" or default pattern
}

/**
 * Scan all presets and return metadata only (no full data chunks).
 * This is much faster than reading full presets.
 * 
 * @param port - MIDI port to use
 * @param onProgress - Progress callback (current slot, total slots)
 * @returns Array of preset metadata
 */
export async function scanPresets(
  port: HardwareMidiPort,
  onProgress?: (current: number, total: number) => void
): Promise<PresetMetadata[]> {
  
  const presets: PresetMetadata[] = [];
  const totalSlots = 256;
  
  console.log('[MicroFreak Preset] Scanning all 256 preset slots...');
  
  for (let slot = 0; slot < totalSlots; slot++) {
    const bank = slot > 127 ? 1 : 0;
    const presetNumber = slot % 128;
    
    try {
      // Read just the name (no data chunks)
      const metadata = await readPresetName(port, slot);
      if (metadata) {
        presets.push(metadata);
      }
      
      if (onProgress) {
        onProgress(slot + 1, totalSlots);
      }
    } catch (error) {
      // Silently continue on errors
    }
    
    // Small delay between requests
    await wait(20);
  }
  
  console.log(`[MicroFreak Preset] Scan complete: ${presets.length} presets found`);
  return presets;
}

/**
 * Read only the preset name (fast, doesn't read data chunks).
 * 
 * @param port - MIDI port to use
 * @param slot - Preset slot (0-255)
 * @returns Preset metadata or null on failure
 */
export async function readPresetName(
  port: HardwareMidiPort,
  slot: number
): Promise<PresetMetadata | null> {
  
  if (!port.opened) {
    return null;
  }

  if (slot < 0 || slot > 255) {
    return null;
  }

  const bank = slot > 127 ? 1 : 0;
  const presetNumber = slot % 128;

  return new Promise((resolve, reject) => {
    // Set up SysEx listener
    port.enableSysExInput((message) => {
      try {
        const parsed = parsePresetNameResponse(message);
        if (parsed) {
          port.disableSysExInput();
          
          // Detect if preset is "empty" (INIT or factory default pattern)
          const isEmpty = 
            parsed.name === 'INIT' || 
            parsed.name.startsWith('Factory') ||
            parsed.name.trim() === '' ||
            parsed.category === 0;
          
          resolve({
            slot,
            bank,
            presetNumber,
            name: parsed.name,
            category: parsed.category,
            categoryName: getCategoryName(parsed.category),
            isEmpty,
          });
        }
      } catch (error) {
        port.disableSysExInput();
        reject(error);
      }
    });
    
    // Timeout after 2 seconds
    const timeout = setTimeout(() => {
      port.disableSysExInput();
      reject(new Error(`Preset name read timeout for slot ${slot}`));
    }, 2000);
    
    // Request preset name
    const nameRequest = buildPresetNameRequest(bank, presetNumber);
    if (!port.sendSysEx(nameRequest)) {
      clearTimeout(timeout);
      port.disableSysExInput();
      reject(new Error('Failed to send preset name request'));
    }
  });
}

/**
 * Find empty preset slots (INIT patches or uncategorized).
 * 
 * @param port - MIDI port to use
 * @param onProgress - Progress callback
 * @returns Array of empty preset slot numbers
 */
export async function findEmptySlots(
  port: HardwareMidiPort,
  onProgress?: (current: number, total: number) => void
): Promise<number[]> {
  
  const allPresets = await scanPresets(port, onProgress);
  const emptySlots = allPresets
    .filter(p => p.isEmpty)
    .map(p => p.slot);
  
  console.log(`[MicroFreak Preset] Found ${emptySlots.length} empty slots:`, emptySlots);
  return emptySlots;
}
