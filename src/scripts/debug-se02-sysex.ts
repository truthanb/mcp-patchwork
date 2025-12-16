#!/usr/bin/env node
/**
 * SE-02 SysEx Debug Test
 * 
 * Debug version with verbose logging to see what's happening
 * with SysEx communication.
 */

import { HardwareMidiPort, findMidiOutput } from '../midi/hardware-port.js';
import { buildSE02Request, parseSE02Response } from '../midi/roland-sysex.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function main() {
  console.log('\n🔍 SE-02 SysEx Debug Test\n');
  
  // Find SE-02
  const se02Port = findMidiOutput('se-02') ?? findMidiOutput('se02') ?? findMidiOutput('roland');
  if (!se02Port) {
    console.log('❌ SE-02 not found');
    process.exit(1);
  }
  
  console.log(`✓ Found SE-02: "${se02Port}"\n`);
  
  // Connect
  const port = new HardwareMidiPort(se02Port);
  port.open();
  
  // Enable SysEx input with detailed logging
  console.log('Setting up SysEx listener...');
  const received: number[][] = [];
  
  port.enableSysExInput((message) => {
    console.log(`\n📨 RECEIVED SysEx (${message.length} bytes):`);
    console.log(`   ${bytesToHex(message)}`);
    received.push(message);
    
    // Try to parse
    const parsed = parseSE02Response(message);
    if (parsed) {
      console.log(`   Command: 0x${parsed.command.toString(16).toUpperCase()}`);
      console.log(`   Address: ${bytesToHex(parsed.address)}`);
      console.log(`   Data: ${parsed.data.length} bytes`);
      console.log(`   Valid: ${parsed.valid}`);
    } else {
      console.log('   (Failed to parse as SE-02 response)');
    }
  });
  
  await sleep(100);
  
  // Test 1: Simple request for firmware version
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 1: Request Firmware Version');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const fwRequest = buildSE02Request(
    0x10,
    [0x03, 0x00, 0x00, 0x00],
    0x12 // 18 bytes
  );
  
  console.log(`📤 SENDING Request:`);
  console.log(`   ${bytesToHex(fwRequest)}`);
  console.log(`   Waiting for response...`);
  
  port.sendSysEx(fwRequest);
  await sleep(500);
  
  if (received.length === 0) {
    console.log('\n⚠️  No response received');
  }
  
  // Test 2: Request edit buffer part 1
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Test 2: Request Edit Buffer Part 1');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  received.length = 0; // Clear
  
  const editRequest = buildSE02Request(
    0x10,
    [0x05, 0x00, 0x00, 0x00],
    0x40 // From your captures
  );
  
  console.log(`📤 SENDING Request:`);
  console.log(`   ${bytesToHex(editRequest)}`);
  console.log(`   Waiting for response...`);
  
  port.sendSysEx(editRequest);
  await sleep(500);
  
  if (received.length === 0) {
    console.log('\n⚠️  No response received');
    console.log('\nPossible issues:');
    console.log('  • SE-02 not receiving SysEx (MIDI thru off?)');
    console.log('  • Wrong device ID (try 0x00 instead of 0x10?)');
    console.log('  • SE-02 firmware doesn\'t support this command');
    console.log('  • MIDI input port not matching output port');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Summary');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Messages received: ${received.length}`);
  
  port.close();
}

main().catch(console.error);
