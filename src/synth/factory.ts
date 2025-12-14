/**
 * Synth Driver Factory Registry
 * 
 * Allows drivers to register themselves as factory functions
 * that can detect and create driver instances.
 */

import type { SynthAdapter } from './adapter.js';

export interface SynthDriverFactory {
  /** Human-readable name for logging */
  name: string;
  
  /** 
   * Detect if this synth type is available and create a driver.
   * Returns null if not available.
   */
  detect: () => Promise<SynthAdapter | null>;
}

class DriverFactoryRegistry {
  private factories: SynthDriverFactory[] = [];

  register(factory: SynthDriverFactory): void {
    this.factories.push(factory);
  }

  getAll(): SynthDriverFactory[] {
    return [...this.factories];
  }
}

export const driverFactoryRegistry = new DriverFactoryRegistry();
