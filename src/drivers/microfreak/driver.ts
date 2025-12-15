/**
 * MicroFreak Driver
 * 
 * Implements the SynthAdapter interface for Arturia MicroFreak.
 * Initial target hardware for proving the abstraction layer.
 */

import type { SynthAdapter } from '../../synth/adapter.js';
import type {
  SynthCapabilities,
  CanonicalParam,
  NormalizedValue,
  ApplyResult,
  ParamSetting,
  SynthFeature,
  FeatureResult,
} from '../../synth/types.js';
import { HardwareMidiPort, findMidiOutput } from '../../midi/hardware-port.js';
import { normalizedToCC, clampNormalized, normalizedToNRPN } from '../../midi/cc.js';
import { 
  getCCForParam, 
  MicroFreakCC,
  OSCILLATOR_TYPES,
  getOscillatorTypeValue,
  paramToCC,
  type OscillatorType,
} from './param-map.js';
import {
  MOD_SOURCES,
  MOD_DESTINATIONS,
  MOD_SOURCE_DESCRIPTIONS,
  MOD_DESTINATION_DESCRIPTIONS,
  getModMatrixNRPN,
  isValidModSource,
  isValidModDestination,
  type ModSource,
  type ModDestination,
} from './mod-matrix.js';
import { encodeSequence, type SequenceStep } from './sequence.js';
import { buildArturiaSysEx } from '../../midi/sysex.js';

/** Interface for MIDI port (hardware or virtual) */
interface MidiPort {
  open(): boolean;
  close(): void;
  sendCC(channel: number, cc: number, value: number): boolean;
  sendProgramChange(channel: number, program: number): boolean;
  sendNRPN(channel: number, paramNumber: number, value: number): boolean;
  sendSysEx?(data: number[]): boolean;
  readonly opened: boolean;
}

/** MicroFreak filter types */
const FILTER_TYPES = ['LowPass', 'BandPass', 'HighPass'] as const;

export interface MicroFreakOptions {
  id?: string;
  midiChannel?: number;
  portName?: string; // If provided, connects to hardware; otherwise auto-detects
}

export class MicroFreakDriver implements SynthAdapter {
  readonly id: string;
  readonly name = 'Arturia MicroFreak';
  readonly driverType = 'microfreak';
  
  private midiPort: MidiPort | null = null;
  private midiChannel: number;
  private portName: string | null;
  private currentParams: Map<CanonicalParam, NormalizedValue> = new Map();
  private currentOscType: string = OSCILLATOR_TYPES[0];

  constructor(options: MicroFreakOptions = {}) {
    this.id = options.id ?? 'microfreak-1';
    this.midiChannel = options.midiChannel ?? 0; // 0-indexed, so channel 1
    this.portName = options.portName ?? null;
  }

  /** Initialize the driver and open MIDI port */
  async initialize(): Promise<boolean> {
    // Auto-detect MicroFreak if no port specified
    console.warn('[MicroFreak] Searching for MIDI port...');
    const targetPort = this.portName ?? findMidiOutput('microfreak') ?? findMidiOutput('arturia');
    
    if (!targetPort) {
      console.warn('[MicroFreak] ERROR: No MIDI port found. Is MicroFreak connected?');
      console.warn('[MicroFreak] Looking for ports matching "microfreak" or "arturia"');
      return false;
    }

    console.warn(`[MicroFreak] Found MIDI port: ${targetPort}`);
    this.midiPort = new HardwareMidiPort(targetPort);
    const opened = this.midiPort.open();
    console.warn(`[MicroFreak] Port open: ${opened}`);
    return opened;
  }

  getCapabilities(): SynthCapabilities {
    return {
      name: 'MicroFreak',
      manufacturer: 'Arturia',
      oscillatorTypes: [...OSCILLATOR_TYPES],
      filterTypes: [...FILTER_TYPES],
      envelopes: ['amp', 'filter'], // Cycling envelope used as filter env
      lfoCount: 1,
      polyphony: 4, // Paraphonic
      fxAvailable: false, // No onboard FX
      supportsPresetDump: true, // TODO: Implement SysEx
      supportsPresetLoad: true,
      features: this.getFeatures(),
    };
  }

