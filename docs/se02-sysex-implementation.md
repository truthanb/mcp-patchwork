# SE-02 SysEx Implementation Plan

## Overview

This document captures the reverse-engineered Roland SE-02 SysEx protocol for preset dumps and system communication. Information gathered from Studio Electronics SE-02 Editor and community reverse engineering efforts.

## SysEx Protocol Structure

### Header Format
```
F0 41 10 00 00 00 44 [CMD] [DATA...] [CHECKSUM] F7

F0     = SysEx start
41     = Roland manufacturer ID
10     = Device ID (configurable on SE-02)
00 00 00 44 = Model ID for SE-02
[CMD]  = Command byte (11 = RQ1 request, 12 = DT1 data transfer)
[DATA] = Address + data bytes
[CHECKSUM] = Roland checksum (before F7)
F7     = SysEx end
```

### Commands
- `11` = RQ1 (Request data)
- `12` = DT1 (Data transfer/response)

## System Information Queries

The SE-02 editor queries these on startup:

| Query | Address | Response Size | Contains |
|-------|---------|---------------|----------|
| Firmware Version | `03 00 00 00` | 18 bytes | Version string (e.g., "1.11") |
| MIDI Channel | `03 03 00 00` | 18 bytes | Current MIDI channel (1-16) |
| MIDI Thru Setting | `08 00 00 00` | 18 bytes | MIDI thru on/off |

Example request:
```
F0 41 10 00 00 00 44 11 03 00 00 00 [SIZE] [CHECKSUM] F7
```

## Preset Dump Format

### Triggering a Dump

Send Program Change to load a preset, then request 4 SysEx messages:

```javascript
// Load preset
midi.sendProgramChange(channel, presetNumber);

// Request 4 parts of edit buffer
midi.sendSysex([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x00, 0x00, checksum, 0xF7]);
midi.sendSysex([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x00, 0x40, checksum, 0xF7]);
midi.sendSysex([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x01, 0x00, checksum, 0xF7]);
midi.sendSysex([0xF0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x44, 0x11, 0x05, 0x00, 0x01, 0x40, checksum, 0xF7]);
```

### Edit Buffer Structure

The edit buffer is split into 4 parts:

| Part | Address | Response Size | Contents |
|------|---------|---------------|----------|
| 1 | `05 00 00 00` | 78 bytes | Primary parameters (CC values, waveforms) |
| 2 | `05 00 00 40` | 78 bytes | Additional parameters |
| 3 | `05 00 01 00` | 78 bytes | Modulation settings |
| 4 | `05 00 01 40` | 62 bytes | Preset name + metadata |

**Total size: 296 bytes** (78 + 78 + 78 + 62)

### Preset Name Encoding

Preset names are 16 characters, ASCII encoded.

Example from dump:
```
49 6E 62 6F 75 6E 64 = "Inbound"
```

Found in part 4 (second-to-last row of SysEx response).

## Value Conversion Challenges

### Problem 1: CC vs SysEx Value Ranges

**Selection parameters** (waveforms, modes) have different representations:

- **In SysEx**: Stored as `0...(numOptions-1)`
  - Example: 5 waveforms = values 0-4
  
- **Via MIDI CC**: Spread across full CC range `0-127`
  - Example: 5 waveforms mapped to 0, 25, 51, 76, 102, 127

**Conversion functions needed:**
```typescript
function ccToSysEx(ccValue: number, numOptions: number): number {
  // Convert 0-127 CC to 0-(numOptions-1)
  return Math.round((ccValue / 127) * (numOptions - 1));
}

function sysExToCC(sysExValue: number, numOptions: number): number {
  // Convert 0-(numOptions-1) to 0-127 CC
  return Math.round((sysExValue / (numOptions - 1)) * 127);
}
```

### Problem 2: Bit-Packing

**Roland uses bit-packing** - parameters are NOT byte-aligned!

Example: **Parameter 81 "Contour Sensitivity"** (7 bits total)
- First 4 bits: Byte 9, bit position 0
- Next 3 bits: Byte 8, bit position 0

This is common throughout the preset structure. **Each parameter needs explicit bit mapping.**

