/**
 * Roland SysEx Utilities
 * 
 * Helper functions for Roland-specific SysEx communication
 * (SE-02, other Roland Boutique series, etc.)
 */

/**
 * Calculate Roland checksum for SysEx messages.
 * Roland checksum = 128 - ((sum of data bytes) % 128)
 * 
 * @param data Array of data bytes (excluding F0, manufacturer ID, and F7)
 * @returns Checksum byte (0-127)
 */
export function calculateRolandChecksum(data: number[]): number {
  const sum = data.reduce((acc, byte) => acc + byte, 0);
  return (128 - (sum % 128)) & 0x7F;
}

/**
 * Verify Roland checksum in a SysEx message.
 * 
 * @param message Complete SysEx message
 * @param checksumIndex Index of checksum byte (usually second-to-last)
 * @returns True if checksum is valid
 */
export function verifyRolandChecksum(message: number[], checksumIndex: number): boolean {
  // Extract data bytes (between header and checksum)
  const dataStart = 7; // After F0 41 10 00 00 00 44
  const data = message.slice(dataStart, checksumIndex);
  const expectedChecksum = calculateRolandChecksum(data);
  return message[checksumIndex] === expectedChecksum;
}

/**
 * Build a Roland SE-02 SysEx request message (RQ1).
 * 
 * @param deviceId Device ID (default 0x10)
 * @param address 4-byte address array
 * @param size Single size byte (not 4 bytes - SE-02 specific)
 * @returns Complete SysEx message ready to send
 */
export function buildSE02Request(
  deviceId: number,
  address: [number, number, number, number],
  size: number
): number[] {
  const message = [
    0xF0,           // SysEx start
    0x41,           // Roland manufacturer
    deviceId,       // Device ID
    0x00, 0x00, 0x00, 0x44, // Model ID (SE-02)
    0x11,           // RQ1 (request)
    ...address,     // Address (4 bytes)
    size,           // Size (1 byte - SE-02 specific)
  ];
  
  // Calculate and append checksum
  const checksumData = [...address, size];
  const checksum = calculateRolandChecksum(checksumData);
  message.push(checksum);
  message.push(0xF7); // SysEx end
  
  return message;
}

/**
 * Parse a Roland SE-02 SysEx response (DT1).
 * 
 * @param message Complete SysEx message
 * @returns Object with parsed data or null if invalid
 */
export function parseSE02Response(message: number[]): {
  deviceId: number;
  command: number;
  address: number[];
  data: number[];
  checksum: number;
  valid: boolean;
} | null {
  // Validate minimum length and header
  if (message.length < 12) return null;
  if (message[0] !== 0xF0) return null;
  if (message[1] !== 0x41) return null; // Roland
  if (message[2] < 0x10 || message[2] > 0x1F) return null; // Device ID range
  if (message[3] !== 0x00 || message[4] !== 0x00 || 
      message[5] !== 0x00 || message[6] !== 0x44) return null; // Model ID
  if (message[message.length - 1] !== 0xF7) return null;
  
  const deviceId = message[2];
  const command = message[7];
  const address = message.slice(8, 12);
  const checksumIndex = message.length - 2;
  const checksum = message[checksumIndex];
  const data = message.slice(12, checksumIndex);
  
  // Verify checksum
  const addressAndData = [...address, ...data];
  const valid = checksum === calculateRolandChecksum(addressAndData);
  
  return {
    deviceId,
    command,
    address: Array.from(address),
    data: Array.from(data),
    checksum,
    valid,
  };
}

/**
 * Convert preset name bytes (ASCII) to string.
 * SE-02 preset names are 16 characters, padded with zeros.
 * 
 * @param bytes Array of ASCII bytes
 * @returns Preset name string (trimmed)
 */
export function parsePresetName(bytes: number[]): string {
  return bytes
    .filter(b => b !== 0) // Remove padding zeros
    .map(b => String.fromCharCode(b))
    .join('')
    .trim();
}

/**
 * Convert preset name string to bytes (ASCII).
 * Pads to 16 bytes with zeros.
 * 
 * @param name Preset name (max 16 chars)
 * @returns Array of 16 ASCII bytes
 */
export function encodePresetName(name: string): number[] {
  const bytes = new Array(16).fill(0);
  const truncated = name.slice(0, 16);
  for (let i = 0; i < truncated.length; i++) {
    bytes[i] = truncated.charCodeAt(i) & 0x7F;
  }
  return bytes;
}
