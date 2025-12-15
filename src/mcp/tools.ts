/**
 * MCP Tool Definitions
 * 
 * Defines the tools exposed to the LLM. These express intent, not implementation.
 * No raw MIDI or SysEx exposed at this layer.
 */

import { z } from 'zod';

/** Schema for describe_synth tool */
export const describeSynthSchema = z.object({
  synthId: z.string().optional().describe('ID of specific synth to describe. If omitted, describes the first available synth.'),
});

/** Schema for set_param tool */
export const setParamSchema = z.object({
  param: z.enum([
    'osc.type', 'osc.mix', 'osc.wave', 'osc.shape',
    'filter.cutoff', 'filter.resonance', 'filter.type',
    'env.amp.attack', 'env.amp.decay', 'env.amp.sustain', 'env.amp.release',
    'env.filter.attack', 'env.filter.decay', 'env.filter.sustain', 'env.filter.release',
    'lfo1.rate', 'lfo1.amount', 'lfo2.rate', 'lfo2.amount',
    'fx.mix', 'fx.param1', 'fx.param2',
  ]).describe('The canonical parameter name'),
  value: z.number().min(0).max(1).describe('Normalized value between 0.0 and 1.0'),
  synthId: z.string().optional().describe('ID of synth to set parameter on'),
});

/** Schema for load_preset tool */
export const loadPresetSchema = z.object({
  slot: z.number().int().min(1).describe('Preset slot number (starts at 1, matches hardware display)'),
  synthId: z.string().optional().describe('ID of synth to load preset on'),
});

/** Schema for set_synth_feature tool */
export const setSynthFeatureSchema = z.object({
  feature: z.string().describe('The feature name (e.g., oscillatorType, filterType)'),
  value: z.string().describe('The value to set the feature to'),
  synthId: z.string().optional().describe('ID of synth to set feature on'),
});

/** Schema for init tool */
export const initSchema = z.object({
  synthId: z.string().optional().describe('ID of synth to reset'),
});

/** Schema for set_modulation tool */
export const setModulationSchema = z.object({
  source: z.string().describe('Modulation source (e.g., LFO, Envelope, CyclingEnv, Pressure, Keyboard)'),
  destination: z.string().describe('Modulation destination (e.g., Pitch, Wave, Timbre, Cutoff, Assign1, Assign2, Assign3)'),
  amount: z.number().min(-1).max(1).describe('Modulation amount from -1.0 (full negative) to 1.0 (full positive), 0 = no modulation'),
  synthId: z.string().optional().describe('ID of synth to set modulation on'),
});

/** Schema for dump_preset tool */
export const dumpPresetSchema = z.object({
  slot: z.number().int().min(1).describe('Preset slot number (starts at 1, matches hardware display)'),
  synthId: z.string().optional().describe('ID of synth to dump preset from'),
});

/** Schema for list_synths tool */
export const listSynthsSchema = z.object({});

/** Tool definitions for MCP registration */
export const toolDefinitions = [
  {
    name: 'list_synths',
    description: 'List all connected synthesizers and their capabilities.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'describe_synth',
    description: 'Get detailed capabilities of a synthesizer including oscillator types, filter types, envelope options, and synth-specific features.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: {
          type: 'string',
          description: 'ID of specific synth to describe. If omitted, describes the first available synth.',
        },
      },
      required: [],
    },
  },
  {
    name: 'set_param',
    description: 'Set a specific synth parameter to a normalized value (0.0-1.0). Read the synth param resource first to understand what each parameter does.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        param: {
          type: 'string',
          enum: [
            'osc.type', 'osc.mix', 'osc.wave', 'osc.shape',
            'filter.cutoff', 'filter.resonance', 'filter.type',
            'env.amp.attack', 'env.amp.decay', 'env.amp.sustain', 'env.amp.release',
            'env.filter.attack', 'env.filter.decay', 'env.filter.sustain', 'env.filter.release',
            'lfo1.rate', 'lfo1.amount', 'lfo2.rate', 'lfo2.amount',
            'fx.mix', 'fx.param1', 'fx.param2',
          ],
          description: 'The canonical parameter name',
        },
        value: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Normalized value between 0.0 and 1.0',
        },
        synthId: {
          type: 'string',
          description: 'ID of synth to set parameter on',
        },
      },
      required: ['param', 'value'],
    },
  },
  {
    name: 'load_preset',
    description: 'Load a preset from a specific slot number on the synth.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slot: {
          type: 'number',
          minimum: 1,
          description: 'Preset slot number (starts at 1, matches hardware display)',
        },
        synthId: {
          type: 'string',
          description: 'ID of synth to load preset on',
        },
      },
      required: ['slot'],
    },
  },
  {
    name: 'set_synth_feature',
    description: 'Set a synth-specific feature to a value. Use describe_synth to discover available features and their valid values. Features are synth-specific capabilities like oscillator types, arpeggiator patterns, or voice modes that vary between synthesizers.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        feature: {
          type: 'string',
          description: 'The feature name (e.g., oscillatorType, filterType). Use describe_synth to see available features.',
        },
        value: {
          type: 'string',
          description: 'The value to set. Use describe_synth to see valid values for each feature.',
        },
        synthId: {
          type: 'string',
          description: 'ID of synth to set feature on',
        },
      },
      required: ['feature', 'value'],
    },
  },
  {
    name: 'init',
    description: 'Reset the synth to a clean baseline state. Zeros out all modulation sources (mod matrix, cycling envelope, LFO), opens the filter, and sets neutral envelope times. Use this before crafting a new sound to start fresh.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        synthId: {
          type: 'string',
          description: 'ID of synth to reset',
        },
      },
      required: [],
    },
  },
  {
    name: 'set_modulation',
    description: 'Set a modulation routing in the mod matrix. Route a modulation source (LFO, Envelope, etc.) to a destination (Pitch, Filter, etc.) with a specific amount. Positive values apply modulation in one direction, negative values invert it.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        source: {
          type: 'string',
          description: 'Modulation source (e.g., LFO, Envelope, CyclingEnv, Pressure, Keyboard)',
        },
        destination: {
          type: 'string',
          description: 'Modulation destination (e.g., Pitch, Wave, Timbre, Cutoff, Assign1, Assign2, Assign3)',
        },
        amount: {
          type: 'number',
          minimum: -1,
          maximum: 1,
          description: 'Modulation amount from -1.0 (full negative) to 1.0 (full positive), 0 = no modulation',
        },
        synthId: {
          type: 'string',
          description: 'ID of synth to set modulation on',
        },
      },
      required: ['source', 'destination', 'amount'],
    },
  },
  {
    name: 'dump_preset',
    description: 'Read a complete preset from a specific slot on the synth via SysEx. Returns all preset data including name, category, and parameter values. This is useful for inspecting existing presets to understand their construction.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slot: {
          type: 'number',
          minimum: 1,
          description: 'Preset slot number (starts at 1, matches hardware display)',
        },
        synthId: {
          type: 'string',
          description: 'ID of synth to dump preset from',
        },
      },
      required: ['slot'],
    },
  },
];