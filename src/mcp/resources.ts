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

  // Only list resources for connected synths
  for (const synth of synthRegistry.getAll().filter(s => s.isConnected())) {
    resources.push({
      uri: `synth://${synth.id}/params`,
      name: `${synth.name} Parameter Map`,
      description: `All available parameters for ${synth.name} with descriptions, ranges, and sound design tips`,
      mimeType: 'application/json',
    });
    
    // Add driver-specific documentation resources
    if (synth.getDocumentationResources) {
      const docs = synth.getDocumentationResources();
      for (const doc of docs) {
        // Convert resource name to URI-friendly format
        const uriKey = doc.name.toLowerCase().replace(/\s+/g, '-');
        resources.push({
          uri: `synth://${synth.id}/${uriKey}`,
          name: `${synth.name} ${doc.name}`,
          description: doc.description,
          mimeType: 'text/markdown',
        });
      }
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
  
  // Parse URI: synth://<synthId>/<doc-key> for driver-specific documentation
  const docMatch = uri.match(/^synth:\/\/([^/]+)\/(.+)$/);
  if (docMatch) {
    const synthId = docMatch[1];
    const docKey = docMatch[2];
    
    // Skip if it's the params resource (handled above)
    if (docKey === 'params') {
      return null;
    }
    
    const synth = synthRegistry.get(synthId);
    if (!synth?.getDocumentationResources) {
      return null;
    }
    
    // Find the matching documentation resource
    const docs = synth.getDocumentationResources();
    const doc = docs.find(d => d.name.toLowerCase().replace(/\s+/g, '-') === docKey);
    
    if (!doc) {
      return null;
    }
    
    // Read the documentation file
    try {
      const fs = require('fs');
      const path = require('path');
      const { fileURLToPath } = require('url');
      
      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const docPath = path.join(__dirname, doc.path);
      const content = fs.readFileSync(docPath, 'utf-8');
      
      return {
        content,
        mimeType: 'text/markdown',
      };
    } catch (error) {
      console.warn(`[Resources] Failed to read ${doc.name}:`, error);
      return null;
    }
  }

  return null;
}
