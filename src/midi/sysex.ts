/**
 * SysEx Message Utilities
 * 
 * Handles System Exclusive (SysEx) message building and parsing for MIDI.
 * SysEx is used for manufacturer-specific commands like preset dumps.
 */

/**
 * SysEx message structure:
 * 0xF0           - SysEx start byte
 * 0xMM 0xMM 0xMM - Manufacturer ID (3 bytes for extended)
 * ...data...     - Payload
 * 0xF7           - SysEx end byte
 */

/**
 * Build a complete SysEx message.
 * 
 * @param manufacturerId - Manufacturer ID bytes (1 or 3 bytes)
 * @param data - Payload data
 * @returns Complete SysEx message with start/end bytes
 */
export function buildSysExMessage(manufacturerId: number[], data: number[]): number[] {
  return [
    0xF0,                 // SysEx start
    ...manufacturerId,    // Manufacturer ID
    ...data,              // Payload
    0xF7                  // SysEx end
  ];
}

/**
 * Parse a SysEx message, extracting manufacturer ID and data.
 * 
 * @param message - Complete SysEx message
 * @returns Object with manufacturerId and data, or null if invalid
 */
export function parseSysExMessage(message: number[]): { manufacturerId: number[]; data: number[] } | null {
  if (message.length < 4) return null;
  if (message[0] !== 0xF0) return null;
  if (message[message.length - 1] !== 0xF7) return null;

  // Determine manufacturer ID length
  // If first byte is 0x00, it's a 3-byte extended ID
  const isExtended = message[1] === 0x00;
  const manufacturerIdLength = isExtended ? 3 : 1;
  
  const manufacturerId = message.slice(1, 1 + manufacturerIdLength);
  const data = message.slice(1 + manufacturerIdLength, -1);

  return { manufacturerId, data };
}

/**
 * Arturia manufacturer ID (extended format).
 * 0x00 0x20 0x6B
 */
export const ARTURIA_MANUFACTURER_ID = [0x00, 0x20, 0x6B];

/**
 * MicroFreak device ID.
 * 0x07
 */
export const MICROFREAK_DEVICE_ID = 0x07;

/**
 * Build an Arturia SysEx message for MicroFreak.
 * 
 * @param data - Payload data
 * @returns Complete SysEx message
 */
export function buildArturiaSysEx(data: number[]): number[] {
  return buildSysExMessage(ARTURIA_MANUFACTURER_ID, [MICROFREAK_DEVICE_ID, ...data]);
}

/**
 * Parse an Arturia SysEx message.
 * Returns null if not an Arturia message.
 * 
 * @param message - Complete SysEx message
 * @returns Parsed data or null
 */
export function parseArturiaSysEx(message: number[]): number[] | null {
  const parsed = parseSysExMessage(message);
  if (!parsed) return null;

  // Check manufacturer ID
  if (parsed.manufacturerId.length !== 3) return null;
  if (parsed.manufacturerId[0] !== ARTURIA_MANUFACTURER_ID[0]) return null;
  if (parsed.manufacturerId[1] !== ARTURIA_MANUFACTURER_ID[1]) return null;
  if (parsed.manufacturerId[2] !== ARTURIA_MANUFACTURER_ID[2]) return null;

  // Check device ID
  if (parsed.data.length < 1) return null;
  if (parsed.data[0] !== MICROFREAK_DEVICE_ID) return null;

  return parsed.data.slice(1); // Return data after device ID
}

/**
 * MicroFreak SysEx command codes.
 */
export const MicroFreakSysExCommand = {
  /** Request preset data (0x18) */
  REQUEST_PRESET_DATA: 0x18,
  /** Request preset name (0x19) */
  REQUEST_PRESET_NAME: 0x19,
  /** Preset data response (0x16 or 0x17) */
  RESPONSE_DATA: [0x16, 0x17],
  /** Preset name response (0x52) */
  RESPONSE_NAME: 0x52,
} as const;

