#!/usr/bin/env node
/**
 * MIDI Test Script
 * 
 * Quick hardware test: scans ports, connects to MicroFreak, 
 * sweeps the filter cutoff so you can hear it working.
 */

import { HardwareMidiPort, listMidiOutputs, findMidiOutput } from '../midi/hardware-port.js';
import { MicroFreakCC } from '../drivers/microfreak/param-map.js';

const MIDI_CHANNEL = 0; // Channel 1

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🎹 Patchwork MIDI Test\n');
  
  // List all available ports
  const ports = listMidiOutputs();
  console.log('Available MIDI outputs:');
  if (ports.length === 0) {
    console.log('  (none found)');
    console.log('\n❌ No MIDI devices detected. Is MicroFreak connected via USB?');
    process.exit(1);
  }
  ports.forEach((p, i) => console.log(`  ${i}: ${p}`));
  
  // Try to find MicroFreak
  const microfreakPort = findMidiOutput('microfreak') ?? findMidiOutput('arturia');
  if (!microfreakPort) {
    console.log('\n❌ MicroFreak not found. Looking for "microfreak" or "arturia" in port names.');
    process.exit(1);
  }
  
  console.log(`\n✓ Found MicroFreak: "${microfreakPort}"`);
  
  // Connect
  const port = new HardwareMidiPort(microfreakPort);
  if (!port.open()) {
    console.log('\n❌ Failed to open MIDI port');
    process.exit(1);
  }
  
  console.log('\n🎛️  Testing filter cutoff sweep...');
  console.log('   (You should hear the filter open and close)\n');
  
  // Play a note and sweep filter
  port.sendNoteOn(MIDI_CHANNEL, 48, 100); // C3
  
  // Sweep filter up
  for (let val = 0; val <= 127; val += 4) {
    port.sendCC(MIDI_CHANNEL, MicroFreakCC.FILTER_CUTOFF, val);
    await sleep(20);
  }
  
  // Sweep filter down
  for (let val = 127; val >= 0; val -= 4) {
    port.sendCC(MIDI_CHANNEL, MicroFreakCC.FILTER_CUTOFF, val);
    await sleep(20);
  }
  
  // Return to middle
  port.sendCC(MIDI_CHANNEL, MicroFreakCC.FILTER_CUTOFF, 64);
  
  await sleep(500);
  port.sendNoteOff(MIDI_CHANNEL, 48);
  
  console.log('✓ Filter sweep complete\n');
  
  // Test a few more CCs
  console.log('🎛️  Testing resonance...');
  port.sendNoteOn(MIDI_CHANNEL, 48, 100);
  
  for (let val = 0; val <= 100; val += 5) {
    port.sendCC(MIDI_CHANNEL, MicroFreakCC.FILTER_RESONANCE, val);
    await sleep(30);
  }
  port.sendCC(MIDI_CHANNEL, MicroFreakCC.FILTER_RESONANCE, 20);
  
  await sleep(300);
  port.sendNoteOff(MIDI_CHANNEL, 48);
  
  console.log('✓ Resonance test complete\n');
  
  // Cleanup
  port.close();
  console.log('🎉 MIDI test passed! Hardware connection is working.\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
