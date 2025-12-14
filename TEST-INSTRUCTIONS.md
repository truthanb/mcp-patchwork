
# Test Sequence Instructions

## How to Test

1. Use Arturia MIDI Control Center to import these test sequences
2. Load each test into a preset slot on your MicroFreak
3. Play the sequence and observe what you hear/see
4. Report back what happens!

## Test Files

### test1-single-note.json
- **Simple C note test**
- 4 steps: C, rest, C, rest
- Should sound like: Beep... Beep... (single C4 note)

**Questions:**
- Does it play at all?
- Is it the right note (C/middle C)?

---

### test2-scale.json
- **C Major scale**
- 8 steps: C D E F G A B C
- Should sound like: Do Re Mi Fa Sol La Ti Do

**Questions:**
- Do all notes play correctly?
- Does it sound like a proper scale?

---

### test3-multilane.json
- **Testing the 4-lane structure**
- 4 steps, all playing C3 but with different lane configurations

**CRITICAL QUESTIONS:**
- **Step 1**: Only Lane B has note (C3) - normal sound?
- **Step 2**: All 4 lanes have notes - sounds different? Chord? Louder? More complex?
- **Step 3**: Only Lane B again - same as step 1?
- **Step 4**: Lane B=note, other lanes=non-note values - does it sound modulated?

This test will tell us if the 4 lanes are:
- Chord notes (you'd hear multiple notes)
- Modulation values (sound would change timbre/filter/etc)
- Something else

---

### test4-real-data.json
- **Copied from working preset 232**
- Uses actual MicroFreak sequence data
- Should definitely work if our parsing is correct

**Questions:**
- Does it play?
- Does it sound musical/correct?

---

## What to Report

For each test, please tell me:
1. **Does it play?** (Yes/No)
2. **What do you hear?** (notes, rhythm, sound quality)
3. **What do you SEE on the display?** (step numbers, note names, mod values)
4. **Anything unexpected?** (weird sounds, wrong notes, etc.)

## Why This Helps

Your feedback will tell us:
- If our basic encoding works (test 1-2)
- What the 4 lanes represent (test 3)
- If our chunk parsing is correct (test 4)

This will let us finish decoding the sequence format!
