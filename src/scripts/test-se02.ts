#!/usr/bin/env node
/**
 * SE-02 Test Script
 * 
 * Quick hardware test: connects to SE-02 and plays a simple melody
 * with filter sweep so you can hear it working.
 */

import { HardwareMidiPort, findMidiOutput } from '../midi/hardware-port.js';
import { SE02CC } from '../drivers/se02/driver.js';

const MIDI_CHANNEL = 0; // Channel 1

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🎹 SE-02 Audio Test\n');
  
  // Find SE-02
  const se02Port = findMidiOutput('se-02') ?? findMidiOutput('se02') ?? findMidiOutput('roland');
  if (!se02Port) {
    console.log('❌ SE-02 not found');
    process.exit(1);
  }
  
  console.log(`✓ Found SE-02: "${se02Port}"`);
  console.log('🎵 Playing test pattern...\n');
  
  // Connect
  const port = new HardwareMidiPort(se02Port);
  port.open();
  
  // Set up a nice sound
  console.log('Setting up sound...');
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_CUTOFF, 80);      // Medium cutoff
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_RESONANCE, 40);   // Some resonance
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_ATTACK_2, 5);     // ENV2 (AMP) quick attack
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_DECAY_2, 60);     // ENV2 (AMP) medium decay
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_SUSTAIN_2, 80);   // ENV2 (AMP) high sustain
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_RELEASE, 40);     // ENV2 (AMP) medium release
  
  await sleep(100);
  
  // Play a simple melody
  console.log('Playing melody...');
  const notes = [60, 64, 67, 72]; // C, E, G, C
  
  for (const note of notes) {
    port.sendNoteOn(MIDI_CHANNEL, note, 100);
    await sleep(400);
    port.sendNoteOff(MIDI_CHANNEL, note);
    await sleep(100);
  }
  
  await sleep(300);
  
  // Filter sweep
  console.log('Filter sweep...');
  port.sendNoteOn(MIDI_CHANNEL, 48, 100); // Low C
  
  for (let i = 20; i <= 127; i += 3) {
    port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_CUTOFF, i);
    await sleep(30);
  }
  
  await sleep(200);
  port.sendNoteOff(MIDI_CHANNEL, 48);
  
  await sleep(500);
  
  // Cleanup
  port.close();
  console.log('\n✓ Test complete!');
  console.log('Did you hear it through your AirPods?\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
