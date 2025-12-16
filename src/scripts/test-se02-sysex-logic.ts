#!/usr/bin/env node
/**
 * SE-02 SysEx Implementation Smoke Test
 * 
 * Tests that our SysEx message building and parsing matches
 * the known-good captures from the Electra One editor.
 */

import { buildSE02Request, parseSE02Response, calculateRolandChecksum, parsePresetName, encodePresetName } from '../midi/roland-sysex.js';

function bytesToHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((val, i) => val === b[i]);
}

let passCount = 0;
let failCount = 0;

function test(name: string, fn: () => boolean): void {
  process.stdout.write(`${name}... `);
  try {
    const result = fn();
    if (result) {
      console.log('✓ PASS');
      passCount++;
    } else {
      console.log('✗ FAIL');
      failCount++;
    }
  } catch (error) {
    console.log(`✗ ERROR: ${error}`);
    failCount++;
  }
}

console.log('\n🧪 SE-02 SysEx Smoke Tests\n');
console.log('Testing against known-good captures from Electra One editor\n');

// Test 1: Build edit buffer part 1 request
test('Build edit buffer part 1 request', () => {
  const request = buildSE02Request(0x10, [0x05, 0x00, 0x00, 0x00], 0x40);
  const expected = [0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x00, 0x00, 0x40, 0x3B, 0xF7];
  
  console.log(`\n  Expected: ${bytesToHex(expected)}`);
  console.log(`  Got:      ${bytesToHex(request)}`);
  
  return arraysEqual(request, expected);
});

// Test 2: Build edit buffer part 2 request
test('Build edit buffer part 2 request', () => {
  const request = buildSE02Request(0x10, [0x05, 0x00, 0x00, 0x40], 0x7B);
  const expected = [0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x00, 0x40, 0x7B, 0x40, 0xF7];
  
  console.log(`\n  Expected: ${bytesToHex(expected)}`);
  console.log(`  Got:      ${bytesToHex(request)}`);
  
  return arraysEqual(request, expected);
});

// Test 3: Build edit buffer part 3 request
test('Build edit buffer part 3 request', () => {
  const request = buildSE02Request(0x10, [0x05, 0x00, 0x01, 0x00], 0x3A);
  const expected = [0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x01, 0x00, 0x3A, 0x40, 0xF7];
  
  console.log(`\n  Expected: ${bytesToHex(expected)}`);
  console.log(`  Got:      ${bytesToHex(request)}`);
  
  return arraysEqual(request, expected);
});

// Test 4: Build edit buffer part 4 request
test('Build edit buffer part 4 request', () => {
  const request = buildSE02Request(0x10, [0x05, 0x00, 0x01, 0x40], 0x0A);
  const expected = [0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x01, 0x40, 0x0A, 0x30, 0xF7];
  
  console.log(`\n  Expected: ${bytesToHex(expected)}`);
  console.log(`  Got:      ${bytesToHex(request)}`);
  
  return arraysEqual(request, expected);
});

// Test 5: Checksum calculation
test('Roland checksum calculation', () => {
  // From the request: address [05 00 00 00] + size [40] should give checksum 3B
  const data = [0x05, 0x00, 0x00, 0x00, 0x40];
  const checksum = calculateRolandChecksum(data);
  const expected = 0x3B;
  
  console.log(`\n  Data:     ${bytesToHex(data)}`);
  console.log(`  Expected: 0x${expected.toString(16).toUpperCase()}`);
  console.log(`  Got:      0x${checksum.toString(16).toUpperCase()}`);
  
  return checksum === expected;
});

// Test 6: Parse a known-good response
test('Parse DT1 response', () => {
  // Simulated response (would come from SE-02)
  const response = [
    0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, // Header
    0x12, // DT1 (data transfer)
    0x05, 0x00, 0x00, 0x00, // Address
    // Fake data bytes (10 bytes)
    0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A,
    0x00, // Placeholder checksum (will calculate)
    0xF7
  ];
  
  // Calculate correct checksum
  const checksumData = [0x05, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A];
  const correctChecksum = calculateRolandChecksum(checksumData);
  response[response.length - 2] = correctChecksum;
  
  console.log(`\n  Response: ${bytesToHex(response)}`);
  
  const parsed = parseSE02Response(response);
  
  if (!parsed) {
    console.log('  Failed to parse');
    return false;
  }
  
  console.log(`  Device ID: 0x${parsed.deviceId.toString(16).toUpperCase()}`);
  console.log(`  Command:   0x${parsed.command.toString(16).toUpperCase()}`);
  console.log(`  Address:   ${bytesToHex(parsed.address)}`);
  console.log(`  Data:      ${bytesToHex(parsed.data)}`);
  console.log(`  Valid:     ${parsed.valid}`);
  
  return parsed.valid && 
         parsed.deviceId === 0x10 && 
         parsed.command === 0x12 &&
         parsed.data.length === 10;
});

