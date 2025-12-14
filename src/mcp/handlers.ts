/**
 * MCP Tool Handlers
 * 
 * Implements the actual logic for each MCP tool.
 * Handlers bridge between MCP requests and the synth adapter layer.
 */

import { synthRegistry, type SynthAdapter } from '../synth/adapter.js';
import type { CanonicalParam } from '../synth/types.js';
import { encodeSequence, type SequenceStep } from '../drivers/microfreak/sequence.js';
import { readPreset, scanPresets, findEmptySlots } from '../drivers/microfreak/preset.js';
import type { HardwareMidiPort } from '../midi/hardware-port.js';

/** Get a synth by ID, or the first available synth */
function getSynth(synthId?: string): SynthAdapter | null {
  if (synthId) {
    return synthRegistry.get(synthId) ?? null;
  }
  return synthRegistry.getFirst() ?? null;
}

/** Handler for list_synths */
export async function handleListSynths(options?: { rescan?: boolean }): Promise<{
  synths: Array<{ id: string; name: string; manufacturer: string }>;
}> {
  // Optionally trigger a rescan for hot-plugged devices
  if (options?.rescan !== false) {
    // Trigger rescan via a callback if provided
    // For now, we'll just use what's registered
  }
  
  // Filter to only synths that are currently connected
  const synths = synthRegistry.getAll()
    .filter((s) => {
      const connected = s.isConnected();
      if (!connected) {
        console.error(`[list_synths] ${s.name} (${s.id}) is registered but not connected`);
      }
      return connected;
    })
    .map((s) => {
      const caps = s.getCapabilities();
      return {
        id: s.id,
        name: s.name,
        manufacturer: caps.manufacturer,
      };
    });
  return { synths };
}

/** Handler for describe_synth */
export async function handleDescribeSynth(params: { synthId?: string }): Promise<{
  success: boolean;
  synth?: {
    id: string;
    name: string;
    capabilities: ReturnType<SynthAdapter['getCapabilities']>;
  };
  error?: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  return {
    success: true,
    synth: {
      id: synth.id,
      name: synth.name,
      capabilities: synth.getCapabilities(),
    },
  };
}

