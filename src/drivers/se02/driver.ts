/**
 * Roland SE-02 Driver
 * 
 * Implements the SynthAdapter interface for Roland SE-02.
 * Boutique analog monosynth with 3 oscillators and SH-101 heritage.
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
import { normalizedToCC, clampNormalized } from '../../midi/cc.js';
import { buildSE02Request, parseSE02Response, parsePresetName } from '../../midi/roland-sysex.js';

/** Interface for MIDI port (hardware or virtual) */
interface MidiPort {
  open(): boolean;
  close(): void;
  sendCC(channel: number, cc: number, value: number): boolean;
  sendProgramChange(channel: number, program: number): boolean;
  readonly opened: boolean;
}

export interface SE02Options {
  id?: string;
  midiChannel?: number; // 0-indexed
  portName?: string;
}

/**
 * Roland SE-02 MIDI CC Map
 * From SE-02 MIDI Implementation Chart (Roland, Ver 1.00, Jul 19 2017)
 */
export const SE02CC = {
  // Control
  CONTROL_GLIDE: 5,              // Portamento/glide time
  CONTROL_GLIDE_TYPE: 9,         // Glide type/mode
  CONTROL_WHEEL: 13,             // Control wheel
  
  // Cross Modulation
  XMOD_O2FLT: 16,                // Cross mod OSC2 to filter
  XMOD_O3TO: 17,                 // Cross mod OSC3 to...
  XMOD_O3PW: 18,                 // Cross mod OSC3 pulse width
  XMOD_TO_MW: 31,                // Cross mod to mod wheel
  
  // Oscillators
  OSC1_RANGE: 22,                // OSC1 octave range
  OSC1_WAVEFORM: 24,             // OSC1 waveform
  OSC1_FINE: 27,                 // OSC1 fine tune
  OSC1_ENV: 29,                  // OSC1 envelope amount
  OSC1_KYBD: 30,                 // OSC1 keyboard tracking
  
  OSC2_RANGE: 19,                // OSC2 octave range
  OSC2_WAVEFORM: 20,             // OSC2 waveform
  OSC2_FINE: 28,                 // OSC2 fine tune
  
  OSC3_RANGE: 25,                // OSC3 octave range
  OSC3_WAVEFORM: 26,             // OSC3 waveform
  
  OSC_SYNC: 21,                  // Oscillator sync
  
  // Mixer
  MIX_OSC1: 48,                  // OSC1 level
  MIX_OSC2: 49,                  // OSC2 level
  MIX_OSC3: 50,                  // OSC3 level
  MIX_NOISE: 41,                 // Noise level
  MIX_FEEDBACK: 51,              // Feedback amount
  
  // Filter
  FILTER_CUTOFF: 71,             // Filter cutoff frequency
  FILTER_RESONANCE: 74,          // Filter resonance/emphasis
  FILTER_ATTACK_1: 47,           // ENV1 (FILTER) attack
  FILTER_DECAY_1: 52,            // ENV1 (FILTER) decay
  FILTER_SUSTAIN_1: 53,          // ENV1 (FILTER) sustain
  FILTER_ATTACK_2: 73,           // ENV2 (AMP) attack
  FILTER_DECAY_2: 75,            // ENV2 (AMP) decay
  FILTER_SUSTAIN_2: 56,          // ENV2 (AMP) sustain
  FILTER_RELEASE: 62,            // ENV2 (AMP) release (shared with ENV1 via [REL] switch)
  FILTER_KEY_TRACK_13: 57,       // Filter keyboard tracking 1-3
  FILTER_KEY_TRACK_23: 58,       // Filter keyboard tracking 2-3
  FILTER_VCO: 59,                // Filter VCO modulation
  FILTER_MTRIG: 60,              // Filter multi-trigger
  FILTER_NORM_INVERT: 61,        // Filter normal/invert
  FILTER_GATE_LFO: 63,           // Filter gate/LFO
  
  // LFO
  LFO_RATE: 102,                 // LFO rate/speed
  LFO_OSC: 103,                  // LFO oscillator amount
  LFO_WAVE: 104,                 // LFO waveform
  LFO_FILTER: 105,               // LFO filter amount
  LFO_MWHL_OSC_SW: 106,          // LFO mod wheel OSC switch
  LFO_MWHL_FLT_SW: 107,          // LFO mod wheel filter switch
  LFO_MODE_SW: 108,              // LFO mode switch
  LFO_SYNC_SW: 109,              // LFO sync switch
  
  // Delay
  DELAY_TIME: 82,                // Delay time
  DELAY_REGEN: 83,               // Delay regeneration/feedback
  DELAY_AMOUNT: 91,              // Delay wet/dry mix
  
  // Performance
  MOD_SENS: 80,                  // Modulation sensitivity
  DYNAMICS: 81,                  // Dynamics/velocity sensitivity
  AFT_SENS_1: 84,                // Aftertouch sensitivity 1
  AFT_SENS_2: 85,                // Aftertouch sensitivity 2
  BEND_RANGE: 87,                // Pitch bend range
  
  // Global
  OCTAVE_SHIFT: 112,             // Octave shift
  TRANSPOSE: 113,                // Transpose
  TRANSPOSE_SW: 114,             // Transpose switch
  PATCH_VOLUME: 115,             // Patch volume
} as const;