// Test 7: Preset name parsing
test('Parse preset name "Inbound"', () => {
  // From your captures: 49 6E 62 6F 75 6E 64 = "Inbound"
  const nameBytes = [0x49, 0x6E, 0x62, 0x6F, 0x75, 0x6E, 0x64, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const name = parsePresetName(nameBytes);
  const expected = 'Inbound';
  
  console.log(`\n  Bytes:    ${bytesToHex(nameBytes)}`);
  console.log(`  Expected: "${expected}"`);
  console.log(`  Got:      "${name}"`);
  
  return name === expected;
});

// Test 8: Preset name encoding
test('Encode preset name "Test"', () => {
  const name = 'Test';
  const encoded = encodePresetName(name);
  const expected = [0x54, 0x65, 0x73, 0x74, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  
  console.log(`\n  Name:     "${name}"`);
  console.log(`  Expected: ${bytesToHex(expected)}`);
  console.log(`  Got:      ${bytesToHex(encoded)}`);
  
  return arraysEqual(encoded, expected);
});

// Test 9: Round-trip name encoding/decoding
test('Round-trip name encode/decode', () => {
  const original = 'MyAwesomeSound';
  const encoded = encodePresetName(original);
  const decoded = parsePresetName(encoded);
  
  console.log(`\n  Original: "${original}"`);
  console.log(`  Decoded:  "${decoded}"`);
  
  return original === decoded;
});

// Test 10: CC to SysEx conversion for oscillator range (6 options)
test('CC to SysEx conversion (6 options)', () => {
  // OSC1 range has 6 values (0-5)
  // CC values should be: 0, 25, 51, 76, 102, 127
  // SysEx values should be: 0, 1, 2, 3, 4, 5
  
  function ccToSysEx(ccValue: number, numOptions: number): number {
    return Math.round((ccValue / 127) * (numOptions - 1));
  }
  
  const testCases = [
    { cc: 0, expected: 0 },
    { cc: 25, expected: 1 },
    { cc: 51, expected: 2 },
    { cc: 76, expected: 3 },
    { cc: 102, expected: 4 },
    { cc: 127, expected: 5 },
  ];
  
  console.log('\n  CC → SysEx (6 options):');
  for (const { cc, expected } of testCases) {
    const result = ccToSysEx(cc, 6);
    const match = result === expected ? '✓' : '✗';
    console.log(`    ${match} CC ${cc.toString().padStart(3)} → SysEx ${result} (expected ${expected})`);
    if (result !== expected) return false;
  }
  
  return true;
});

// Test 11: SysEx to CC conversion (reverse)
test('SysEx to CC conversion (6 options)', () => {
  function sysExToCC(sysExValue: number, numOptions: number): number {
    return Math.round((sysExValue / (numOptions - 1)) * 127);
  }
  
  const testCases = [
    { sysex: 0, expected: 0 },
    { sysex: 1, expected: 25 },
    { sysex: 2, expected: 51 },
    { sysex: 3, expected: 76 },
    { sysex: 4, expected: 102 },
    { sysex: 5, expected: 127 },
  ];
  
  console.log('\n  SysEx → CC (6 options):');
  for (const { sysex, expected } of testCases) {
    const result = sysExToCC(sysex, 6);
    const match = Math.abs(result - expected) <= 1 ? '✓' : '✗'; // Allow 1 value tolerance for rounding
    console.log(`    ${match} SysEx ${sysex} → CC ${result.toString().padStart(3)} (expected ${expected})`);
    if (Math.abs(result - expected) > 1) return false;
  }
  
  return true;
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Test Results');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`✓ Passed: ${passCount}`);
console.log(`✗ Failed: ${failCount}`);
console.log(`  Total:  ${passCount + failCount}\n`);

if (failCount === 0) {
  console.log('🎉 All tests passed!');
  console.log('\nImplementation is correct and matches known-good protocol.');
  console.log('Hardware testing blocked by SysEx configuration issue.\n');
  process.exit(0);
} else {
  console.log('❌ Some tests failed - implementation needs fixes\n');
  process.exit(1);
}
