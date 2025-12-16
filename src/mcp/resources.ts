/**
 * MCP Resource Handlers
 * 
 * Exposes synth parameter maps and state as MCP resources.
 * This allows the LLM to read and reason about available parameters
 * rather than relying on predefined profiles/patches.
 * 
 * Resources are dynamically built from the connected synth driver,
 * making this module agnostic of specific synth implementations.
 */

import { synthRegistry } from '../synth/adapter.js';
import type { ParamDescription, ModMatrixCapabilities } from '../synth/types.js';

/**
 * Full param map resource for a synth.
 */
export interface ParamMapResource {
  synthId: string;
  synthName: string;
  /** All canonical parameters with descriptions */
  parameters: ParamDescription[];
  /** Available oscillator types */
  oscillatorTypes: string[];
  /** Tips for sound design */
  tips: string[];
  /** Hardware-specific features and capabilities */
  hardwareFeatures: string[];
  /** Modulation matrix capabilities (if supported) */
  modulationMatrix?: ModMatrixCapabilities;
}

/**
 * Get the param map resource for a synth.
 * Data is dynamically retrieved from the connected synth driver.
 */
export function getParamMapResource(synthId?: string): ParamMapResource | null {
  const synth = synthId 
    ? synthRegistry.get(synthId)
    : synthRegistry.getFirst();
  
  if (!synth) return null;

  const resource: ParamMapResource = {
    synthId: synth.id,
    synthName: synth.name,
    parameters: synth.getParamDescriptions(),
    oscillatorTypes: synth.getOscillatorTypes(),
    tips: synth.getSoundDesignTips(),
    hardwareFeatures: synth.getHardwareFeatures(),
  };

  // Add mod matrix info if supported
  if (synth.getModMatrixCapabilities) {
    resource.modulationMatrix = synth.getModMatrixCapabilities();
  }

  return resource;
}

/**
 * List all available resources.
 */
export function listResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  const resources: Array<{
    uri: string;
    name: string;
    description: string;
    mimeType: string;
  }> = [];

  for (const synth of synthRegistry.getAll()) {
    resources.push({
      uri: `synth://${synth.id}/params`,
      name: `${synth.name} Parameter Map`,
      description: `All available parameters for ${synth.name} with descriptions, ranges, and sound design tips`,
      mimeType: 'application/json',
    });
    
    // Add MIDI reference resource for specific synths
    if (synth.name === 'Arturia MicroFreak') {
      resources.push({
        uri: `synth://${synth.id}/midi-reference`,
        name: `${synth.name} MIDI Reference`,
        description: `Complete MIDI CC and NRPN reference for ${synth.name} including oscillator mappings, mod matrix, and usage examples`,
        mimeType: 'text/markdown',
      });
    }
    
    if (synth.name === 'Roland SE-02') {
      resources.push({
        uri: `synth://${synth.id}/midi-reference`,
        name: `${synth.name} MIDI Reference`,
        description: `Complete MIDI CC reference for ${synth.name} with all 70+ parameters documented`,
        mimeType: 'text/markdown',
      });
    }
  }

  return resources;
}

/**
 * Read a resource by URI.
 */
export function readResource(uri: string): { content: string; mimeType: string } | null {
  // Parse URI: synth://<synthId>/params
  const paramsMatch = uri.match(/^synth:\/\/([^/]+)\/params$/);
  if (paramsMatch) {
    const synthId = paramsMatch[1];
    const resource = getParamMapResource(synthId);
    if (!resource) return null;

    return {
      content: JSON.stringify(resource, null, 2),
      mimeType: 'application/json',
    };
  }
  
  // Parse URI: synth://<synthId>/midi-reference
  const midiRefMatch = uri.match(/^synth:\/\/([^/]+)\/midi-reference$/);
  if (midiRefMatch) {
    const synthId = midiRefMatch[1];
    const synth = synthRegistry.get(synthId);
    if (!synth) return null;
    
    // Determine which MIDI reference to load
    let docFilename: string;
    if (synth.name === 'Arturia MicroFreak') {
      docFilename = 'microfreak-midi-reference.md';
    } else if (synth.name === 'Roland SE-02') {
      docFilename = 'se02-midi-reference.md';
    } else {
      return null;
    }
    
    // Read the MIDI reference markdown file synchronously
    try {
      const fs = require('fs');
      const path = require('path');
      const { fileURLToPath } = require('url');
      
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const docPath = path.join(__dirname, '../../docs', docFilename);
      const content = fs.readFileSync(docPath, 'utf-8');
      
      return {
        content,
        mimeType: 'text/markdown',
      };
    } catch (error) {
      console.error('[Resources] Failed to read MIDI reference:', error);
      return null;
    }
  }

  return null;
}
