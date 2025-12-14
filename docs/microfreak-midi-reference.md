# Arturia MicroFreak MIDI Reference

Complete MIDI CC and NRPN reference for the Arturia MicroFreak synthesizer.

## Quick CC Reference

| Parameter | CC# | Range | Section | Description |
|-----------|-----|-------|---------|-------------|
| **Glide** | 5 | 0-127 | General | Portamento/glide time |
| **Oscillator Type** | 9 | 0-127 | Oscillator | Select oscillator type |
| **Wave** | 10 | 0-127 | Oscillator | Waveform selection |
| **Timbre** | 12 | 0-127 | Oscillator | Timbral character |
| **Shape** | 13 | 0-127 | Oscillator | Waveform shape |
| **Filter Cutoff** | 23 | 0-127 | Filter | Low-pass filter cutoff frequency |
| **Filter Amount** | 26 | 0-127 | Envelope | Envelope modulation to filter |
| **Cycling Env Hold** | 28 | 0-127 | Cycling Envelope | Hold time |
| **Envelope Sustain** | 29 | 0-127 | Envelope | Sustain level |
| **Filter Resonance** | 83 | 0-127 | Filter | Filter resonance/Q |
| **ARP/SEQ Rate (free)** | 91 | 0-127 | Arpeggiator/Sequencer | Free-running tempo |
| **ARP/SEQ Rate (sync)** | 92 | 0-127 | Arpeggiator/Sequencer | Tempo-synced rate |
| **LFO Rate (free)** | 93 | 0-127 | LFO | Free-running LFO speed |
| **LFO Rate (sync)** | 94 | 0-127 | LFO | Tempo-synced LFO rate |
| **Cycling Env Rise** | 102 | 0-127 | Cycling Envelope | Attack/rise time |
| **Cycling Env Fall** | 103 | 0-127 | Cycling Envelope | Decay/fall time |
| **Cycling Env Amount** | 24 | 0-127 | Cycling Envelope | Modulation amount |
| **Envelope Attack** | 105 | 0-127 | Envelope | Attack time |
| **Envelope Decay** | 106 | 0-127 | Envelope | Decay time |
| **Keyboard Hold** | 64 | 0-127 | Keyboard | Hold button toggle (sustain pedal) |
| **Keyboard Spice** | 2 | 0-127 | Keyboard | Spice/dice randomization |

## Oscillator Type Mapping (CC 9)

22 oscillator types evenly distributed across 0-127 (step size ≈6.05):

| Position | Oscillator Type | CC Value | Description |
|----------|----------------|----------|-------------|
| 0 | BasicWaves | 0 | Basic waveforms with morphing |
| 1 | SuperWave | 6 | Supersaw-style detuned oscillators |
| 2 | Wavetable | 12 | Wavetable synthesis |
| 3 | Harmo | 18 | Harmonic oscillator |
| 4 | KarplusStr | 24 | Karplus-Strong string synthesis |
| 5 | V.Analog | 30 | Virtual analog oscillator |
| 6 | Waveshaper | 36 | Waveshaping synthesis |
| 7 | TwoOpFM | 42 | Two-operator FM synthesis |
| 8 | Formant | 48 | Formant synthesis |
| 9 | Chords | 55 | Chord generator |
| 10 | Speech | 61 | Speech synthesis |
| 11 | Modal | 67 | Modal/physical modeling synthesis |
| 12 | Noise | 73 | Noise generator |
| 13 | Bass | 79 | Bass-optimized oscillator |
| 14 | SawX | 85 | Extended sawtooth oscillator |
| 15 | HarmNE | 91 | Noise Engineering Harmonic oscillator |
| 16 | WaveUser | 97 | User wavetable |
| 17 | Sample | 103 | Sample playback |
| 18 | ScanGrains | 109 | Scanning granular synthesis |
| 19 | CloudGrains | 115 | Cloud granular synthesis |
| 20 | HitGrains | 121 | Hit granular synthesis |
| 21 | Vocoder | 127 | Vocoder |

## Oscillator Parameters by Type

Wave (CC 10), Timbre (CC 12), and Shape (CC 13) control different parameters for each oscillator:

