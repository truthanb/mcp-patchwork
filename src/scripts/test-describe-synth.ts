#!/usr/bin/env tsx
/**
 * Test enhanced describe_synth output
 */

import { synthRegistry } from '../synth/adapter.js';
import '../drivers/se02/index.js'; // Register SE-02 driver

async function main() {
  // Synth is auto-detected when driver factory is imported
  // await synthRegistry.initializeAll();
  
  const synth = synthRegistry.getFirst();
  
  if (!synth) {
    console.error('No synth found!');
    process.exit(1);
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`SYNTH: ${synth.name} (${synth.id})`);
  console.log(`${'='.repeat(80)}\n`);
  
  const caps = synth.getCapabilities();
  
  // Basic info
  console.log('Basic Capabilities:');
  console.log(`  Manufacturer: ${caps.manufacturer}`);
  console.log(`  Oscillator Types: ${caps.oscillatorTypes.join(', ')}`);
  console.log(`  Filter Types: ${caps.filterTypes.join(', ')}`);
  console.log(`  Envelopes: ${caps.envelopes.join(', ')}`);
  console.log(`  LFO Count: ${caps.lfoCount}`);
  console.log(`  Polyphony: ${caps.polyphony}`);
  console.log(`  FX Available: ${caps.fxAvailable}`);
  console.log(`  Preset Slots: ${caps.presetSlotCount}`);
  console.log(`  Supports Preset Dump: ${caps.supportsPresetDump}`);
  console.log(`  Supports Preset Load: ${caps.supportsPresetLoad}`);
  
  // Features
  console.log(`\nFeatures (${caps.features.length}):`);
  for (const feature of caps.features) {
    console.log(`  ${feature.name}: ${feature.description}`);
    console.log(`    Values: ${feature.values.join(', ')}`);
  }
  
  // Parameter Map
  if (caps.parameterMap) {
    const params = Object.keys(caps.parameterMap);
    console.log(`\nParameter Map (${params.length} parameters):`);
    for (const param of params) {
      const info = caps.parameterMap[param];
      console.log(`  ${param.padEnd(25)} CC ${String(info.cc).padStart(3)} - ${info.description}`);
    }
  } else {
    console.log('\n⚠️  Parameter Map not available');
  }
  
  // Controller Map
  if (caps.controllerMap) {
    const controllers = Object.keys(caps.controllerMap);
    console.log(`\nController Map (${controllers.length} sections):`);
    for (const controller of controllers) {
      const description = caps.controllerMap[controller];
      console.log(`  ${controller.padEnd(15)}: ${description}`);
    }
  } else {
    console.log('\n⚠️  Controller Map not available');
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

main().catch(console.error);