export class SE02Driver implements SynthAdapter {
  readonly id: string;
  readonly name = 'Roland SE-02';
  readonly driverType = 'se02';
  
  private midiPort: MidiPort | null = null;
  private midiChannel: number;
  private portName: string | null;
  private currentParams: Map<CanonicalParam, NormalizedValue> = new Map();

  constructor(options: SE02Options = {}) {
    this.id = options.id ?? 'se02-1';
    this.midiChannel = options.midiChannel ?? 0; // 0-indexed, so channel 1
    this.portName = options.portName ?? null;
  }

  /** Initialize the driver and open MIDI port */
  async initialize(): Promise<boolean> {
    const targetPort = this.portName ?? 
      findMidiOutput('se-02') ?? 
      findMidiOutput('se02') ??
      findMidiOutput('roland');
    
    if (!targetPort) {
      return false;
    }

    this.midiPort = new HardwareMidiPort(targetPort);
    const opened = this.midiPort.open();
    return opened;
  }

  getCapabilities(): SynthCapabilities {
    return {
      name: 'SE-02',
      manufacturer: 'Roland',
      oscillatorTypes: ['Sawtooth', 'Triangle', 'Square', 'Pulse', 'Noise'],
      filterTypes: ['LowPass'],
      envelopes: ['amp', 'filter'], // Two separate envelopes: FILTER (ENV1) and AMP (ENV2)
      lfoCount: 1,
      polyphony: 1, // Monophonic
      fxAvailable: true, // Has delay
      supportsPresetDump: false,  // SysEx implemented but requires 5-pin DIN MIDI (not USB)
      supportsPresetLoad: true,
      presetSlotCount: 128,
      features: this.getFeatures(),
      parameterMap: this.getParameterMap(),
      controllerMap: this.getControllerMap(),
    };
  }

