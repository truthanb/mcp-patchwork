# Hardware Test Plan - CREATE sequences on MicroFreak

## Better Approach!

Instead of trying to write sequences before we understand the format,
let's have YOU create simple test sequences on the MicroFreak,
then dump them so I can analyze the binary data.

## Test Sequences to Create

### Test 1: Single Note Pattern
**Steps:**
1. On MicroFreak, start with Init preset
2. Press SEQ button to enter sequencer mode
3. Program 4 steps:
   - Step 1: C3 (MIDI note 48)
   - Step 2: Rest (gate off)
   - Step 3: C3 again
   - Step 4: Rest
4. Save to preset slot 100
5. Export via MIDI Control Center as "test-single-note.mbp"

**What this tests:** Basic note + gate encoding

---

### Test 2: Simple Scale
**Steps:**
1. Program 8 steps:
   - C3, D3, E3, F3, G3, A3, B3, C4
   - (MIDI notes: 48, 50, 52, 53, 55, 57, 59, 60)
2. All gates ON
3. Save to preset slot 101
4. Export as "test-scale.mbp"

**What this tests:** Note value encoding

---

### Test 3: WITH Modulation
**This is the critical test for the 4-lane mystery!**

**Steps:**
1. Program 2 steps, both with same note (C3 / MIDI 48)
2. Step 1: NO modulation (just the note)
3. Step 2: RECORD modulation
   - While on step 2, move the **CUTOFF** knob (or another parameter)
   - This records per-step modulation
4. Save to preset slot 102
5. Export as "test-with-modulation.mbp"

**What this tests:** This will show us what the other 3 lanes are!
- If Lane A/C/D change when you add modulation, they're mod lanes
- If they don't change, they're something else

---

### Test 4: Multiple Modulation
**Steps:**
1. Program 1 step with note C3
2. Record modulation on MULTIPLE parameters:
   - Move CUTOFF while recording
   - Move WAVE while recording
   - Move RESONANCE while recording
3. Save to preset slot 103
4. Export as "test-multi-mod.mbp"

**What this tests:** How multiple modulation lanes are encoded

---

## How to Export

1. Connect MicroFreak to computer
2. Open Arturia MIDI Control Center
3. Click "Store" to read all presets from MicroFreak
4. Right-click on preset slots 100-103
5. "Export preset" → save as .mbp files
6. Send me the .mbp files!

## What I'll Do

Once you send me the .mbp files:
1. Parse them to extract all 146 chunks
2. Compare the binary data
3. See exactly what changes when you add modulation
4. Decode the 4-lane structure!

This way we'll know FOR SURE what each byte does because we control the input!