| Oscillator | Wave | Timbre | Shape |
|------------|------|--------|-------|
| BasicWaves | Morph | Sym | Sub |
| SuperWave | Wave (saw/square/triangle/sinus) | Detune | Volume |
| Wavetable | Table | Position | Chorus |
| Harmo | Content | Sculpting | Chorus |
| KarplusStr | Bow | Position | Decay |
| V.Analog | Detune | Shape | Wave |
| Waveshaper | Wave | Amount | Asym |
| TwoOpFM | Ratio | Amount | Feedback |
| Formant | Interval | Formant | Shape |
| Chords | Type (oct/5/sus4/m/m7/m9/m11/69/M9/M7/M) | Inv/Trsp | Waveform |
| Speech | Type | Timbre | Word |
| Modal | Inharm | Timbre | Decay |
| Noise | Type | Rate | Balance |
| Bass | Saturate | Fold | Noise |
| SawX | SawMod | Shape | Noise |
| HarmNE | Spread | Rectify | Noise |
| WaveUser | Table | Position | Bitdepth |
| Sample | Start | Length | Loop |
| ScanGrains | Scan | Density | Chaos |
| CloudGrains | Start | Density | Chaos |
| HitGrains | Start | Density | Shape |
| Vocoder | Start | Density | Shape |

## Modulation Matrix (NRPN)

The modulation matrix routes 5 sources to 7 destinations using NRPN messages.

### Modulation Sources

1. **CyclingEnv** - Cycling envelope (looping ADSR)
2. **Envelope** - Standard ADSR envelope
3. **LFO** - Low frequency oscillator
4. **Pressure** - Keyboard aftertouch/pressure
5. **Keyboard** - Keyboard tracking

### Modulation Destinations

1. **Pitch** - Oscillator pitch
2. **Wave** - Waveform parameter
3. **Timbre** - Timbral parameter
4. **Cutoff** - Filter cutoff frequency
5. **Assign1** - Matrix assign 1
6. **Assign2** - Matrix assign 2
7. **Assign3** - Matrix assign 3

### NRPN Mapping

Each modulation routing has a unique NRPN address (260-406 range):

**Format:** NRPN MSB (CC 99) = 1, NRPN LSB (CC 98) = routing address

**Routing addresses:**
- CyclingEnv → Pitch: 260
- CyclingEnv → Wave: 261
- CyclingEnv → Timbre: 262
- CyclingEnv → Cutoff: 263
- CyclingEnv → Assign1: 264
- CyclingEnv → Assign2: 265
- CyclingEnv → Assign3: 266
- Envelope → Pitch: 267
- ... (continues for all 35 combinations)

**Value Range:** 0-16383 (14-bit)
- 0 = -100% modulation
- 8192 = 0% (no modulation)
- 16383 = +100% modulation

**NRPN Message Sequence:**
1. CC 99 (NRPN MSB) = 1
2. CC 98 (NRPN LSB) = routing address
3. CC 6 (Data MSB) = value bits 7-13
4. CC 38 (Data LSB) = value bits 0-6

## MCP Tools Usage

### list_synths
Lists all connected synthesizers.

```json
{
  "name": "list_synths"
}
```

### describe_synth
Get detailed capabilities including oscillator types, mod matrix, and parameters.

```json
{
  "name": "describe_synth",
  "arguments": {
    "synthId": "microfreak-1"
  }
}
```

### set_param
Set a normalized parameter (0.0-1.0).

```json
{
  "name": "set_param",
  "arguments": {
    "synthId": "microfreak-1",
    "param": "filter.cutoff",
    "value": 0.7
  }
}
```

Available parameters:
- `osc.wave`, `osc.shape`
- `filter.cutoff`, `filter.resonance`
- `env.amp.attack`, `env.amp.decay`, `env.amp.sustain`
- `env.filter.attack`, `env.filter.decay`, `env.filter.sustain`
- `lfo1.rate`

### set_synth_feature
Set oscillator type or filter type.

```json
{
  "name": "set_synth_feature",
  "arguments": {
    "synthId": "microfreak-1",
    "feature": "oscillatorType",
    "value": "Modal"
  }
}
```

### set_modulation
Route modulation source to destination with bipolar amount.

```json
{
  "name": "set_modulation",
  "arguments": {
    "synthId": "microfreak-1",
    "source": "LFO",
    "destination": "Cutoff",
    "amount": 0.85
  }
}
```

Amount range: -1.0 to 1.0 (negative values invert modulation)

### init
Reset synth to baseline state (zeros modulations, opens filter, neutral envelopes).

```json
{
  "name": "init",
  "arguments": {
    "synthId": "microfreak-1"
  }
}
```

### load_preset
Load a preset from slot number (0-127).

```json
{
  "name": "load_preset",
  "arguments": {
    "synthId": "microfreak-1",
    "slot": 42
  }
}
```

### dump_preset
Read a complete preset from a specific slot via SysEx. Returns preset metadata including name, category, firmware version, and whether the format is supported. Useful for inspecting existing presets.

```json
{
  "name": "dump_preset",
  "arguments": {
    "synthId": "microfreak-1",
    "slot": 100
  }
}
```

Note: Reading a preset takes ~2-3 seconds as it requests 146 data chunks via SysEx.

