#!/usr/bin/env tsx
/**
 * MIDI Snooper
 * 
 * Monitors ALL MIDI traffic to/from the MicroFreak.
 * Run this while using Arturia MIDI Control Center to capture
 * the SysEx commands it sends when saving sequences/presets.
 * 
 * Usage:
 *   tsx src/scripts/snoop-midi.ts
 *   (Then use MIDI Control Center to save a sequence)
 *   Ctrl+C to stop
 */

import { HardwareMidiPort, findMidiOutput, listMidiInputs, listMidiOutputs } from '../midi/hardware-port.js';

console.log('🔍 MIDI Snooper - Monitoring MicroFreak MIDI traffic\n');

// Find MicroFreak MIDI input port
const availableInputs = listMidiInputs();
const inputName = availableInputs.find(name => 
  name.toLowerCase().includes('microfreak') || name.toLowerCase().includes('arturia')
);

const outputName = findMidiOutput('microfreak') || findMidiOutput('arturia');

if (!inputName) {
  console.error('❌ MicroFreak MIDI input not found');
  console.log('Available MIDI inputs:', availableInputs);
  process.exit(1);
}

console.log(`📥 Monitoring input: ${inputName}`);
if (outputName) {
  console.log(`📤 Output available: ${outputName}`);
}
console.log('\n--- Listening for MIDI messages (press Ctrl+C to stop) ---\n');

// Open MIDI input port
const port = new HardwareMidiPort(inputName);
if (!port.open()) {
  console.error('❌ Failed to open MIDI input port');
  process.exit(1);
}

let messageCount = 0;
let sysexCount = 0;

// Enable SysEx monitoring
port.enableSysExInput((sysex: number[]) => {
  sysexCount++;
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  
  console.log(`\n[${timestamp}] 🎹 SysEx Message #${sysexCount} (${sysex.length} bytes)`);
  console.log('─'.repeat(80));
  
  // Parse Arturia header if present
  if (sysex.length >= 7 && sysex[0] === 0xF0 && sysex[1] === 0x00 && sysex[2] === 0x20 && sysex[3] === 0x6B) {
    console.log('Manufacturer: Arturia (00 20 6B)');
    console.log(`Device ID: 0x${sysex[4].toString(16).padStart(2, '0')}`);
    console.log(`Command: 0x${sysex[7].toString(16).padStart(2, '0')}`);
    
    // Check for known commands
    if (sysex[7] === 0x19) {
      console.log('  → Preset dump request/response');
      if (sysex.length > 10) {
        console.log(`  Bank: ${sysex[8]}, Preset: ${sysex[9]}`);
      }
    } else if (sysex[7] === 0x16) {
      console.log('  → Preset data chunk');
    } else if (sysex[7] === 0x52) {
      console.log('  → Preset name response');
    } else {
      console.log('  → UNKNOWN COMMAND (this might be a write command!)');
    }
  }
  
  // Display full message in hex
  console.log('\nHex:');
  for (let i = 0; i < sysex.length; i += 16) {
    const offset = i.toString(16).padStart(4, '0');
    const bytes = sysex.slice(i, i + 16)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
    console.log(`  ${offset}: ${bytes}`);
  }
  
  // ASCII representation (for readable strings)
  const ascii = sysex
    .map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.')
    .join('');
  if (ascii.match(/[A-Za-z]{3,}/)) {
    console.log(`\nASCII: ${ascii}`);
  }
  
  console.log('─'.repeat(80));
  
  // Save to file
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: 'sysex',
    bytes: sysex,
    length: sysex.length,
  };
  
  require('fs').appendFileSync(
    'midi-capture.jsonl',
    JSON.stringify(logEntry) + '\n'
  );
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n\n📊 Summary:`);
  console.log(`  SysEx messages captured: ${sysexCount}`);
  console.log(`  Log saved to: midi-capture.jsonl`);
  port.close();
  process.exit(0);
});

// Keep process alive
console.log('💡 Tip: Open Arturia MIDI Control Center now and save a sequence to the MicroFreak\n');
setInterval(() => {}, 1000);
