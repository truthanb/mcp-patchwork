/**
 * Synth Adapter Interface
 * 
 * All drivers implement this interface to provide a consistent abstraction
 * between musical intent and synth-specific implementation.
 */

import type {
  SynthCapabilities,
  CanonicalParam,
  NormalizedValue,
  ApplyResult,
  ParamSetting,
  SynthFeature,
  FeatureResult,
} from './types.js';

/**
 * The Synth Adapter interface that all drivers must implement.
 * This is the contract between the MCP layer and synth-specific drivers.
 */
export interface SynthAdapter {
  /** Unique identifier for this synth instance */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;
  
  /** Driver type identifier (matches factory id) */
  readonly driverType: string;

  /** Report what this synth can do */
  getCapabilities(): SynthCapabilities;

  /**
   * Set a single parameter to a normalized value.
   * Drivers map canonical params to CC/SysEx internally.
   * Unsupported params should no-op and return false.
   */
  setParam(param: CanonicalParam, value: NormalizedValue): Promise<boolean>;

  /**
   * Set multiple parameters at once.
   * More efficient than multiple setParam calls for some synths.
   */
  setParams(settings: ParamSetting[]): Promise<ApplyResult>;

  /**
   * Reset synth to a clean baseline state.
   * Zeros modulation sources, opens filter, neutral envelopes.
   */
  resetToInit(): Promise<void>;

  /**
   * Load a preset by slot number (if supported).
   */
  loadPreset?(slot: number): Promise<boolean>;

  /**
   * Get available features for this synth.
   * Features are synth-specific capabilities with discrete values.
   */
  getFeatures(): SynthFeature[];

  /**
   * Set a synth-specific feature to a value.
   * Returns result indicating success/failure and any message.
   */
  setFeature(feature: string, value: string): Promise<FeatureResult>;

  /**
   * Get parameter descriptions for this synth.
   * Used by MCP resources to provide LLM-readable parameter info.
   */
  getParamDescriptions(): import('./types.js').ParamDescription[];

  /**
   * Get sound design tips specific to this synth.
   */
  getSoundDesignTips(): string[];

  /**
   * Get hardware-specific features and capabilities.
   */
  getHardwareFeatures(): string[];

  /**
   * Get available oscillator types.
   */
  getOscillatorTypes(): string[];

  /**
   * Get modulation matrix capabilities.
   * Returns available sources, destinations, and descriptions.
   */
  getModMatrixCapabilities?(): import('./types.js').ModMatrixCapabilities;

  /**
   * Get driver-specific documentation resources.
   * Returns array of resources (MIDI reference, workflow guides, etc.)
   * that should be exposed as MCP resources.
   */
  getDocumentationResources?(): Array<{
    name: string;
    description: string;
    /** Relative path from driver directory */
    path: string;
  }>;

  /**
   * Set a modulation amount in the mod matrix.
   * @param source Modulation source (e.g., 'LFO', 'Envelope')
   * @param destination Modulation destination (e.g., 'Cutoff', 'Pitch')
   * @param amount Modulation amount (-1.0 to 1.0, where 0 is no modulation)
   */
  setModulation?(source: string, destination: string, amount: number): Promise<import('./types.js').ModulationResult>;

  /**
   * Write a sequence to the synth (if supported).
   * @param steps Array of sequence steps
   */
  writeSequence?(steps: any[]): Promise<void>;

  /**
   * Save current state to a preset slot (if supported).
   */
  savePreset?(slot: number, name: string): Promise<boolean>;

  /**
   * Dump current preset data (if supported).
   * Returns synth-specific data that can be restored later.
   */
  dumpPreset?(): Promise<Uint8Array | null>;

  /**
   * Restore a previously dumped preset (if supported).
   */
  restorePreset?(data: Uint8Array): Promise<boolean>;

  /**
   * Check if the synth is currently connected and responsive.
   * Returns true if MIDI port is available and open.
   */
  isConnected(): boolean;

  /** Clean up resources (MIDI ports, etc.) */
  disconnect(): Promise<void>;
}

/**
 * Registry of available synth adapters.
 * Drivers register themselves here when detected.
 */
export class SynthRegistry {
  private adapters: Map<string, SynthAdapter> = new Map();

  register(adapter: SynthAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  unregister(id: string): void {
    this.adapters.delete(id);
  }

  get(id: string): SynthAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): SynthAdapter[] {
    return Array.from(this.adapters.values());
  }

  getFirst(): SynthAdapter | undefined {
    return this.adapters.values().next().value;
  }

  clear(): void {
    this.adapters.clear();
  }
}

/** Global synth registry instance */
export const synthRegistry = new SynthRegistry();
