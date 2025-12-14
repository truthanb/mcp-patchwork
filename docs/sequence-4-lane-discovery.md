# Sequence Format Discovery - 4-Lane Structure

## MAJOR BREAKTHROUGH! 🎉

The MicroFreak sequence format uses a **4-lane structure** per step!

## Structure

Each 32-byte chunk (1 step) contains:

```
Byte[0]:  Flags/mode
Byte[1]:  Lane A value (0-127)
Byte[2-8]: Lane A metadata?
Byte[9]:  Gate (0=ON, 127=OFF)
Byte[10]: Lane B value (0-127)
Byte[11-15]: Lane B metadata?
Byte[16]: Unknown
Byte[17-18]: Usually 0
Byte[19]: Lane C value (0-127)
Byte[20-23]: Lane C metadata?
Byte[24]: Flags
Byte[25-27]: Lane D metadata?
Byte[28]: Lane D value (0-127)
Byte[29-31]: Padding/end markers
```

## The 4 Lanes

Each step can contain up to **4 values** at positions:
- **Lane A**: byte[1]
- **Lane B**: byte[10] ← This is the main note!
- **Lane C**: byte[19]
- **Lane D**: byte[28]

## What Are These Lanes?

### Theory 1: Modulation Lanes
MicroFreak sequencer supports recording modulation per step. These could be:
- Lane A: Modulation 1 (e.g., Filter cutoff)
- Lane B: Main note pitch
- Lane C: Modulation 2 (e.g., Pressure)
- Lane D: Modulation 3 (e.g., Wave)

### Theory 2: Chord/Arpeggio Data
The sequencer might store chord notes:
- All 4 lanes = notes → arpeggio
- Only Lane B = note → monophonic

### Theory 3: Mixed Usage
- Lane B: Always the main note
- Lanes A, C, D: Modulation or velocity or other parameters

## Evidence

From preset 232 analysis:

**Step 2 (gate ON):**
- A=95 (note G#6) ♪
- B=40 (note E2) ♪ ← Main note
- C=88 (note E5) ♪
- D=36 (note C2) ♪

**Step 3 (gate ON but no notes):**
- A=127 (empty)
- B=1 (not a note)
- C=127 (empty)
- D=1 (not a note)

**Step 4 (gate ON):**
- A=41 (note F2) ♪
- B=86 (note D5) ♪ ← Main note
- C=40 (note E2) ♪
- D=85 (note C#5) ♪

## Pattern Observations

1. **When all 4 lanes have notes (36-96):**
   - Step is active and playing
   - Might be chord or modulation data

2. **When lanes have 1 or 127:**
   - Lane is inactive/empty
   - `127` = default/off
   - `1` = minimal value (not a note)

3. **Lane B is special:**
   - Most consistently contains the main note
   - When other lanes are empty, B still has the note

## Next Steps

1. **Check MicroFreak manual** for sequencer features:
   - Can it record modulation per step?
   - Does it support chords in sequences?
   - What are the 4 modulation lanes?

2. **Decode the metadata bytes** between lane values:
   - Bytes 2-8 (after Lane A)
   - Bytes 11-15 (after Lane B)
   - Bytes 20-23 (after Lane C)
   - Bytes 25-27 (after Lane D)

3. **Test hypothesis:**
   - Create sequence with modulation recorded
   - Create sequence with just notes
   - Compare binary data

## Impact on Encoder/Decoder

We need to update the code to support:
```typescript
interface SequenceStep {
  // Main note (Lane B)
  note?: number;
  
  // Modulation lanes (Lanes A, C, D)
  mod1?: number;  // Lane A
  mod2?: number;  // Lane C
  mod3?: number;  // Lane D
  
  // Or if it's chords:
  notes?: number[];  // All 4 lanes
  
  gate?: boolean;
}
```

This is a significant discovery that explains why we saw note-range values in multiple positions!
