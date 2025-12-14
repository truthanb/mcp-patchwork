/**
 * MicroFreak Modulation Matrix
 * 
 * The mod matrix allows routing 5 modulation sources to 7 destinations.
 * Control via NRPN messages (14-bit parameters).
 */

/**
 * Modulation sources available on MicroFreak.
 */
export const MOD_SOURCES = [
  'CyclingEnv',
  'Envelope',
  'LFO',
  'Pressure',
  'Keyboard',
] as const;

export type ModSource = typeof MOD_SOURCES[number];

/**
 * Modulation destinations in the mod matrix.
 */
export const MOD_DESTINATIONS = [
  'Pitch',
  'Wave',
  'Timbre',
  'Cutoff',
  'Assign1',
  'Assign2',
  'Assign3',
] as const;

export type ModDestination = typeof MOD_DESTINATIONS[number];

/**
 * NRPN parameter numbers for mod matrix control.
 * Based on MicroFreak MIDI implementation.
 * 
 * Format: NRPN address for [source][destination]
 * Values are 14-bit signed: 0 = -100%, 8192 = 0%, 16383 = +100%
 */
export const MOD_MATRIX_NRPN: Record<ModSource, Record<ModDestination, number>> = {
  CyclingEnv: {
    Pitch: 260,
    Wave: 261,
    Timbre: 262,
    Cutoff: 263,
    Assign1: 392,
    Assign2: 393,
    Assign3: 394,
  },
  Envelope: {
    Pitch: 264,
    Wave: 265,
    Timbre: 266,
    Cutoff: 267,
    Assign1: 395,
    Assign2: 396,
    Assign3: 397,
  },
  LFO: {
    Pitch: 268,
    Wave: 269,
    Timbre: 270,
    Cutoff: 271,
    Assign1: 398,
    Assign2: 399,
    Assign3: 400,
  },
  Pressure: {
    Pitch: 272,
    Wave: 273,
    Timbre: 274,
    Cutoff: 275,
    Assign1: 401,
    Assign2: 402,
    Assign3: 403,
  },
  Keyboard: {
    Pitch: 276,
    Wave: 277,
    Timbre: 278,
    Cutoff: 279,
    Assign1: 404,
    Assign2: 405,
    Assign3: 406,
  },
};

/**
 * Get NRPN parameter number for a mod matrix slot.
 */
export function getModMatrixNRPN(source: ModSource, destination: ModDestination): number {
  return MOD_MATRIX_NRPN[source][destination];
}

/**
 * Validate mod source name.
 */
export function isValidModSource(source: string): source is ModSource {
  return MOD_SOURCES.includes(source as ModSource);
}

/**
 * Validate mod destination name.
 */
export function isValidModDestination(dest: string): dest is ModDestination {
  return MOD_DESTINATIONS.includes(dest as ModDestination);
}

/**
 * Human-readable descriptions for mod sources.
 */
export const MOD_SOURCE_DESCRIPTIONS: Record<ModSource, string> = {
  CyclingEnv: 'Cycling envelope (loopable modulation envelope)',
  Envelope: 'Main ADSR envelope',
  LFO: 'Low frequency oscillator',
  Pressure: 'Aftertouch/pressure from keyboard',
  Keyboard: 'Keyboard tracking or arpeggiator',
};

/**
 * Human-readable descriptions for mod destinations.
 */
export const MOD_DESTINATION_DESCRIPTIONS: Record<ModDestination, string> = {
  Pitch: 'Oscillator pitch (vibrato, pitch bend effects)',
  Wave: 'Oscillator wave parameter',
  Timbre: 'Oscillator timbre/color',
  Cutoff: 'Filter cutoff frequency',
  Assign1: 'Assignable destination 1',
  Assign2: 'Assignable destination 2',
  Assign3: 'Assignable destination 3',
};
