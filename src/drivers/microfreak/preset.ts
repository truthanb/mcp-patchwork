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
 * @param onProgress - Progress callback (current chunk, total chunks)
 * @returns Preset data or null on failure
 */
export async function readPreset(
  port: HardwareMidiPort,
  slot: number,
  onProgress?: (current: number, total: number) => void
): Promise<MicroFreakPreset | null> {
  
  if (!port.opened) {
    console.error('[MicroFreak Preset] Port not open');
    return null;
  }

  if (slot < 0 || slot > 255) {
    console.error('[MicroFreak Preset] Invalid slot number:', slot);
    return null;
  }

  const bank = slot > 127 ? 1 : 0;
  const presetNumber = slot % 128;

  console.log(`[MicroFreak Preset] Reading slot ${slot} (bank ${bank}, preset ${presetNumber})`);

  // Step 1: Request preset name
  const nameRequest = buildPresetNameRequest(bank, presetNumber);
  if (!port.sendSysEx(nameRequest)) {
    console.error('[MicroFreak Preset] Failed to send name request');
    return null;
  }

  // Wait for response
  await wait(15);

  // Note: In a real implementation, we'd need to listen for the SysEx response.
  // For now, this is a placeholder showing the structure.
  // You'll need to implement SysEx input handling using midi.Input with
  // a listener for 'sysex' events.

  console.warn('[MicroFreak Preset] SysEx input handling not yet implemented');
  console.warn('[MicroFreak Preset] This requires adding an Input port and listener');
  
  return null;

  // TODO: Implement SysEx input handling
  // The full implementation would:
  // 1. Create midi.Input instance
  // 2. Set up listener for SysEx messages
  // 3. Parse responses using parsePresetNameResponse() and parsePresetDataResponse()
  // 4. Request 40-146 data chunks sequentially
  // 5. Detect firmware version from data
  // 6. Check if preset format is supported
  // 7. Return complete preset structure
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
  
  console.error('[MicroFreak Preset] Preset writing not yet implemented');
  console.error('[MicroFreak Preset] This requires understanding the complete SysEx write protocol');
  
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
    console.error('[MicroFreak Preset] Failed to parse JSON:', error);
    return null;
  }
}