/**
 * Build a MicroFreak preset name request.
 * 
 * @param bank - Bank number (0 or 1)
 * @param preset - Preset number (0-127)
 * @param sequence - Sequence number (default 0x00)
 * @returns Complete SysEx message
 */
export function buildPresetNameRequest(bank: number, preset: number, sequence: number = 0x00): number[] {
  return buildArturiaSysEx([
    0x01,                                    // ???
    sequence,                                // Sequence number
    0x01,                                    // ???
    MicroFreakSysExCommand.REQUEST_PRESET_NAME,
    bank,
    preset,
    0x00
  ]);
}

/**
 * Build a MicroFreak preset dump request.
 * 
 * @param bank - Bank number (0 or 1)
 * @param preset - Preset number (0-127)
 * @returns Complete SysEx message
 */
export function buildPresetDumpRequest(bank: number, preset: number): number[] {
  return buildArturiaSysEx([
    0x01,                                    // ???
    0x01,                                    // ???
    0x01,                                    // ???
    MicroFreakSysExCommand.REQUEST_PRESET_NAME,
    bank,
    preset,
    0x01                                     // Request full dump
  ]);
}

/**
 * Build a MicroFreak preset data chunk request.
 * Used to request individual chunks of preset data (need to call 40-146 times).
 * 
 * @param chunkNumber - Chunk number (0-145)
 * @returns Complete SysEx message
 */
export function buildPresetDataRequest(chunkNumber: number): number[] {
  return buildArturiaSysEx([
    0x01,
    chunkNumber,
    0x01,
    MicroFreakSysExCommand.REQUEST_PRESET_DATA,
    0x00
  ]);
}

/**
 * Parse a MicroFreak preset name response.
 * 
 * @param message - Complete SysEx message
 * @returns Preset name and category, or null if invalid
 */
export function parsePresetNameResponse(message: number[]): { name: string; category: number } | null {
  const data = parseArturiaSysEx(message);
  if (!data) return null;

  // Check response type
  if (data.length < 8) return null;
  if (data[7] !== MicroFreakSysExCommand.RESPONSE_NAME) return null;

  // Extract name (starts at byte 8, null-terminated or ends at byte 19)
  const nameBytes = data.slice(8);
  let name = '';
  let i = 4; // Name starts at offset 4 within nameBytes
  while (i < nameBytes.length && nameBytes[i] !== 0) {
    name += String.fromCharCode(nameBytes[i]);
    i++;
  }

  // Category is at byte 19 of data
  const category = data[19] || 0;

  return { name, category };
}

/**
 * Parse a MicroFreak preset data chunk response.
 * 
 * @param message - Complete SysEx message
 * @returns Data chunk (32 bytes) or null if invalid
 */
export function parsePresetDataResponse(message: number[]): number[] | null {
  const data = parseArturiaSysEx(message);
  if (!data) return null;

  // Check response type (0x16 or 0x17)
  if (data.length < 8) return null;
  const responseType = data[7];
  if (responseType !== 0x16 && responseType !== 0x17) return null;

  // Check chunk length (should be 42 bytes total: 9 header + 32 data + 1 end)
  if (data.length + 5 !== 42) return null; // +5 for manufacturer ID + device ID - 1 for already sliced

  // Return data chunk (32 bytes starting at byte 8)
  return data.slice(8);
}

/**
 * Preset categories (matching MicroFreak manual).
 */
export const PRESET_CATEGORIES = [
  'Bass',       // 0
  'Brass',      // 1
  'Keys',       // 2
  'Lead',       // 3
  'Organ',      // 4
  'Pad',        // 5
  'Percussion', // 6
  'Sequence',   // 7
  'SFX',        // 8
  'Strings',    // 9
  'Template'    // 10
] as const;

/**
 * Get category name from category number.
 */
export function getCategoryName(category: number): string {
  if (category < 0 || category >= PRESET_CATEGORIES.length) {
    return 'Unknown';
  }
  return PRESET_CATEGORIES[category];
}