/** Handler for set_param */
export async function handleSetParam(params: {
  param: CanonicalParam;
  value: number;
  synthId?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      message: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  const success = await synth.setParam(params.param, params.value);
  return {
    success,
    message: success
      ? `Set ${params.param} to ${params.value.toFixed(2)}`
      : `Parameter ${params.param} not supported on this synth`,
  };
}

/** Handler for load_preset */
export async function handleLoadPreset(params: {
  slot: number;
  synthId?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      message: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  if (!synth.loadPreset) {
    return {
      success: false,
      message: 'This synth does not support preset loading',
    };
  }

  const success = await synth.loadPreset(params.slot);
  return {
    success,
    message: success
      ? `Loaded preset from slot ${params.slot}`
      : `Failed to load preset from slot ${params.slot}`,
  };
}

/** Handler for set_synth_feature */
export async function handleSetSynthFeature(params: {
  feature: string;
  value: string;
  synthId?: string;
}): Promise<{
  success: boolean;
  feature: string;
  value: string;
  message: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      feature: params.feature,
      value: params.value,
      message: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  return synth.setFeature(params.feature, params.value);
}

/** Handler for init (reset synth to baseline) */
export async function handleInit(params: {
  synthId?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      message: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  await synth.resetToInit();
  return {
    success: true,
    message: 'Reset synth to init state. All modulation sources zeroed, filter open, neutral envelopes.',
  };
}

/** Handler for set_modulation (mod matrix routing) */
export async function handleSetModulation(params: {
  source: string;
  destination: string;
  amount: number;
  synthId?: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      message: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  if (!synth.setModulation) {
    return {
      success: false,
      message: 'This synth does not support modulation matrix control',
    };
  }

  const result = await synth.setModulation(params.source, params.destination, params.amount);
  return result;
}

/** Handler for create_sequence */
export async function handleCreateSequence(params: {
  steps: SequenceStep[];
  synthId?: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  if (!synth.writeSequence) {
    return {
      success: false,
      error: 'This synth does not support sequence writing',
    };
  }

  try {
    // First, reset the synth to init state
    await synth.resetToInit();
    
    // Then write the sequence
    await synth.writeSequence(params.steps);
    
    return {
      success: true,
      message: `Sequence sent to device (${params.steps.length} steps). Press PLAY on the sequencer.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Handler for get_sequence */
export async function handleGetSequence(params: {
  synthId?: string;
}): Promise<{ success: boolean; sequence?: any; error?: string }> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  // Reading sequences via SysEx is not yet implemented
  // User must export via MIDI Control Center
  return {
    success: false,
    error: 'Reading sequences via SysEx not yet implemented. ' +
           'Export preset via MIDI Control Center to analyze sequence data.',
  };
}

/** Handler for dump_preset */
export async function handleDumpPreset(params: {
  slot: number;
  synthId?: string;
}): Promise<{ success: boolean; preset?: any; error?: string }> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  // Get the MIDI port from the synth driver
  // Note: This assumes the synth has a midiPort property (true for MicroFreakDriver)
  const midiPort = (synth as any).midiPort as HardwareMidiPort;
  if (!midiPort) {
    return {
      success: false,
      error: 'Synth does not have a MIDI port (SysEx not supported)',
    };
  }

  try {
    const preset = await readPreset(midiPort, params.slot, 146, (current, total) => {
      console.log(`[MCP] Reading preset ${params.slot}: ${current}/${total} chunks`);
    });

    if (!preset) {
      return {
        success: false,
        error: `Failed to read preset from slot ${params.slot}`,
      };
    }

    return {
      success: true,
      preset: {
        slot: preset.slot,
        name: preset.name,
        category: preset.categoryName,
        firmware: preset.firmware,
        supported: preset.supported,
        bank: preset.bank,
        presetNumber: preset.presetNumber,
        // Don't include raw data chunks in response (too large)
        // User can export to JSON file if needed
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Error reading preset: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Handler for scan_presets */
export async function handleScanPresets(params: {
  synthId?: string;
}): Promise<{ success: boolean; presets?: any[]; error?: string }> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  const midiPort = (synth as any).midiPort as HardwareMidiPort;
  if (!midiPort) {
    return {
      success: false,
      error: 'Synth does not have a MIDI port (SysEx not supported)',
    };
  }

  try {
    const presets = await scanPresets(midiPort, (current, total) => {
      console.log(`[MCP] Scanning presets: ${current}/${total}`);
    });

    return {
      success: true,
      presets: presets.map(p => ({
        slot: p.slot,
        name: p.name,
        category: p.categoryName,
        isEmpty: p.isEmpty,
        bank: p.bank,
        presetNumber: p.presetNumber,
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: `Error scanning presets: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/** Handler for find_empty_slots */
export async function handleFindEmptySlots(params: {
  synthId?: string;
}): Promise<{ success: boolean; slots?: number[]; error?: string }> {
  const synth = getSynth(params.synthId);
  if (!synth) {
    return {
      success: false,
      error: params.synthId
        ? `Synth "${params.synthId}" not found`
        : 'No synths connected',
    };
  }

  const midiPort = (synth as any).midiPort as HardwareMidiPort;
  if (!midiPort) {
    return {
      success: false,
      error: 'Synth does not have a MIDI port (SysEx not supported)',
    };
  }

  try {
    const emptySlots = await findEmptySlots(midiPort, (current, total) => {
      console.log(`[MCP] Scanning for empty slots: ${current}/${total}`);
    });

    return {
      success: true,
      slots: emptySlots,
    };
  } catch (error) {
    return {
      success: false,
      error: `Error finding empty slots: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
