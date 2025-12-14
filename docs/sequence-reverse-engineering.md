# MicroFreak Sequence Data Reverse Engineering

## Discovery

The microfreak-reader project **only reads 40 chunks** of preset data:
```javascript
// src/utils/midi.js
export const MESSAGES_TO_READ_FOR_PRESET = 40;  // we don't need to read a full and complete dump
```

However, the MIDI reference documentation states:
- **40 chunks minimum** - Sound parameters
- **146 chunks maximum** - Complete preset with sequence data

This means **chunks 40-145 contain the sequence/arpeggiator step data**!

## Sequence Data Location

**Sound Parameters:** Chunks 0-39 (1280 bytes)
- Oscillator, filter, envelope, mod matrix, etc.
- Fully documented in microfreak-reader

**Sequence Data:** Chunks 40-145 (3392 bytes) 
- **NOT documented** - this is the missing piece!
- Contains: note values, gates, slides, ties, modulation per step
- Up to 64 steps per sequence

## MicroFreak Sequencer Capabilities

Per MicroFreak manual:
- **64 steps maximum** per sequence
- Per-step parameters:
  - **Note** (pitch)
  - **Gate** (on/off)
  - **Slide/Glide** (legato transition)
  - **Modulation** (per-step mod amount)
- **4 modulation destinations** (configurable)
- **Pattern length** (1-64 steps)
- **Swing** amount
- **Rate** (tempo/sync)

## Data Structure Hypothesis

With 106 additional chunks (3392 bytes) for sequences:

**Option 1: One byte per step parameter**
- 64 steps × 4 parameters = 256 bytes
- Leaves ~3100 bytes for other data (unlikely)

**Option 2: Packed bit flags**
- Note: 7 bits (0-127 MIDI)
- Gate: 1 bit (on/off)
- Slide: 1 bit (on/off)
- Mod: 7-14 bits (modulation amount)
- Total: ~3 bytes per step × 64 steps = ~192 bytes
- More realistic, leaves room for metadata

**Option 3: Hybrid approach**
- Multiple sequences stored (arp patterns?)
- Metadata (pattern length, mode, etc.)
- Actual note/gate/mod data

## Next Steps

### 1. Capture Full Preset Dumps

Use the built-in capture tool:

```bash
cd /Users/benjamintruthan/Documents/GitHub/patchwork

# Capture empty sequence (all gates off)
tsx scripts/capture-preset.ts 250 preset-empty.json

# Capture simple sequence (8-step C major scale)
tsx scripts/capture-preset.ts 251 preset-simple.json

# Capture complex sequence (random notes, slides, mods)
tsx scripts/capture-preset.ts 252 preset-complex.json
```

**Before capturing:**
1. Connect MicroFreak via USB
2. Program sequences into slots 250, 251, 252 on the device
3. Run capture script for each slot

### 2. Binary Comparison

Use hex diff tools to compare chunks 40-145:
```bash
# Export to hex
node -e "console.log(preset.data.slice(40).map(chunk => 
  chunk.map(b => b.toString(16).padStart(2,'0')).join(' ')
).join('\n'))" > sequence-empty.hex

node -e "..." > sequence-simple.hex
node -e "..." > sequence-complex.hex

# Diff
diff sequence-empty.hex sequence-simple.hex
```

### 3. Pattern Recognition

Look for:
- **Repeating structures** (64-byte blocks? 32-byte chunks?)
- **Note values** appearing where we programmed them
- **0x00 vs 0x7F** patterns (gates on/off?)
- **Bit patterns** matching slide/tie settings

### 4. Implement Encoder/Decoder

Once format is understood:

```typescript
// src/drivers/microfreak/sequence.ts

export interface SequenceStep {
  note: number;        // MIDI note 0-127
  gate: boolean;       // Step on/off
  slide: boolean;      // Glide to next note
  mod: number;         // Modulation amount (0-16383)
}

export interface MicroFreakSequence {
  steps: SequenceStep[];   // Up to 64 steps
  length: number;          // Active steps (1-64)
  swing: number;           // Swing amount
  mod1Dest: number;        // Mod destination 1
  mod2Dest: number;        // Mod destination 2
  mod3Dest: number;        // Mod destination 3
  mod4Dest: number;        // Mod destination 4
}

export function parseSequenceData(chunks: number[][]): MicroFreakSequence;
export function buildSequenceData(sequence: MicroFreakSequence): number[][];
```

### 5. Add MCP Tools

New tools for sequence programming:

```typescript
// Set sequence step data
mcp_patchwork_set_sequence({
  steps: [
    { note: 36, gate: true, slide: false, mod: 0 },   // C2
    { note: 39, gate: true, slide: false, mod: 0 },   // Eb2
    { note: 43, gate: true, slide: true, mod: 8192 }, // G2 with slide
    // ...
  ],
  length: 16,
  swing: 0.5
});

// Load complete patch with sequence
mcp_patchwork_load_patch({
  sound: { oscillator: "V.Analog", filter: { cutoff: 0.2 } },
  sequence: { steps: [...], length: 16 }
});
```

## Success Criteria

✅ **Full capture** - Can read all 146 chunks from MicroFreak
✅ **Format identified** - Know where note/gate/slide/mod data lives  
✅ **Decoder working** - Can parse sequence from SysEx into our format
✅ **Encoder working** - Can build SysEx from our format
✅ **Write validated** - Can send sequence to MicroFreak and it plays correctly
✅ **MCP integrated** - AI can program complete patches WITH sequences

## Risk Assessment

**Low Risk:**
- Reading chunks 40-145 (read-only, won't corrupt synth)
- Analyzing binary data (offline)

**Medium Risk:**
- Writing sequences back to synth (could corrupt preset memory)
- Test on non-critical preset slots first!

**Mitigation:**
1. Back up all presets via official Arturia software first
2. Test writes on slot 255 (factory reset available)
3. Validate checksums (if any exist in protocol)
4. Compare round-trip dumps (read → parse → encode → write → read)

## Timeline Estimate

- **Capture dumps:** 30 minutes (modify reader, export 3-5 presets)
- **Binary analysis:** 2-4 hours (pattern recognition, hypothesis testing)
- **Implementation:** 4-6 hours (TypeScript encoder/decoder)
- **Testing:** 2-3 hours (validate against hardware)
- **MCP integration:** 1-2 hours (new tools, update docs)

**Total: 10-15 hours** of focused work

## Resources Needed

- MicroFreak connected via MIDI
- MIDI monitor software (for validation)
- Hex editor / diff tool
- Modified microfreak-reader for full dumps
- Test presets with known sequence content

## Questions to Answer

1. How many sequences per preset? (Just one? Or multiple patterns?)
2. Is mod matrix applied to sequence, or separate per-step mod?
3. What's the maximum note range? (Full MIDI 0-127 or limited?)
4. Are there undocumented features in sequence data?
5. Does sequence data include ratcheting/probability?

## Updates

_This document will be updated as we discover the sequence format._