  /** Get comprehensive parameter map with descriptions */
  private getParameterMap(): Record<string, { cc: number; description: string }> {
    return {
      // Oscillator Parameters
      'osc1.level': { cc: SE02CC.MIX_OSC1, description: 'Oscillator 1 level (mixer)' },
      'osc2.level': { cc: SE02CC.MIX_OSC2, description: 'Oscillator 2 level (mixer)' },
      'osc3.level': { cc: SE02CC.MIX_OSC3, description: 'Oscillator 3 level (mixer)' },
      'osc1.waveform': { cc: SE02CC.OSC1_WAVEFORM, description: 'OSC1 waveform: 0=Saw, 1=Tri, 2=Sq, 3=Pulse, 4=Noise' },
      'osc2.waveform': { cc: SE02CC.OSC2_WAVEFORM, description: 'OSC2 waveform: 0=Saw, 1=Tri, 2=Sq, 3=Pulse, 4=Noise' },
      'osc3.waveform': { cc: SE02CC.OSC3_WAVEFORM, description: 'OSC3 waveform: 0=Saw, 1=Tri, 2=Sq, 3=Pulse, 4=Noise' },
      'osc1.fine': { cc: SE02CC.OSC1_FINE, description: 'OSC1 fine tune (±50 cents)' },
      'osc2.fine': { cc: SE02CC.OSC2_FINE, description: 'OSC2 fine tune (±50 cents)' },
      'osc1.range': { cc: SE02CC.OSC1_RANGE, description: 'OSC1 octave range (16\'-2\')' },
      'osc2.range': { cc: SE02CC.OSC2_RANGE, description: 'OSC2 octave range (16\'-2\')' },
      'osc3.range': { cc: SE02CC.OSC3_RANGE, description: 'OSC3 octave range (16\'-2\')' },
      'osc.sync': { cc: SE02CC.OSC_SYNC, description: 'Oscillator sync (OSC1→OSC2)' },
      
      // Filter Parameters
      'filter.cutoff': { cc: SE02CC.FILTER_CUTOFF, description: 'Filter cutoff frequency' },
      'filter.resonance': { cc: SE02CC.FILTER_RESONANCE, description: 'Filter resonance/emphasis' },
      'filter.vco': { cc: SE02CC.FILTER_VCO, description: 'Filter VCO envelope modulation amount' },
      'filter.kybd': { cc: SE02CC.FILTER_KEY_TRACK_13, description: 'Filter keyboard tracking' },
      
      // Envelopes (ENV1 = Filter, ENV2 = Amp)
      'env.filter.attack': { cc: SE02CC.FILTER_ATTACK_1, description: 'ENV1 (Filter) attack time' },
      'env.filter.decay': { cc: SE02CC.FILTER_DECAY_1, description: 'ENV1 (Filter) decay time' },
      'env.filter.sustain': { cc: SE02CC.FILTER_SUSTAIN_1, description: 'ENV1 (Filter) sustain level' },
      'env.amp.attack': { cc: SE02CC.FILTER_ATTACK_2, description: 'ENV2 (Amp) attack time' },
      'env.amp.decay': { cc: SE02CC.FILTER_DECAY_2, description: 'ENV2 (Amp) decay time' },
      'env.amp.sustain': { cc: SE02CC.FILTER_SUSTAIN_2, description: 'ENV2 (Amp) sustain level' },
      'env.amp.release': { cc: SE02CC.FILTER_RELEASE, description: 'ENV2 (Amp) release time (shared with ENV1)' },
      
      // LFO Parameters
      'lfo1.rate': { cc: SE02CC.LFO_RATE, description: 'LFO rate/speed' },
      'lfo.osc': { cc: SE02CC.LFO_OSC, description: 'LFO oscillator modulation amount' },
      'lfo.filter': { cc: SE02CC.LFO_FILTER, description: 'LFO filter modulation amount' },
      'lfo.waveform': { cc: SE02CC.LFO_WAVE, description: 'LFO waveform: 0=S&H, 1=Sin, 2=Tri, 3=Saw, 4=RevSaw, 5-7=Sq1-3, 8=Rnd' },
      'lfo.mode': { cc: SE02CC.LFO_MODE_SW, description: 'LFO mode (normal/keyboard sync)' },
      
      // Cross Modulation
      'xmod.o2filter': { cc: SE02CC.XMOD_O2FLT, description: 'Cross mod: OSC2 to filter' },
      'xmod.o3to': { cc: SE02CC.XMOD_O3TO, description: 'Cross mod: OSC3 to OSC2' },
      'xmod.o3pw': { cc: SE02CC.XMOD_O3PW, description: 'Cross mod: OSC3 to pulse width' },
      'xmod.to_mw': { cc: SE02CC.XMOD_TO_MW, description: 'Cross mod to mod wheel routing' },
      
      // Effects
      'fx.delay.time': { cc: SE02CC.DELAY_TIME, description: 'Delay time' },
      'fx.delay.feedback': { cc: SE02CC.DELAY_REGEN, description: 'Delay regeneration/feedback' },
      'fx.delay.mix': { cc: SE02CC.DELAY_AMOUNT, description: 'Delay wet/dry mix' },
      
      // Mixer
      'mix.noise': { cc: SE02CC.MIX_NOISE, description: 'Noise level (white noise)' },
      'mix.feedback': { cc: SE02CC.MIX_FEEDBACK, description: 'Feedback amount' },
      
      // Control
      'control.glide': { cc: SE02CC.CONTROL_GLIDE, description: 'Portamento/glide time' },
      'control.glide_type': { cc: SE02CC.CONTROL_GLIDE_TYPE, description: 'Glide type/mode' },
      'control.wheel': { cc: SE02CC.CONTROL_WHEEL, description: 'Control wheel value' },
      
      // Performance
      'patch.volume': { cc: SE02CC.PATCH_VOLUME, description: 'Patch output volume' },
      'dynamics': { cc: SE02CC.DYNAMICS, description: 'Velocity sensitivity' },
      'bend.range': { cc: SE02CC.BEND_RANGE, description: 'Pitch bend range (semitones)' },
      'octave.shift': { cc: SE02CC.OCTAVE_SHIFT, description: 'Global octave shift' },
      'transpose': { cc: SE02CC.TRANSPOSE, description: 'Transposition amount' },
    };
  }

  /** Get additional SE-02 specific controls */
  private getControllerMap(): Record<string, string> {
    return {
      'Oscillators': '3 analog oscillators with cross modulation',
      'Filter': 'Classic 24dB/oct low-pass filter with resonance',
      'Envelopes': 'ENV1 (Filter: Attack/Decay/Sustain) + ENV2 (Amp: Attack/Decay/Sustain/Release)',
      'LFO': '9 waveforms with delay and key sync modes',
      'Cross Mod': 'OSC2→Filter, OSC3→OSC2, OSC3→Pulse Width',
      'Effects': 'Analog delay with time, feedback, and mix',
      'Sequencer': '16-step sequencer (not MIDI controllable)',
      'Keyboard': 'Transpose, octave shift, glide with type selection',
      'Arpeggiator': 'Built-in arpeggiator (not MIDI controllable)',
    };
  }