Example parameter descriptor (from Electra One editor):
```json
{
  "parameterNumber": 81,
  "type": "cc7",
  "byte": 9,
  "bitWidth": 4,
  "byteBitPosition": 0,
  "parameterBitPosition": 0
},
{
  "parameterNumber": 81,
  "type": "cc7",
  "byte": 8,
  "bitWidth": 3,
  "byteBitPosition": 0,
  "parameterBitPosition": 4
}
```

### Problem 3: Bidirectional Sync

When receiving CC changes via MIDI, must convert back to SysEx values before storing in parameter map. The Electra One editor uses `midi.onControlChange` handler for this.

## Implementation Phases

### Phase 1: Basic SysEx Infrastructure ✅ (Ready to implement)

**Goal**: Get raw preset bytes from SE-02

1. Add SysEx send/receive to `HardwareMidiPort`
2. Implement Roland checksum calculation
3. Implement `dumpPreset()` in SE-02 driver:
   - Send Program Change
   - Request 4 SysEx parts
   - Concatenate responses
   - Return raw `Uint8Array` (296 bytes)
4. Update capabilities: `supportsPresetDump: true`

**Use cases**:
- Backup all presets to disk
- Compare preset dumps (diff tool)
- Archive sound libraries

### Phase 2: Simple Parameter Extraction

**Goal**: Extract easily-parsable values

1. Parse preset name from part 4
2. Extract byte-aligned parameters (if any exist)
3. Create JSON representation with known fields

**Use cases**:
- Display preset name
- Compare parameter differences between presets
- Search presets by parameter ranges

### Phase 3: Full Bit-Packed Parsing (Future)

**Goal**: Complete parameter extraction

1. Port Electra One editor's parameter mapping
2. Implement bit-packing/unpacking utilities
3. Convert all 70+ CCs from SysEx data
4. Handle CC↔SysEx value conversions

**Use cases**:
- Full preset analysis
- Generate parameter descriptions from presets
- Preset morphing/interpolation
- Sound design recommendations

### Phase 4: Preset Writing (Future)

**Goal**: Write presets back to SE-02

1. Reverse the dump process (DT1 commands)
2. Pack parameters into bit-packed format
3. Calculate checksums
4. Write to edit buffer
5. Optional: Save to preset slot

**Use cases**:
- Preset librarian (write back to hardware)
- Algorithmic preset generation
- Preset randomization

## Reference Implementation

The **Electra One SE-02 editor** has already solved this:
- Parameter bit mapping (JSON format)
- CC ↔ SysEx conversion functions (Lua)
- Full preset parsing and writing

**Location**: Studio Electronics Electra One editor for SE-02

**Key files**:
- Parameter mapping JSON (byte/bit positions)
- `choicerr()` function (value conversion)
- `midi.onControlChange` handler (bidirectional sync)

## Next Steps

1. Start with Phase 1 implementation
2. Create test script to dump a preset and save to file
3. Compare dumps with known presets
4. Validate checksum calculation
5. Test with multiple preset banks

## Technical Notes

### Roland Checksum Algorithm

Roland uses a simple checksum:
```
checksum = 128 - ((sum of data bytes) % 128)
```

Must be calculated for both requests and responses.

### SysEx Response Timing

After sending a request, wait for SysEx response:
- Typical response time: 50-100ms per message
- For 4-part dump: ~200-400ms total
- Add timeout handling (suggest 1000ms per message)

### Device ID Considerations

Default device ID is `0x10`, but users can change this:
- Query system info first to detect actual device ID
- Or make it configurable in driver options

### MIDI Channel Awareness

SE-02 only responds on its configured MIDI channel:
- Must send Program Change on correct channel
- SysEx uses device ID, not channel
- Query MIDI channel via SysEx if unknown

## Related Documents

- [SE-02 MIDI Reference](./se02-midi-reference.md) - Complete CC mapping
- [MicroFreak MIDI Reference](./microfreak-midi-reference.md) - Reference implementation for SysEx

## Open Questions

1. Can we write to preset slots directly, or only to edit buffer?
2. Is there a bulk dump command for all 128 presets?
3. What happens if we request a preset while the sequencer is running?
4. Are there undocumented SysEx commands?