  getFeatures(): SynthFeature[] {
    return [
      {
        name: 'oscillatorType',
        description: 'Digital oscillator model (20 types from wavetable to Karplus-Strong)',
        values: [...OSCILLATOR_TYPES],
        currentValue: this.currentOscType,
      },
      {
        name: 'filterType',
        description: 'Multi-mode analog filter type',
        values: [...FILTER_TYPES],
      },
    ];
  }

  async setFeature(feature: string, value: string): Promise<FeatureResult> {
    switch (feature) {
      case 'oscillatorType': {
        const success = await this.setOscillatorType(value);
        if (success) {
          this.currentOscType = value;
          return {
            success: true,
            feature,
            value,
            message: `Oscillator set to ${value}`,
          };
        }
        return {
          success: false,
          feature,
          value,
          message: `Invalid oscillator type: ${value}. Valid types: ${OSCILLATOR_TYPES.join(', ')}`,
        };
      }
      
      case 'filterType': {
        // Filter type is controlled via filter.type canonical param
        const typeIndex = FILTER_TYPES.indexOf(value as typeof FILTER_TYPES[number]);
        if (typeIndex === -1) {
          return {
            success: false,
            feature,
            value,
            message: `Invalid filter type: ${value}. Valid types: ${FILTER_TYPES.join(', ')}`,
          };
        }
        // Map to normalized value (0, 0.5, 1 for 3 types)
        const normalized = typeIndex / (FILTER_TYPES.length - 1);
        const success = await this.setParam('filter.type', normalized);
        return {
          success,
          feature,
          value,
          message: success ? `Filter set to ${value}` : 'Failed to set filter type',
        };
      }
      
      default:
        return {
          success: false,
          feature,
          value,
          message: `Unknown feature: ${feature}. Available: oscillatorType, filterType`,
        };
    }
  }

  /**
   * Send a raw CC value (0-127) to the synth.
   * Used for synth-specific resets that aren't in canonical params.
   */
  private sendRawCC(cc: number, value: number): boolean {
    if (!this.midiPort) return false;
    return this.midiPort.sendCC(this.midiChannel, cc, value);
  }

  /**
   * Reset synth to init state - zeros out everything.
   * This clears mod matrix routing, arp, and all modulation.
   */
  async resetToInit(): Promise<void> {
    if (!this.midiPort) return;

    // Zero out modulation sources (kills mod matrix)
    this.sendRawCC(MicroFreakCC.CYCLING_AMOUNT, 0);  // Cycling env amount
    this.sendRawCC(MicroFreakCC.FILTER_AMOUNT, 64);  // Filter env amount (center)
    
    // Reset misc
    this.sendRawCC(MicroFreakCC.SPICE, 0);
    this.sendRawCC(MicroFreakCC.GLIDE, 0);
    
    // LFO rate slow, but not affecting anything
    this.sendRawCC(MicroFreakCC.LFO_RATE_FREE, 30);
    
    // Cycling envelope - neutral
    this.sendRawCC(MicroFreakCC.CYCLING_RISE, 40);
    this.sendRawCC(MicroFreakCC.CYCLING_FALL, 40);
    this.sendRawCC(MicroFreakCC.CYCLING_HOLD, 0);
    
    // Clear current params tracking
    this.currentParams.clear();
  }

  async setParam(param: CanonicalParam, value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) {
      return false;
    }

    const cc = getCCForParam(param);
    if (cc === undefined) {
      // Unsupported param - graceful no-op
      return false;
    }

    const clampedValue = clampNormalized(value);
    const ccValue = normalizedToCC(clampedValue);
    