  getFeatures(): SynthFeature[] {
    return [
      {
        name: 'osc1Waveform',
        description: 'Oscillator 1 waveform selection',
        values: ['Sawtooth', 'Triangle', 'Square', 'Pulse', 'Noise'],
      },
      {
        name: 'osc2Waveform',
        description: 'Oscillator 2 waveform selection',
        values: ['Sawtooth', 'Triangle', 'Square', 'Pulse', 'Noise'],
      },
      {
        name: 'osc3Waveform',
        description: 'Oscillator 3 waveform selection',
        values: ['Sawtooth', 'Triangle', 'Square', 'Pulse', 'Noise'],
      },
      {
        name: 'lfoWaveform',
        description: 'LFO waveform selection',
        values: ['Sample & Hold', 'Sine', 'Triangle', 'Sawtooth', 'Reverse Sawtooth', 'Square 1', 'Square 2', 'Square 3', 'Random'],
      },
    ];
  }

  async setFeature(feature: string, value: string): Promise<FeatureResult> {
    // Feature implementation can be added later
    return {
      success: false,
      feature,
      value,
      message: `Feature ${feature} not yet implemented`,
    };
  }

  async setParam(param: CanonicalParam | string, value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) {
      return false;
    }

    const clamped = clampNormalized(value);
    
    // First try parameterMap (synth-specific params)
    const paramMap = this.getParameterMap();
    if (paramMap[param]) {
      const cc = paramMap[param].cc;
      const ccValue = normalizedToCC(clamped);
      const success = this.midiPort.sendCC(this.midiChannel, cc, ccValue);
      if (success) {
        this.currentParams.set(param as CanonicalParam, clamped);
      }
      return success;
    }
    
    // Fall back to canonical params
    const cc = this.getCC(param as CanonicalParam);
    
    if (cc === undefined) {
      return false; // Param not supported
    }

    const ccValue = normalizedToCC(clamped);
    const success = this.midiPort.sendCC(this.midiChannel, cc, ccValue);
    
    if (success) {
      this.currentParams.set(param as CanonicalParam, clamped);
    }
    