### scan_presets
Scan all 256 preset slots and return metadata for each (name, category, empty status). Much faster than dumping full presets as it only reads names.

```json
{
  "name": "scan_presets",
  "arguments": {
    "synthId": "microfreak-1"
  }
}
```

Note: Scanning all presets takes ~1 minute. Results show which slots are empty/unused.

### find_empty_slots
Find all empty preset slots (INIT patches or uncategorized presets) that are safe to overwrite. Returns an array of slot numbers.

```json
{
  "name": "find_empty_slots",
  "arguments": {
    "synthId": "microfreak-1"
  }
}
```

Useful workflow: Find empty slot → Load it → Init → Build sound → Manually save

## Sound Design Examples

### Dubstep Wobble Bass
```typescript
// Set to Modal oscillator for physical modeling
await set_synth_feature("oscillatorType", "Modal");

// Short amp envelope for punch
await set_param("env.amp.attack", 0.0);
await set_param("env.amp.decay", 0.3);
await set_param("env.amp.sustain", 0.0);

// Filter starting position
await set_param("filter.cutoff", 0.4);
await set_param("filter.resonance", 0.7);

// LFO wobble on filter cutoff
await set_modulation("LFO", "Cutoff", 0.85);
```

### Bright Pad
```typescript
// Open filter
await set_param("filter.cutoff", 0.7);
await set_param("filter.resonance", 0.24);

// Slow attack, sustained envelope
await set_param("env.amp.attack", 0.47);
await set_param("env.amp.decay", 0.63);
await set_param("env.amp.sustain", 0.79);
```

### Kick Drum
```typescript
// Modal oscillator for tight sound
await set_synth_feature("oscillatorType", "Modal");

// Fast attack, short decay
await set_param("env.amp.attack", 0.0);
await set_param("env.amp.decay", 0.15);
await set_param("env.amp.sustain", 0.0);

// Dark filter with transient click
await set_param("filter.cutoff", 0.3);
await set_modulation("Envelope", "Pitch", -0.35);  // Pitch drop
await set_modulation("Envelope", "Cutoff", 0.5);    // Filter click
```

## Tips

1. **Normalized Values**: All parameter values are 0.0-1.0, converted to appropriate CC (0-127) or NRPN (0-16383) ranges
2. **Bipolar Modulation**: Modulation amounts are -1.0 to 1.0 for inverted/positive routing
3. **NRPN Precision**: NRPN provides 14-bit resolution (16384 values) vs CC's 7-bit (128 values)
4. **Mod Matrix**: Use `describe_synth` to see full mod matrix capabilities before routing
5. **Init First**: Call `init` before crafting new sounds to reset all modulations to neutral state

## SysEx Preset Dump/Load

### Message Format

**Arturia Manufacturer ID**: `0x00 0x20 0x6B` (extended format)  
**MicroFreak Device ID**: `0x07`

### Preset Name Request

```
F0 00 20 6B 07 01 [seq] 01 19 [bank] [preset] 00 F7
```

- `seq`: Sequence number (0x00)
- `bank`: 0 or 1
- `preset`: 0-127

### Preset Name Response

```
F0 00 20 6B 07 ... 52 ... [name] ... [category] ... F7
```

- Response type: `0x52`
- Name: ASCII string at offset +12, null-terminated
- Category: Byte at offset +19 (0-10)

### Preset Dump Request

```
F0 00 20 6B 07 01 01 01 19 [bank] [preset] 01 F7
```

### Preset Data Chunk Request

```
F0 00 20 6B 07 01 [chunk] 01 18 00 F7
```

- `chunk`: Chunk number (0-145)
- Must be called 40 times minimum, 146 times for complete dump
- Wait 15ms between requests

### Preset Data Response

```
F0 00 20 6B 07 ... [0x16|0x17] ... [32 bytes data] ... F7
```

- Response type: `0x16` or `0x17`
- Data chunk: 32 bytes starting at offset +8
- Total message length: 42 bytes

### Implementation Notes

1. **Reading Sequence**:
   - Send name request
   - Wait 15ms for response
   - Send dump request
   - Wait 15ms
   - Send 40-146 data chunk requests (one at a time, 15ms between each)
   - Parse responses to build complete preset

2. **Firmware Detection**:
   - FW1: `data[0][12] === 0x0C`
   - FW2: Otherwise (current firmware)

3. **Format Support**:
   - Some old factory presets use unsupported mod matrix format
   - Check: `data[16][-7:]` and `data[17][:4]` for specific pattern

4. **Writing Presets**:
   - Not yet documented/implemented
   - Requires understanding complete SysEx write protocol
   - High risk of corrupting synth memory

## References

- [MicroFreak Manual v5.0](https://www.arturia.com/support/downloads&manuals)
