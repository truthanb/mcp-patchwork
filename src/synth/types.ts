/**
 * Core type definitions for the synth control plane.
 * These types define the abstraction layer between LLM intent and driver implementation.
 */

/** All parameter values are normalized 0.0–1.0 */
export type NormalizedValue = number;

/**
 * Parameter description for LLM consumption.
 */
export interface ParamDescription {
  /** Canonical name (e.g., 'filter.cutoff') */
  name: CanonicalParam;
  /** Human-readable description */
  description: string;
  /** Value range hint (e.g., '0.0-1.0 normalized') */
  range: string;
  /** Sonic effect of increasing this value */
  effect: string;
  /** Whether this param is supported on the synth */
  supported: boolean;
}

/**
 * Modulation matrix capabilities.
 */
export interface ModMatrixCapabilities {
  /** Available modulation sources */
  sources: string[];
  /** Available modulation destinations */
  destinations: string[];
  /** Human-readable descriptions for sources */
  sourceDescriptions: Record<string, string>;
  /** Human-readable descriptions for destinations */
  destinationDescriptions: Record<string, string>;
}

/**
 * Result of setting a modulation amount.
 */
export interface ModulationResult {
  success: boolean;
  message: string;
}

/** Canonical parameter names (synth-agnostic) */
export type CanonicalParam =
  | 'osc.type'
  | 'osc.mix'
  | 'osc.wave'
  | 'osc.shape'
  | 'filter.cutoff'
  | 'filter.resonance'
  | 'filter.type'
  | 'env.amp.attack'
  | 'env.amp.decay'
  | 'env.amp.sustain'
  | 'env.amp.release'
  | 'env.filter.attack'
  | 'env.filter.decay'
  | 'env.filter.sustain'
  | 'env.filter.release'
  | 'lfo1.rate'
  | 'lfo1.amount'
  | 'lfo2.rate'
  | 'lfo2.amount'
  | 'fx.mix'
  | 'fx.param1'
  | 'fx.param2';

/** Synth capabilities reported by drivers */
export interface SynthCapabilities {
  name: string;
  manufacturer: string;
  oscillatorTypes: string[];
  filterTypes: string[];
  envelopes: ('amp' | 'filter' | 'mod')[];
  lfoCount: number;
  polyphony: number;
  fxAvailable: boolean;
  supportsPresetDump: boolean;
  supportsPresetLoad: boolean;
  /** Number of preset slots (e.g., 512 for MicroFreak) */
  presetSlotCount?: number;
  /** Synth-specific features with their valid values */
  features: SynthFeature[];
}

/** A synth-specific feature that can be set */
export interface SynthFeature {
  /** Feature name (e.g., 'oscillatorType', 'filterMode', 'arpPattern') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Valid values for this feature */
  values: string[];
  /** Current value, if known */
  currentValue?: string;
}

/** Result from setting a feature */
export interface FeatureResult {
  success: boolean;
  feature: string;
  value: string;
  message: string;
}

/** A parameter setting with its canonical name and normalized value */
export interface ParamSetting {
  param: CanonicalParam;
  value: NormalizedValue;
}

/** Result from setting parameters */
export interface ApplyResult {
  success: boolean;
  appliedParams: ParamSetting[];
  skippedParams: CanonicalParam[];
  message: string;
}