    return success;
  }

  async setParams(settings: ParamSetting[]): Promise<ApplyResult> {
    const appliedParams: ParamSetting[] = [];
    const skippedParams: CanonicalParam[] = [];

    for (const setting of settings) {
      const ok = await this.setParam(setting.param, setting.value);
      if (ok) {
        appliedParams.push(setting);
      } else {
        skippedParams.push(setting.param);
      }
    }

    return {
      success: appliedParams.length > 0,
      appliedParams,
      skippedParams,
      message: `Applied ${appliedParams.length}/${settings.length} parameters`,
    };
  }

  async resetToInit(): Promise<void> {
    if (!this.midiPort) {
      return;
    }

    // Reset to neutral state (only confirmed params)
    const initSettings: ParamSetting[] = [
      { param: 'filter.cutoff', value: 0.8 },
      { param: 'filter.resonance', value: 0.0 },
      { param: 'env.amp.attack', value: 0.0 },
      { param: 'env.amp.decay', value: 0.3 },
      { param: 'env.amp.sustain', value: 0.8 },
      { param: 'env.amp.release', value: 0.2 },
      { param: 'lfo1.rate', value: 0.3 },
      { param: 'lfo1.amount', value: 0.0 },
    ];

    await this.setParams(initSettings);
  }

  getOscillatorTypes(): string[] {
    return ['Sawtooth', 'Triangle', 'Square', 'Pulse', 'Noise'];
  }

  async setModulation(source: string, destination: string, amount: NormalizedValue): Promise<import('../../synth/types.js').ModulationResult> {
    // SE-02 doesn't have a modulation matrix like MicroFreak
    // Modulation is handled through dedicated controls
    return {
      success: false,
      message: 'SE-02 uses fixed modulation routing, not a flexible mod matrix',
    };
  }

  getModMatrixCapabilities(): import('../../synth/types.js').ModMatrixCapabilities {
    return {
      sources: [],
      destinations: [],
      sourceDescriptions: {},
      destinationDescriptions: {},
    };
  }

  async loadPreset(slot: number): Promise<boolean> {
    if (!this.midiPort) {
      return false;
    }
    
    // SE-02 has 128 presets (0-127)
    if (slot < 1 || slot > 128) {
      return false;
    }
    
    // Program Change is 0-indexed
    return this.midiPort.sendProgramChange(this.midiChannel, slot - 1);
  }

  /**
   * Dump current preset from SE-02 edit buffer via SysEx.
   * Requests 4 parts of the edit buffer (296 bytes total).
   * 
   * @param slot Optional preset slot to load before dumping (1-128)
   * @returns Uint8Array containing raw preset data or null on failure
   */
  async dumpPreset(slot?: number): Promise<Uint8Array | null> {
    if (!this.midiPort) {
      console.warn('SE-02: MIDI port not initialized');
      return null;
    }

    try {
      // If slot specified, load it first
      if (slot !== undefined) {
        const loaded = await this.loadPreset(slot);
        if (!loaded) {
          console.warn(`SE-02: Failed to load preset ${slot}`);
          return null;
        }
        // Wait for preset to load
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Device ID (default 0x10, could be made configurable)
      const deviceId = 0x10;

      // Request 4 parts of edit buffer
      // Part 1: 05 00 00 00, size 0x40 (64 bytes? or different encoding?)
      // Part 2: 05 00 00 40, size 0x7B 
      // Part 3: 05 00 01 00, size 0x3A
      // Part 4: 05 00 01 40, size 0x0A
      const parts: number[][] = [];

      const requests = [
        { address: [0x05, 0x00, 0x00, 0x00], size: 0x40 },
        { address: [0x05, 0x00, 0x00, 0x40], size: 0x7B },
        { address: [0x05, 0x00, 0x01, 0x00], size: 0x3A },
        { address: [0x05, 0x00, 0x01, 0x40], size: 0x0A },
      ];

      for (let i = 0; i < requests.length; i++) {
        const { address, size } = requests[i];
        const request = buildSE02Request(
          deviceId,
          address as [number, number, number, number],
          size
        );

        // Send request and wait for response
        const response = await (this.midiPort as HardwareMidiPort).requestSysEx(request, 1000);
        
        // Parse response
        const parsed = parseSE02Response(response);
        if (!parsed) {
          console.warn(`SE-02: Failed to parse response for part ${i + 1}`);
          return null;
        }
        if (!parsed.valid) {
          console.warn(`SE-02: Invalid checksum in response for part ${i + 1}`);
          return null;
        }
        if (parsed.command !== 0x12) {
          console.warn(`SE-02: Unexpected command ${parsed.command} in response`);
          return null;
        }

        parts.push(parsed.data);
      }

      // Concatenate all parts into single buffer
      const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
      const buffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const part of parts) {
        buffer.set(part, offset);
        offset += part.length;
      }

      return buffer;

    } catch (error) {
      console.warn('SE-02: Preset dump failed:', error);
      return null;
    }
  }

  getParamDescriptions(): import('../../synth/types.js').ParamDescription[] {
    const descriptions: Record<CanonicalParam, { description: string; range: string; effect: string }> = {
      'osc.type': {
        description: 'Oscillator waveform type',
        range: '0.0-1.0',
        effect: 'Changes the basic waveform',
      },
      'osc.mix': {
        description: 'Mix between oscillators',
        range: '0.0-1.0',
        effect: 'Blends oscillator levels',
      },
      'osc.wave': {
        description: 'Oscillator waveform',
        range: '0.0-1.0',
        effect: 'Changes timbre',
      },
      'osc.shape': {
        description: 'Pulse width or shape',
        range: '0.0-1.0',
        effect: 'Modifies waveform shape',
      },
      'filter.cutoff': {
        description: 'Filter cutoff frequency',
        range: '0.0-1.0 (low to high)',
        effect: 'Opens/closes the filter, affecting brightness',
      },
      'filter.resonance': {
        description: 'Filter resonance/emphasis',
        range: '0.0-1.0',
        effect: 'Emphasizes frequencies at the cutoff point',
      },
      'filter.type': {
        description: 'Filter type',
        range: 'Low-pass only',
        effect: 'SE-02 has a classic low-pass filter',
      },
      'env.amp.attack': {
        description: 'Amplitude envelope attack time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'How quickly sound reaches full volume',
      },
      'env.amp.decay': {
        description: 'Amplitude envelope decay time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'Time to drop from peak to sustain level',
      },
      'env.amp.sustain': {
        description: 'Amplitude envelope sustain level',
        range: '0.0-1.0',
        effect: 'Volume level while holding a note',
      },
      'env.amp.release': {
        description: 'Amplitude envelope release time',
        range: '0.0-1.0 (fast to slow)',
        effect: 'How long sound continues after releasing key',
      },
      'env.filter.attack': {
        description: 'Filter envelope attack time',
        range: '0.0-1.0',
        effect: 'How quickly filter opens',
      },
      'env.filter.decay': {
        description: 'Filter envelope decay time',
        range: '0.0-1.0',
        effect: 'Filter decay time',
      },
      'env.filter.sustain': {
        description: 'Filter envelope sustain level',
        range: '0.0-1.0',
        effect: 'Filter sustain level',
      },
      'env.filter.release': {
        description: 'Filter envelope release time',
        range: '0.0-1.0',
        effect: 'Filter release time',
      },
      'lfo1.rate': {
        description: 'LFO rate/speed',
        range: '0.0-1.0 (slow to fast)',
        effect: 'Speed of modulation oscillation',
      },
      'lfo1.amount': {
        description: 'LFO modulation amount',
        range: '0.0-1.0',
        effect: 'Depth of LFO modulation',
      },
      'lfo2.rate': {
        description: 'Second LFO rate (not available on SE-02)',
        range: 'N/A',
        effect: 'SE-02 has only one LFO',
      },
      'lfo2.amount': {
        description: 'Second LFO amount (not available on SE-02)',
        range: 'N/A',
        effect: 'SE-02 has only one LFO',
      },
      'fx.mix': {
        description: 'Delay effect mix',
        range: '0.0-1.0',
        effect: 'Delay wet/dry balance',
      },
      'fx.param1': {
        description: 'Delay time',
        range: '0.0-1.0',
        effect: 'Delay time parameter',
      },
      'fx.param2': {
        description: 'Delay feedback',
        range: '0.0-1.0',
        effect: 'Delay feedback amount',
      },
    };

    // Supported canonical parameters
    const supported = new Set([
      'osc.mix',
      'osc.wave',
      'osc.shape',
      'filter.cutoff',
      'filter.resonance',
      'env.amp.attack',
      'env.amp.decay',
      'env.amp.sustain',
      'env.amp.release',
      'env.filter.attack',
      'env.filter.decay',
      'env.filter.sustain',
      'env.filter.release',
      'lfo1.rate',
      'lfo1.amount',
      'fx.mix',
      'fx.param1',
      'fx.param2',
    ]);

    return Object.entries(descriptions).map(([name, desc]) => ({
      name: name as CanonicalParam,
      ...desc,
      supported: supported.has(name),
    }));
  }

  getSoundDesignTips(): string[] {
    return [
      'For bass: Use Sawtooth or Pulse wave, low cutoff (0.2-0.4), add resonance for character. Sub osc adds depth.',
      'For leads: Bright cutoff (0.6-0.8), use pulse width modulation via LFO. Cross mod adds aggression.',
      'For plucks: Fast attack (0.0), short decay (0.1-0.2), low sustain (0.0-0.2). Higher cutoff with resonance.',
      'Classic analog sound: Mix all 3 oscillators, slight detuning on OSC2/3 (tune at 0.48-0.52 for subtle detune)',
      'LFO on filter cutoff creates sweeping/wobble effects. Try triangle wave for smooth, square for choppy.',
      'Cross modulation (OSC1->OSC2): Start at 0.2-0.4 for harmonic richness, 0.6+ for aggressive metallic tones',
      'Portamento adds expression: 0.1-0.3 for subtle glide, 0.5+ for dramatic pitch slides',
      'The SE-02 excels at warm, fat analog tones typical of vintage Roland synths (SH-101 heritage)',
      'Delay effect: Subtle (mix 0.2, time 0.3, feedback 0.2) or rhythmic (mix 0.4, time 0.5, feedback 0.6)',
      'Filter envelope amount: Negative values create inverted envelope movement, positive for classic sweep',
    ];
  }

  getHardwareFeatures(): string[] {
    return [
      'Sequencer: 16-step sequencer with motion recording',
      'Cross modulation: OSC1 can modulate OSC2 for FM-like timbres',
      'Portamento: Glide between notes controlled via CC 5',
      'Delay: Built-in delay effect with time and feedback controls',
      '3 oscillators: Classic analog architecture inspired by SH-101',
      'Sub oscillator: Additional -1 octave oscillator for bass weight',
      'PWM: Pulse width modulation with LFO or envelope sources',
      'True analog signal path: VCO, VCF, VCA for warm vintage sound',
    ];
  }

  /**
   * SE-02 Specific Methods
   * Direct access to SE-02 hardware parameters beyond standard SynthAdapter interface.
   */

  /** Set oscillator level (1, 2, or 3) */
  async setOscillatorLevel(osc: 1 | 2 | 3, level: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccMap = { 1: SE02CC.MIX_OSC1, 2: SE02CC.MIX_OSC2, 3: SE02CC.MIX_OSC3 };
    const ccValue = normalizedToCC(clampNormalized(level));
    return this.midiPort.sendCC(this.midiChannel, ccMap[osc], ccValue);
  }

  /** Set oscillator waveform (1, 2, or 3) */
  async setOscillatorWaveform(osc: 1 | 2 | 3, waveform: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccMap = { 1: SE02CC.OSC1_WAVEFORM, 2: SE02CC.OSC2_WAVEFORM, 3: SE02CC.OSC3_WAVEFORM };
    const ccValue = normalizedToCC(clampNormalized(waveform));
    return this.midiPort.sendCC(this.midiChannel, ccMap[osc], ccValue);
  }

  /** Set oscillator range/octave (1, 2, or 3) */
  async setOscillatorRange(osc: 1 | 2 | 3, range: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccMap = { 1: SE02CC.OSC1_RANGE, 2: SE02CC.OSC2_RANGE, 3: SE02CC.OSC3_RANGE };
    const ccValue = normalizedToCC(clampNormalized(range));
    return this.midiPort.sendCC(this.midiChannel, ccMap[osc], ccValue);
  }

  /** Set oscillator fine tune (1 or 2) */
  async setOscillatorFineTune(osc: 1 | 2, tune: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccMap = { 1: SE02CC.OSC1_FINE, 2: SE02CC.OSC2_FINE };
    const ccValue = normalizedToCC(clampNormalized(tune));
    return this.midiPort.sendCC(this.midiChannel, ccMap[osc], ccValue);
  }

  /** Set noise level */
  async setNoiseLevel(level: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(level));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.MIX_NOISE, ccValue);
  }

  /** Set feedback amount */
  async setFeedback(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.MIX_FEEDBACK, ccValue);
  }

  /** Set filter envelope 1 (attack, decay, sustain) */
  async setFilterEnv1(attack: NormalizedValue, decay: NormalizedValue, sustain: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_ATTACK_1, normalizedToCC(clampNormalized(attack))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_DECAY_1, normalizedToCC(clampNormalized(decay))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_SUSTAIN_1, normalizedToCC(clampNormalized(sustain))),
    ];
    return results.every(r => r);
  }

  /** Set filter envelope 2 sustain */
  async setFilterEnv2Sustain(sustain: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(sustain));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_SUSTAIN_2, ccValue);
  }

  /** Set filter envelope 2 (attack, decay, release) */
  async setFilterEnv2(attack: NormalizedValue, decay: NormalizedValue, release: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_ATTACK_2, normalizedToCC(clampNormalized(attack))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_DECAY_2, normalizedToCC(clampNormalized(decay))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_RELEASE, normalizedToCC(clampNormalized(release))),
    ];
    return results.every(r => r);
  }

  /** Set portamento/glide time */
  async setPortamentoTime(time: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(time));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.CONTROL_GLIDE, ccValue);
  }

  /** Set LFO waveform */
  async setLFOWaveform(waveform: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(waveform));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_WAVE, ccValue);
  }

  /** Set LFO filter amount */
  async setLFOFilterAmount(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_FILTER, ccValue);
  }

  /** Set delay parameters (time, feedback, mix) */
  async setDelay(time: NormalizedValue, feedback: NormalizedValue, mix: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.DELAY_TIME, normalizedToCC(clampNormalized(time))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.DELAY_REGEN, normalizedToCC(clampNormalized(feedback))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.DELAY_AMOUNT, normalizedToCC(clampNormalized(mix))),
    ];
    return results.every(r => r);
  }

  /** Set oscillator sync on/off */
  async setOscillatorSync(enabled: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(enabled));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.OSC_SYNC, ccValue);
  }

  /** Set cross modulation O2 to filter */
  async setCrossModO2Filter(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.XMOD_O2FLT, ccValue);
  }

  /** Set cross modulation O3TO */
  async setCrossModO3TO(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.XMOD_O3TO, ccValue);
  }

  /** Set cross modulation O3 pulse width */
  async setCrossModO3PW(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.XMOD_O3PW, ccValue);
  }

  /** Set cross modulation to mod wheel */
  async setCrossModToMW(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.XMOD_TO_MW, ccValue);
  }

  /** Set OSC1 envelope amount */
  async setOsc1EnvAmount(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.OSC1_ENV, ccValue);
  }

  /** Set OSC1 keyboard tracking */
  async setOsc1Keyboard(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.OSC1_KYBD, ccValue);
  }

  /** Set filter keyboard tracking (1-3 or 2-3) */
  async setFilterKeyTrack(track13: NormalizedValue, track23: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_KEY_TRACK_13, normalizedToCC(clampNormalized(track13))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_KEY_TRACK_23, normalizedToCC(clampNormalized(track23))),
    ];
    return results.every(r => r);
  }

  /** Set filter VCO modulation */
  async setFilterVCO(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_VCO, ccValue);
  }

  /** Set filter multi-trigger */
  async setFilterMTrig(value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(value));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_MTRIG, ccValue);
  }

  /** Set filter normal/invert */
  async setFilterNormInvert(value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(value));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_NORM_INVERT, ccValue);
  }

  /** Set filter gate/LFO */
  async setFilterGateLFO(value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(value));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.FILTER_GATE_LFO, ccValue);
  }

  /** Set LFO mode switch */
  async setLFOModeSwitch(value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(value));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_MODE_SW, ccValue);
  }

  /** Set LFO sync switch */
  async setLFOSync(enabled: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(enabled));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_SYNC_SW, ccValue);
  }

  /** Set LFO mod wheel switches */
  async setLFOModWheelSwitches(oscSwitch: NormalizedValue, filterSwitch: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_MWHL_OSC_SW, normalizedToCC(clampNormalized(oscSwitch))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.LFO_MWHL_FLT_SW, normalizedToCC(clampNormalized(filterSwitch))),
    ];
    return results.every(r => r);
  }

  /** Set velocity/dynamics sensitivity */
  async setDynamics(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.DYNAMICS, ccValue);
  }

  /** Set modulation sensitivity */
  async setModSensitivity(amount: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(amount));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.MOD_SENS, ccValue);
  }

  /** Set aftertouch sensitivity */
  async setAftertouchSens(sens1: NormalizedValue, sens2: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.AFT_SENS_1, normalizedToCC(clampNormalized(sens1))),
      this.midiPort.sendCC(this.midiChannel, SE02CC.AFT_SENS_2, normalizedToCC(clampNormalized(sens2))),
    ];
    return results.every(r => r);
  }

  /** Set pitch bend range */
  async setBendRange(semitones: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(semitones));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.BEND_RANGE, ccValue);
  }

  /** Set octave shift */
  async setOctaveShift(octaves: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(octaves));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.OCTAVE_SHIFT, ccValue);
  }

  /** Set transpose */
  async setTranspose(semitones: NormalizedValue, enabled?: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const results = [
      this.midiPort.sendCC(this.midiChannel, SE02CC.TRANSPOSE, normalizedToCC(clampNormalized(semitones))),
    ];
    if (enabled !== undefined) {
      results.push(this.midiPort.sendCC(this.midiChannel, SE02CC.TRANSPOSE_SW, normalizedToCC(clampNormalized(enabled))));
    }
    return results.every(r => r);
  }

  /** Set patch volume */
  async setPatchVolume(volume: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(volume));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.PATCH_VOLUME, ccValue);
  }

  /** Set control wheel */
  async setControlWheel(value: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(value));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.CONTROL_WHEEL, ccValue);
  }

  /** Set glide type */
  async setGlideType(type: NormalizedValue): Promise<boolean> {
    if (!this.midiPort) return false;
    const ccValue = normalizedToCC(clampNormalized(type));
    return this.midiPort.sendCC(this.midiChannel, SE02CC.CONTROL_GLIDE_TYPE, ccValue);
  }

  isConnected(): boolean {
    const portAvailable = findMidiOutput('se-02') || findMidiOutput('se02') || findMidiOutput('roland');
    return !!portAvailable && this.midiPort?.opened === true;
  }

  async disconnect(): Promise<void> {
    if (this.midiPort) {
      this.midiPort.close();
    }
    this.currentParams.clear();
  }

  /**
   * Get the MIDI CC number for a canonical parameter.
   * Maps canonical synth parameters to SE-02 specific MIDI CC numbers.
   */
  private getCC(param: CanonicalParam): number | undefined {
    const map: Partial<Record<CanonicalParam, number>> = {
      // Oscillators
      'osc.mix': SE02CC.MIX_OSC2,           // Use OSC2 level as proxy
      'osc.wave': SE02CC.OSC1_WAVEFORM,     // OSC1 waveform
      'osc.shape': SE02CC.XMOD_O3PW,        // Pulse width via cross mod
      
      // Filter
      'filter.cutoff': SE02CC.FILTER_CUTOFF,
      'filter.resonance': SE02CC.FILTER_RESONANCE,
      
      // Envelopes - SE-02 has filter envelope, using ENV 1 params
      'env.amp.attack': SE02CC.FILTER_ATTACK_1,
      'env.amp.decay': SE02CC.FILTER_DECAY_1,
      'env.amp.sustain': SE02CC.FILTER_SUSTAIN_1,
      'env.amp.release': SE02CC.FILTER_RELEASE,
      'env.filter.attack': SE02CC.FILTER_ATTACK_1,
      'env.filter.decay': SE02CC.FILTER_DECAY_1,
      'env.filter.sustain': SE02CC.FILTER_SUSTAIN_1,
      'env.filter.release': SE02CC.FILTER_RELEASE,
      
      // LFO
      'lfo1.rate': SE02CC.LFO_RATE,
      'lfo1.amount': SE02CC.LFO_OSC,        // LFO to oscillator
      
      // Effects
      'fx.mix': SE02CC.DELAY_AMOUNT,
      'fx.param1': SE02CC.DELAY_TIME,
      'fx.param2': SE02CC.DELAY_REGEN,
    };
    
    return map[param];
  }
}

/**
 * Detect if a Roland SE-02 is connected by scanning MIDI ports.
 */
export function detectSE02(): boolean {
  return !!(findMidiOutput('se-02') ?? findMidiOutput('se02') ?? findMidiOutput('roland'));
}

/**
 * Create and initialize an SE-02 driver instance.
 */
export async function createSE02Driver(
  options?: SE02Options,
): Promise<SE02Driver | null> {
  const driver = new SE02Driver(options);
  const initialized = await driver.initialize();
  if (!initialized) {
    return null;
  }
  return driver;
}
