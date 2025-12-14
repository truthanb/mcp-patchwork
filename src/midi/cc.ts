/**
 * MIDI CC Utilities
 * 
 * Helper functions for working with MIDI Control Change messages.
 */

import type { NormalizedValue } from '../synth/types.js';

/**
 * Convert a normalized value (0.0–1.0) to MIDI CC value (0–127).
 * Clamps input to valid range.
 */
export function normalizedToCC(value: NormalizedValue): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 127);
}

/**
 * Convert a MIDI CC value (0–127) to normalized value (0.0–1.0).
 */
export function ccToNormalized(ccValue: number): NormalizedValue {
  const clamped = Math.max(0, Math.min(127, ccValue));
  return clamped / 127;
}

/**
 * Clamp a normalized value to the 0.0–1.0 range.
 */
export function clampNormalized(value: number): NormalizedValue {
  return Math.max(0, Math.min(1, value));
}

/**
 * Apply a delta to a normalized value, clamping the result.
 * @param current Current normalized value
 * @param delta Delta to apply (-1.0 to 1.0 typical)
 */
export function applyDelta(current: NormalizedValue, delta: number): NormalizedValue {
  return clampNormalized(current + delta);
}

/**
 * Convert a signed normalized value (-1.0 to 1.0) to 14-bit NRPN value (0-16383, center at 8192).
 * Used for bipolar modulation amounts.
 */
export function normalizedToNRPN(value: number): number {
  const clamped = Math.max(-1, Math.min(1, value));
  // Map -1.0 -> 0, 0.0 -> 8192, 1.0 -> 16383
  return Math.round((clamped + 1) * 8191.5);
}

/**
 * Convert a 14-bit NRPN value (0-16383) to signed normalized value (-1.0 to 1.0).
 */
export function nrpnToNormalized(nrpnValue: number): number {
  const clamped = Math.max(0, Math.min(16383, nrpnValue));
  // Map 0 -> -1.0, 8192 -> 0.0, 16383 -> 1.0
  return (clamped / 8191.5) - 1;
}

/**
 * Build NRPN message sequence.
 * NRPN messages are sent as a sequence of CC messages:
 * 1. CC 99 (NRPN MSB) - parameter number high byte
 * 2. CC 98 (NRPN LSB) - parameter number low byte
 * 3. CC 6 (Data Entry MSB) - value high byte
 * 4. CC 38 (Data Entry LSB) - value low byte
 * 
 * @param paramNumber NRPN parameter number (0-16383)
 * @param value 14-bit value (0-16383)
 * @returns Array of [CC number, value] pairs
 */
export function buildNRPNMessage(paramNumber: number, value: number): Array<[number, number]> {
  const paramMSB = (paramNumber >> 7) & 0x7F;
  const paramLSB = paramNumber & 0x7F;
  const valueMSB = (value >> 7) & 0x7F;
  const valueLSB = value & 0x7F;

  return [
    [99, paramMSB],  // NRPN MSB
    [98, paramLSB],  // NRPN LSB
    [6, valueMSB],   // Data Entry MSB
    [38, valueLSB],  // Data Entry LSB
  ];
}

/**
 * Common MIDI CC numbers used by many synths.
 * Synth-specific mappings are in driver param-map files.
 */
export const CommonCC = {
  MOD_WHEEL: 1,
  BREATH: 2,
  FOOT: 4,
  PORTAMENTO_TIME: 5,
  VOLUME: 7,
  BALANCE: 8,
  PAN: 10,
  EXPRESSION: 11,
  SUSTAIN: 64,
  PORTAMENTO: 65,
  SOSTENUTO: 66,
  SOFT_PEDAL: 67,
  LEGATO: 68,
  HOLD_2: 69,
  // Sound controllers (often used for filter, resonance, etc.)
  SOUND_CTRL_1: 70,  // Often filter cutoff
  SOUND_CTRL_2: 71,  // Often filter resonance
  SOUND_CTRL_3: 72,  // Often amp release
  SOUND_CTRL_4: 73,  // Often amp attack
  SOUND_CTRL_5: 74,  // Often filter cutoff (alternate)
  SOUND_CTRL_6: 75,
  SOUND_CTRL_7: 76,
  SOUND_CTRL_8: 77,
  SOUND_CTRL_9: 78,
  SOUND_CTRL_10: 79,
  // All notes off, etc.
  ALL_SOUND_OFF: 120,
  RESET_ALL: 121,
  ALL_NOTES_OFF: 123,
} as const;
