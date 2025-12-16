#!/usr/bin/env node
/**
 * SE-02 Preset Dump Test
 * 
 * Tests the SysEx preset dump functionality by requesting
 * presets from the SE-02 and saving them to disk.
 */

import { createSE02Driver } from '../drivers/se02/driver.js';
import { parsePresetName } from '../midi/roland-sysex.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

async function main() {
  console.log('\n🎹 SE-02 Preset Dump Test\n');
  
  // Create driver
  const driver = await createSE02Driver();
  if (!driver) {
    console.log('❌ Failed to connect to SE-02');
    process.exit(1);
  }
  
  console.log('✓ Connected to SE-02\n');
  
  // Check capabilities
  const caps = driver.getCapabilities();
  console.log(`Preset dump supported: ${caps.supportsPresetDump}`);
  console.log(`Preset slots: ${caps.presetSlotCount}\n`);
  
  if (!caps.supportsPresetDump) {
    console.log('❌ Preset dump not supported');
    await driver.disconnect();
    process.exit(1);
  }
  
  // Test 1: Dump current edit buffer
  console.log('Test 1: Dumping current edit buffer...');
  try {
    const buffer = await driver.dumpPreset();
    if (buffer) {
      console.log(`✓ Received ${buffer.length} bytes`);
      console.log(`First 32 bytes: ${bytesToHex(buffer.slice(0, 32))}`);
      
      // Try to extract preset name from part 4 (should be at offset 234-250)
      if (buffer.length >= 250) {
        const nameBytes = Array.from(buffer.slice(234, 250));
        const name = parsePresetName(nameBytes);
        console.log(`Preset name: "${name}"`);
      }
      
      // Save to file
      const filename = 'preset-edit-buffer.bin';
      writeFileSync(filename, buffer);
      console.log(`✓ Saved to ${filename}\n`);
    } else {
      console.log('❌ Failed to dump preset\n');
    }
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  await sleep(500);
  
  // Test 2: Dump preset from slot 1
  console.log('Test 2: Dumping preset slot 1...');
  try {
    const buffer = await driver.dumpPreset(1);
    if (buffer) {
      console.log(`✓ Received ${buffer.length} bytes`);
      
      // Extract name
      if (buffer.length >= 250) {
        const nameBytes = Array.from(buffer.slice(234, 250));
        const name = parsePresetName(nameBytes);
        console.log(`Preset name: "${name}"`);
      }
      
      // Save to file
      const filename = 'preset-001.bin';
      writeFileSync(filename, buffer);
      console.log(`✓ Saved to ${filename}\n`);
    } else {
      console.log('❌ Failed to dump preset\n');
    }
  } catch (error) {
    console.log('❌ Error:', error);
  }
  
  await sleep(500);
  
  // Test 3: Dump multiple presets
  console.log('Test 3: Dumping presets 1-5...');
  const presetsDir = 'analysis/se02-dumps';
  
  for (let slot = 1; slot <= 5; slot++) {
    try {
      console.log(`  Dumping slot ${slot}...`);
      const buffer = await driver.dumpPreset(slot);
      
      if (buffer) {
        // Extract name
        let name = `preset-${slot.toString().padStart(3, '0')}`;
        if (buffer.length >= 250) {
          const nameBytes = Array.from(buffer.slice(234, 250));
          const parsedName = parsePresetName(nameBytes);
          if (parsedName) {
            name = parsedName.replace(/[^a-zA-Z0-9-_]/g, '_');
          }
        }
        
        // Save both binary and JSON
        const binFile = join(presetsDir, `${slot.toString().padStart(3, '0')}-${name}.bin`);
        const jsonFile = join(presetsDir, `${slot.toString().padStart(3, '0')}-${name}.json`);
        
        writeFileSync(binFile, buffer);
        
        // Create JSON with hex dump
        const hexLines: string[] = [];
        for (let i = 0; i < buffer.length; i += 16) {
          const chunk = buffer.slice(i, Math.min(i + 16, buffer.length));
          hexLines.push(bytesToHex(chunk));
        }
        
        const jsonData = {
          slot,
          name,
          size: buffer.length,
          hexDump: hexLines,
          raw: Array.from(buffer),
        };
        
        writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));
        console.log(`    ✓ Saved as "${name}"`);
      } else {
        console.log(`    ❌ Failed`);
      }
      
      await sleep(300); // Wait between dumps
    } catch (error) {
      console.log(`    ❌ Error: ${error}`);
    }
  }
  
  console.log('\n✓ Dump test complete!');
  console.log(`\nFiles saved to current directory and ${presetsDir}/`);
  console.log('\nNext steps:');
  console.log('  • Compare dumps with known presets');
  console.log('  • Identify preset name location');
  console.log('  • Map parameter bytes to CC values');
  console.log('  • Implement parameter extraction\n');
  
  await driver.disconnect();
}

main().catch(console.error);
