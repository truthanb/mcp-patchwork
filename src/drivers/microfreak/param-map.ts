/**
 * MicroFreak Parameter Map
 * 
 * Maps canonical parameters to MicroFreak-specific MIDI CC numbers.
 * Reference: MicroFreak Manual v5.0.1, Appendix D: CC# Values
 */

import type { CanonicalParam } from '../../synth/types.js';

/**
 * MicroFreak CC assignments (from official manual).
 */
export const MicroFreakCC = {
  // Misc
  SPICE: 2,
  GLIDE: 5,

  // Oscillator
  OSC_TYPE: 9,
  OSC_WAVE: 10,
  OSC_TIMBRE: 12,
  OSC_SHAPE: 13,

  // Filter
  FILTER_CUTOFF: 23,
  FILTER_AMOUNT: 26,       // Filter envelope amount
  FILTER_RESONANCE: 83,

  // Amp Envelope
  AMP_ATTACK: 105,
  AMP_DECAY: 106,
  AMP_SUSTAIN: 29,

  // Cycling Envelope (used as filter/mod envelope)
  CYCLING_AMOUNT: 24,
  CYCLING_HOLD: 28,
  CYCLING_RISE: 102,
  CYCLING_FALL: 103,

  // Keyboard
  KEYBOARD_HOLD: 64,

  // Arp/Seq
  ARP_RATE_FREE: 91,
  ARP_RATE_SYNC: 92,
  
  // LFO
  LFO_RATE_FREE: 93,
  LFO_RATE_SYNC: 94,
} as const;

/**
 * Additional switch/toggle parameters.
 * These are discrete switches rather than continuous values.
 */
export const MicroFreakSwitch = {
  FILTER_TYPE: 23,      // Filter type selector (uses same CC as cutoff)
  AMP_MOD: 1,           // Amplitude modulation on/off
  PARAPHONIC: 1,        // Paraphonic mode (shares CC with mod wheel)
  OCTAVE: 1,            // Octave transpose (-3 to +3)
} as const;

/**
 * Oscillator type names in order (firmware v5.0).
 * MicroFreak has 22 oscillator types evenly distributed across CC 0-127.
 * Step size ≈6.05 (127÷21 = 6.047619...)
 * 
 * Reference: https://github.com/nanassound/midi_ctrl
 */
export const OSCILLATOR_TYPES = [
  'BasicWaves',      // 0: CC 0
  'SuperWave',       // 1: CC 6
  'Wavetable',       // 2: CC 12
  'Harmo',           // 3: CC 18
  'KarplusStr',      // 4: CC 24
  'V.Analog',        // 5: CC 30
  'Waveshaper',      // 6: CC 36
  'TwoOpFM',         // 7: CC 42
  'Formant',         // 8: CC 48
  'Chords',          // 9: CC 55
  'Speech',          // 10: CC 61
  'Modal',           // 11: CC 67
  'Noise',           // 12: CC 73
  'Bass',            // 13: CC 79
  'SawX',            // 14: CC 85
  'HarmNE',          // 15: CC 91 (Noise Engineering Harm)
  'WaveUser',        // 16: CC 97
  'Sample',          // 17: CC 103
  'ScanGrains',      // 18: CC 109
  'CloudGrains',     // 19: CC 115
  'HitGrains',       // 20: CC 121
  'Vocoder',         // 21: CC 127
] as const;

export type OscillatorType = typeof OSCILLATOR_TYPES[number];

/** Number of oscillator types */
const OSC_TYPE_COUNT = OSCILLATOR_TYPES.length; // 22

/**
 * CC values for each oscillator type.
 * Evenly distributed across 0-127 with step size ≈6.05.
 * Values from nanassound/midi_ctrl research (verified accurate).
 */
const OSC_TYPE_CC_VALUES: Record<OscillatorType, number> = {
  'BasicWaves': 0,
  'SuperWave': 6,
  'Wavetable': 12,
  'Harmo': 18,
  'KarplusStr': 24,
  'V.Analog': 30,
  'Waveshaper': 36,
  'TwoOpFM': 42,
  'Formant': 48,
  'Chords': 55,
  'Speech': 61,
  'Modal': 67,
  'Noise': 73,
  'Bass': 79,
  'SawX': 85,
  'HarmNE': 91,
  'WaveUser': 97,
  'Sample': 103,
  'ScanGrains': 109,
  'CloudGrains': 115,
  'HitGrains': 121,
  'Vocoder': 127,
};

/**
 * Get CC value for an oscillator type name.
 * Returns undefined if type not found.
 */
export function getOscillatorTypeValue(typeName: string): number | undefined {
  const normalizedInput = typeName.toLowerCase().replace(/[\s-_]/g, '');
  
  for (const [oscType, ccValue] of Object.entries(OSC_TYPE_CC_VALUES)) {
    const normalizedType = oscType.toLowerCase().replace(/[\s-_]/g, '');
    if (normalizedType === normalizedInput) {
      return ccValue;
    }
  }
  return undefined;
}

/**
 * Get oscillator type name from CC value.
 * Finds the closest matching type.
 */
export function getOscillatorTypeName(value: number): string | undefined {
  // Find the type with the closest CC value
  let closestType: string | undefined;
  let closestDistance = Infinity;
  
  for (const [oscType, ccValue] of Object.entries(OSC_TYPE_CC_VALUES)) {
    const distance = Math.abs(ccValue - value);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestType = oscType;
    }
  }
  return closestType;
}

/**
 * Map from canonical parameters to MicroFreak CC numbers.
 * Returns undefined for unsupported parameters (they will no-op).
 * 
 * Note: MicroFreak has no amp release CC, and LFO amount is via matrix routing.
 */
export const paramToCC: Partial<Record<CanonicalParam, number>> = {
  // Oscillator
  'osc.type': MicroFreakCC.OSC_TYPE,
  'osc.wave': MicroFreakCC.OSC_WAVE,
  'osc.shape': MicroFreakCC.OSC_SHAPE,

  // Filter
  'filter.cutoff': MicroFreakCC.FILTER_CUTOFF,
  'filter.resonance': MicroFreakCC.FILTER_RESONANCE,

  // Amp envelope (no release CC available)
  'env.amp.attack': MicroFreakCC.AMP_ATTACK,
  'env.amp.decay': MicroFreakCC.AMP_DECAY,
  'env.amp.sustain': MicroFreakCC.AMP_SUSTAIN,

  // Filter envelope (using cycling env)
  'env.filter.attack': MicroFreakCC.CYCLING_RISE,
  'env.filter.decay': MicroFreakCC.CYCLING_FALL,
  'env.filter.sustain': MicroFreakCC.CYCLING_HOLD,

  // LFO (using free-running rate; amount requires matrix routing)
  'lfo1.rate': MicroFreakCC.LFO_RATE_FREE,
};

/**
 * Get the CC number for a canonical parameter.
 * Returns undefined if the parameter is not supported.
 */
export function getCCForParam(param: CanonicalParam): number | undefined {
  return paramToCC[param];
}

/**
 * List of all supported canonical parameters on MicroFreak.
 */
export function getSupportedParams(): CanonicalParam[] {
  return Object.keys(paramToCC) as CanonicalParam[];
}
