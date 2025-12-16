#!/usr/bin/env node
/**
 * SE-02 Device ID Scanner
 * 
 * Tries all possible device IDs (0x00-0x1F) to find which one
 * the SE-02 is configured to respond to.
 */

import { HardwareMidiPort, findMidiOutput } from '../midi/hardware-port.js';
import { buildSE02Request, parseSE02Response } from '../midi/roland-sysex.js';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

async function tryDeviceId(port: HardwareMidiPort, deviceId: number): Promise<boolean> {
  return new Promise((resolve) => {
    let received = false;
    
    // Set up listener
    const success = port.enableSysExInput((message) => {
      if (!received) {
        received = true;
        console.log(`   ✓ Response received!`);
        console.log(`     ${bytesToHex(message.slice(0, 20))}...`);
        resolve(true);
      }
    });
    
    if (!success) {
      resolve(false);
      return;
    }
    
    // Build and send request
    const request = buildSE02Request(
      deviceId,
      [0x03, 0x00, 0x00, 0x00], // Firmware version query
      0x12
    );
    
    port.sendSysEx(request);
    
    // Wait 300ms for response
    setTimeout(() => {
      port.disableSysExInput();
      if (!received) {
        resolve(false);
      }
    }, 300);
  });
}

async function main() {
  console.log('\n🔍 SE-02 Device ID Scanner\n');
  console.log('Scanning device IDs 0x00 through 0x1F (0-31)...\n');
  
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
  
  const foundIds: number[] = [];
  
  // Try all device IDs
  for (let deviceId = 0x00; deviceId <= 0x1F; deviceId++) {
    process.stdout.write(`Trying 0x${deviceId.toString(16).padStart(2, '0').toUpperCase()} (${deviceId.toString().padStart(2, ' ')})... `);
    
    const responded = await tryDeviceId(port, deviceId);
    
    if (responded) {
      foundIds.push(deviceId);
    } else {
      console.log('no response');
    }
    
    await sleep(100); // Brief pause between attempts
  }
  
  port.close();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Scan Complete');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (foundIds.length === 0) {
    console.log('❌ No responding device IDs found\n');
    console.log('Possible issues:');
    console.log('  • SE-02 not receiving SysEx messages');
    console.log('  • MIDI input/output port mismatch');
    console.log('  • SE-02 in a mode that blocks SysEx');
    console.log('  • Different SysEx protocol version\n');
  } else {
    console.log(`✓ Found ${foundIds.length} responding device ID(s):\n`);
    for (const id of foundIds) {
      console.log(`  • 0x${id.toString(16).padStart(2, '0').toUpperCase()} (decimal ${id})`);
    }
    console.log('\nUse this device ID in your SE-02 driver configuration.\n');
  }
}

main().catch(console.error);