    const sent = this.midiPort.sendCC(this.midiChannel, cc, ccValue);
    if (sent) {
      this.currentParams.set(param, clampedValue);
    }
    return sent;
  }

  async setParams(settings: ParamSetting[]): Promise<ApplyResult> {
    const applied: ParamSetting[] = [];
    const skipped: CanonicalParam[] = [];

    for (const setting of settings) {
      const success = await this.setParam(setting.param, setting.value);
      if (success) {
        applied.push(setting);
      } else {
        skipped.push(setting.param);
      }
    }

    return {
      success: applied.length > 0,
      appliedParams: applied,
      skippedParams: skipped,
      message: `Applied ${applied.length}/${settings.length} parameters`,
    };
  }

  /**
   * Set the oscillator type by name.
   * @param typeName One of the supported oscillator type names
   */
  async setOscillatorType(typeName: string): Promise<boolean> {
    if (!this.midiPort) {
      return false;
    }

    const value = getOscillatorTypeValue(typeName);
    if (value === undefined) {
      console.warn(`[MicroFreak] Unknown oscillator type: ${typeName}`);
      console.warn(`[MicroFreak] Available types: ${OSCILLATOR_TYPES.join(', ')}`);
      return false;
    }

    return this.midiPort.sendCC(this.midiChannel, MicroFreakCC.OSC_TYPE, value);
  }

  /**
   * Get list of available oscillator types.
   */
  getOscillatorTypes(): string[] {
    return [...OSCILLATOR_TYPES];
  }

  /**
   * Get modulation matrix capabilities.
   */
  getModMatrixCapabilities(): import('../../synth/types.js').ModMatrixCapabilities {
    return {
      sources: [...MOD_SOURCES],
      destinations: [...MOD_DESTINATIONS],
      sourceDescriptions: { ...MOD_SOURCE_DESCRIPTIONS },
      destinationDescriptions: { ...MOD_DESTINATION_DESCRIPTIONS },
    };
  }

  /**
   * Set a modulation amount in the mod matrix.
   * Uses NRPN messages to control modulation routing.
   */
  async setModulation(
    source: string,
    destination: string,
    amount: number
  ): Promise<import('../../synth/types.js').ModulationResult> {
    if (!this.midiPort) {
      return {
        success: false,
        message: 'MIDI port not open',
      };
    }

    // Validate source and destination
    if (!isValidModSource(source)) {
      return {
        success: false,
        message: `Invalid mod source: ${source}. Valid sources: ${MOD_SOURCES.join(', ')}`,
      };
    }

    if (!isValidModDestination(destination)) {
      return {
        success: false,
        message: `Invalid mod destination: ${destination}. Valid destinations: ${MOD_DESTINATIONS.join(', ')}`,
      };
    }

    // Clamp amount to -1.0 to 1.0
    const clampedAmount = Math.max(-1, Math.min(1, amount));

    // Convert to 14-bit NRPN value (0-16383, center at 8192)
    const nrpnValue = normalizedToNRPN(clampedAmount);

    // Get NRPN parameter number for this routing
    const nrpnParam = getModMatrixNRPN(source as ModSource, destination as ModDestination);

    // Send NRPN message
    const success = this.midiPort.sendNRPN(this.midiChannel, nrpnParam, nrpnValue);

    if (success) {
      const percentage = Math.round(clampedAmount * 100);
      return {
        success: true,
        message: `Set ${source} -> ${destination} modulation to ${percentage}%`,
      };
    } else {
      return {
        success: false,
        message: 'Failed to send NRPN message',
      };
    }
  }

  // TODO: Implement SysEx preset dump/load
  async loadPreset(slot: number): Promise<boolean> {
    if (!this.midiPort) {
      return false;
    }
    // Program Change to select preset
    return this.midiPort.sendProgramChange(this.midiChannel, slot & 0x7f);
  }

  getParamDescriptions(): import('../../synth/types.js').ParamDescription[] {
    const descriptions: Record<CanonicalParam, { description: string; range: string; effect: string }> = {
      'osc.type': {
        description: 'Oscillator algorithm/type',
        range: '0.0-1.0 selects from available types',
        effect: 'Changes the fundamental character of the sound',
      },
      'osc.mix': {
        description: 'Mix between oscillator 1 and 2',
        range: '0.0-1.0 (0=osc1, 1=osc2)',
        effect: 'Blends between two oscillator sources',
      },
      'osc.wave': {
        description: 'Waveform or wavetable position',
        range: '0.0-1.0',
        effect: 'Changes timbre/harmonic content',
      },
      'osc.shape': {
        description: 'Wave shape/timbre modifier',
        range: '0.0-1.0',
        effect: 'Morphs the waveform, often adds harmonics',
      },
      'filter.cutoff': {
        description: 'Filter cutoff frequency',
        range: '0.0-1.0 (low to high)',
        effect: 'Low values = darker/muffled, high = brighter/open',
      },
      'filter.resonance': {
        description: 'Filter resonance/emphasis',
        range: '0.0-1.0',
        effect: 'Adds peak at cutoff, can self-oscillate at high values',
      },
      'filter.type': {
        description: 'Filter type (LP, HP, BP)',
        range: 'Depends on synth',
        effect: 'Changes which frequencies are removed',
      },
      'env.amp.attack': {
        description: 'Amplitude envelope attack time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'How quickly sound reaches full volume. Fast=punchy, slow=pads',
      },
      'env.amp.decay': {
        description: 'Amplitude envelope decay time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'Time to fall from peak to sustain level',
      },
      'env.amp.sustain': {
        description: 'Amplitude envelope sustain level',
        range: '0.0-1.0',
        effect: 'Volume held while key is pressed',
      },
      'env.amp.release': {
        description: 'Amplitude envelope release time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'Tail after key release. Long=ambient, short=staccato',
      },
      'env.filter.attack': {
        description: 'Filter envelope attack time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'How quickly filter opens on note start',
      },
      'env.filter.decay': {
        description: 'Filter envelope decay time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'How quickly filter closes after peak',
      },
      'env.filter.sustain': {
        description: 'Filter envelope sustain level',
        range: '0.0-1.0',
        effect: 'Filter position held while key is pressed',
      },
      'env.filter.release': {
        description: 'Filter envelope release time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'Filter behavior after key release',
      },
      'lfo1.rate': {
        description: 'LFO 1 speed/rate',
        range: '0.0-1.0 (slow to fast)',
        effect: 'Speed of modulation. Slow=gentle movement, fast=vibrato/tremolo',
      },
      'lfo1.amount': {
        description: 'LFO 1 modulation depth',
        range: '0.0-1.0',
        effect: 'How much the LFO affects its target',
      },
      'lfo2.rate': {
        description: 'LFO 2 speed/rate',
        range: '0.0-1.0 (slow to fast)',
        effect: 'Second LFO for additional modulation',
      },
      'lfo2.amount': {
        description: 'LFO 2 modulation depth',
        range: '0.0-1.0',
        effect: 'Depth of second LFO',
      },
      'fx.mix': {
        description: 'Effects wet/dry mix',
        range: '0.0-1.0 (dry to wet)',
        effect: 'How much effect is blended in',
      },
      'fx.param1': {
        description: 'Effects parameter 1',
        range: '0.0-1.0',
        effect: 'Primary effect control (varies by effect type)',
      },
      'fx.param2': {
        description: 'Effects parameter 2',
        range: '0.0-1.0',
        effect: 'Secondary effect control (varies by effect type)',
      },
    };

    // Check which parameters are supported by MicroFreak
    const supported = new Set(Object.keys(paramToCC));

    return Object.entries(descriptions).map(([name, desc]) => ({
      name: name as CanonicalParam,
      ...desc,
      supported: supported.has(name),
    }));
  }

  getSoundDesignTips(): string[] {
    return [
      'For bass: Use SuperWave or Bass oscillator, low filter cutoff (0.2-0.4), medium resonance, fast attack, medium decay',
      'For pads: Use longer attack (0.4-0.7), high sustain, long release. Lower resonance for smoothness',
      'For leads: Bright filter (0.6-0.8), medium attack, use the oscillatorType feature for tonal color',
      'For plucks: Fast attack (0.0-0.1), short decay (0.2-0.4), low sustain. Add resonance for character',
      'Resonance at 0.5-0.7 adds character. Above 0.8 becomes aggressive/screaming',
      'Filter envelope: Fast attack + medium decay creates classic "wah" pluck. Slow attack creates swells',
      'LFO rate 0.1-0.3 for gentle movement, 0.5-0.7 for wobble, 0.8+ for tremolo/vibrato effects',
      'Start with init tool to reset, then adjust one parameter at a time to understand its effect',
      'Keyboard hold (CC 64) sustains notes, useful for pads and drones',
      'Arp rate (CC 91/92) controls arpeggiator speed - experiment with free vs synced timing',
    ];
  }

  getHardwareFeatures(): string[] {
    return [
      'Arpeggiator: Enable/disable and set rate using set_synth_feature or direct CC control',
      'Paraphonic mode: 4-voice paraphonic (shared filter) vs monophonic',
      'Keyboard hold: CC 64 acts as sustain pedal',
      'Filter types: LPF (low-pass), BPF (band-pass), HPF (high-pass) available',
      'Octave transpose: -3 to +3 octaves for pitch shifting',
    ];
  }

  /**
   * Get documentation resources specific to MicroFreak.
   * These will be exposed as MCP resources for LLM context.
   */
  getDocumentationResources(): Array<{
    name: string;
    description: string;
    path: string;
  }> {
    return [
      {
        name: 'MIDI Reference',
        description: 'Complete MIDI CC and NRPN reference for Arturia MicroFreak including oscillator mappings, mod matrix, and usage examples',
        path: '../../docs/microfreak-midi-reference.md',
      },
      {
        name: 'Preset Workflow',
        description: 'Guide for reading presets from hardware, scanning slots, finding empty slots, and building new sounds',
        path: '../../docs/preset-workflow.md',
      },
    ];
  }

  /**
   * Write a sequence directly to the MicroFreak via SysEx.
   * First loads preset 1 to establish edit buffer, then overwrites sequence chunks.
   */
  async writeSequence(steps: SequenceStep[]): Promise<void> {
    if (!this.midiPort?.sendSysEx) {
      throw new Error('MIDI port does not support SysEx');
    }

    // Step 1: Load preset 1 via Program Change to get it into edit buffer
    console.warn('Loading preset 1 into edit buffer...');
    this.midiPort.sendProgramChange(this.midiChannel, 0); // Preset 1 (0-indexed)
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait for preset to load

    // Step 2: Encode the new sequence
    const sequenceChunks = encodeSequence(steps, steps.length);
    
    // Step 3: Send ONLY the sequence chunks (chunks 70-145 of the preset)
    // sequenceChunks[30-93] map to preset chunks 70-133 (the 64 sequence steps)
    console.warn('Overwriting sequence data...');
    
    for (let i = 30; i < 94; i++) {  // Only send the actual sequence steps
      const presetChunkNumber = 70 + (i - 30); // Map to preset chunks 70-133
      const chunk = sequenceChunks[i];
      
      const sysex = buildArturiaSysEx([
        0x01,
        presetChunkNumber,
        0x01,
        0x16,      // Try 0x16 (the other response code)
        ...chunk
      ]);
      
      this.midiPort.sendSysEx(sysex);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.warn('Sequence chunks sent to edit buffer.');
  }

  isConnected(): boolean {
    // Check if MIDI port is still available
    const portAvailable = findMidiOutput('microfreak') || findMidiOutput('arturia');
    return !!portAvailable && this.midiPort?.opened === true;
  }

  async disconnect(): Promise<void> {
    if (this.midiPort) {
      this.midiPort.close();
    }
    this.currentParams.clear();
  }
}

/**
 * Detect if a MicroFreak is connected by scanning MIDI ports.
 */
export function detectMicroFreak(): boolean {
  return !!(findMidiOutput('microfreak') ?? findMidiOutput('arturia'));
}

/**
 * Create and initialize a MicroFreak driver instance.
 */
export async function createMicroFreakDriver(
  options?: MicroFreakOptions,
): Promise<MicroFreakDriver | null> {
  const driver = new MicroFreakDriver(options);
  const initialized = await driver.initialize();
  if (!initialized) {
    return null;
  }
  return driver;
}
