#!/usr/bin/env node
/**
 * Simple SE-02 Test - Just one long note
 * Tests if audio is clean without rapid MIDI commands
 */

import { HardwareMidiPort, findMidiOutput } from '../midi/hardware-port.js';
import { SE02CC } from '../drivers/se02/driver.js';

const MIDI_CHANNEL = 0;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🎹 SE-02 Simple Test - Hold one note\n');
  
  const se02Port = findMidiOutput('se-02') ?? findMidiOutput('se02') ?? findMidiOutput('roland');
  if (!se02Port) {
    console.log('❌ SE-02 not found');
    process.exit(1);
  }
  
  const port = new HardwareMidiPort(se02Port);
  port.open();
  
  console.log('Playing middle C for 5 seconds...');
  console.log('Listen for any choppiness or dropouts\n');
  
  // Set a nice sound
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_CUTOFF, 70);
  port.sendCC(MIDI_CHANNEL, SE02CC.FILTER_RESONANCE, 30);
  
  // Play one note and hold it
  port.sendNoteOn(MIDI_CHANNEL, 60, 100);
  
  await sleep(5000);
  
  port.sendNoteOff(MIDI_CHANNEL, 60);
  await sleep(500);
  
  port.close();
  console.log('✓ Done. Was the audio clean?\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
