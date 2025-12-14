/**
 * Oscillator Type Discovery
 * 
 * Sends CC 9 values to the MicroFreak and pauses so you can
 * observe which oscillator type is selected on the hardware.
 * 
 * Usage: npx tsx src/scripts/discover-osc-types.ts
 */

import midi from 'midi';
import { findMidiOutput } from '../midi/hardware-port.js';
import { MicroFreakCC, OSCILLATOR_TYPES } from '../drivers/microfreak/param-map.js';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main(): Promise<void> {
  const output = new midi.Output();
  const portName = findMidiOutput('microfreak') ?? findMidiOutput('arturia');
  
  if (!portName) {
    console.error('❌ MicroFreak not found. Is it connected?');
    process.exit(1);
  }

  // Find and open the port
  const portCount = output.getPortCount();
  let portIndex = -1;
  for (let i = 0; i < portCount; i++) {
    if (output.getPortName(i).toLowerCase().includes('microfreak')) {
      portIndex = i;
      break;
    }
  }
  
  if (portIndex === -1) {
    console.error('❌ Could not find MicroFreak output port');
    process.exit(1);
  }

  output.openPort(portIndex);
  console.log(`✅ Connected to ${output.getPortName(portIndex)}\n`);

  console.log('This script will send CC values to discover oscillator type mapping.');
  console.log('Watch the MicroFreak display to see which oscillator is selected.\n');

  // Test strategy: send specific CC values and let user report what they see
  const testValues = [
    { value: 0, expected: 'BasicWaves (1st)' },
    { value: 1, expected: 'SuperWave (2nd)' },
    { value: 6, expected: '~6 steps per type?' },
    { value: 7, expected: 'Should be 2nd type if distributed' },
    { value: 19, expected: 'SampleOsc (20th) if direct' },
    { value: 127, expected: 'Last type if distributed' },
  ];

  for (const test of testValues) {
    // Send CC
    output.sendMessage([0xB0, MicroFreakCC.OSC_TYPE, test.value]); // Channel 1
    console.log(`Sent CC ${MicroFreakCC.OSC_TYPE} = ${test.value}`);
    console.log(`Expected if direct mapping: ${OSCILLATOR_TYPES[test.value] ?? 'out of range'}`);
    
    const answer = await askQuestion('What oscillator type is shown on MicroFreak? > ');
    console.log(`  → You said: ${answer}\n`);
  }

  // Now let's do a full sweep
  console.log('\n--- Full sweep (0-19) ---');
  console.log('Press Enter to send next value, or type "skip" to exit.\n');

  const mapping: { value: number; type: string }[] = [];

  for (let i = 0; i <= 19; i++) {
    output.sendMessage([0xB0, MicroFreakCC.OSC_TYPE, i]);
    console.log(`Sent CC ${MicroFreakCC.OSC_TYPE} = ${i}`);
    
    const answer = await askQuestion('Oscillator shown? > ');
    if (answer.toLowerCase() === 'skip') break;
    mapping.push({ value: i, type: answer || `unknown-${i}` });
  }

  console.log('\n--- Discovered Mapping ---');
  console.log('export const OSC_TYPE_VALUES: Record<string, number> = {');
  for (const m of mapping) {
    console.log(`  '${m.type}': ${m.value},`);
  }
  console.log('};');

  output.closePort();
  rl.close();
}

main().catch(console.error);
