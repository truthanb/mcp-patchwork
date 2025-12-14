# Development Journey

## Project Vision

Enable AI-assisted hardware synthesizer control through a clean, extensible MCP interface. Allow AI to create sounds by controlling parameters semantically ("make it brighter", "add wobble") without knowing MIDI implementation details.

## Phase 1: Foundation & MIDI Control

**Goal:** Establish basic parameter control for MicroFreak

### Initial Setup
- Created TypeScript project structure
- Integrated `@modelcontextprotocol/sdk` for MCP server
- Set up `midi` (node-midi) for hardware communication
- Established testing framework (vitest)

### MicroFreak Driver
- Implemented basic CC (Control Change) parameter control
- Discovered `nanassound/midi_ctrl` library had accurate oscillator mappings
- Corrected 22 oscillator types with proper CC values
- Created canonical parameter abstraction (`filter.cutoff`, `env.amp.attack`, etc.)

### Critical Discovery: NRPN for Mod Matrix
- Found modulation matrix requires 14-bit NRPN (Non-Registered Parameter Numbers)
- Implemented NRPN support in hardware MIDI port
- Mapped all mod sources and destinations
- Achieved precise modulation control (16,384 values vs 128 with CC)

**Result:** Full real-time parameter control working via MCP tools

## Phase 2: SysEx & Preset Management

**Goal:** Add preset loading and advanced features

### SysEx Protocol Research
- Studied Arturia SysEx format: `F0 00 20 6B 07 ...`
- Manufacturer ID: `00 20 6B` (Arturia)
- Device ID: `07` (MicroFreak)
- Implemented preset dump request messages
- Discovered 146-chunk structure (32 bytes each)

### Preset Loading
- Implemented Program Change for preset selection
- Added `load_preset` MCP tool
- Tested with factory presets (1-256)

### Init/Reset Functionality
- Created `init` tool to reset synth to clean state
- Zeros all modulation sources
- Opens filter to neutral position
- Sets reasonable envelope defaults
- Provides consistent starting point for AI sound design

**Result:** Preset management and baseline reset working

## Phase 3: Sequence Reverse Engineering

**Goal:** Understand and decode MicroFreak sequence format

### Discovery: Sequence Data Location
- Initially used `microfreak-reader` library (only read 40 chunks)
- MicroFreak manual revealed full preset = 146 chunks
- **Chunks 0-39:** Sound parameters (1,280 bytes)
- **Chunks 40-69:** Padding/metadata (960 bytes)
- **Chunks 70-145:** Sequence data (2,432 bytes) ← Found it!

### .mbp File Analysis
- User exported presets via MIDI Control Center
- Files use Boost serialization format
- Created parser: `scripts/parse-mbp.ts`
- Extracted all 146 chunks from multiple presets
- Parsed presets: 001, 100, 150, 200, 232

### Pattern Analysis
- Created `scripts/analyze-steps.ts` to find patterns
- Discovered each chunk = one sequencer step
- Found variance in specific byte positions
- Initial hypothesis: note data scattered throughout

### Breakthrough: 4-Lane Structure
- Created `scripts/analyze-4-lane-structure.ts`
- Compared multiple presets with known sequences
- **Discovered repeating pattern every 9 bytes**
- Identified 4 automation lanes:
  - **Lane A (byte[1]):** Modulation parameter 1
  - **Lane B (byte[10]):** Main note (MIDI 36-96)
  - **Lane C (byte[19]):** Modulation parameter 2
  - **Lane D (byte[28]):** Modulation parameter 3
  - **Gate (byte[9]):** 0=ON, 127=OFF

### Encoder/Decoder Implementation
- Implemented `encodeSequence()` in `sequence.ts`
- Implemented decoder (inline for testing)
- Created test: `scripts/test-4-lane-encoder.ts`
- **Validation Results:**
  - C major scale encoded correctly
  - Modulation values preserved (A=80, C=40, D=100)
  - Real preset (232) decoded successfully
  - Notes and mod values matched expectations

**Result:** Sequence format fully decoded and documented

## Phase 4: Sequence Writing Attempts

**Goal:** Send sequences to MicroFreak via MIDI

### Attempt 1: Direct SysEx Write
- Sent all 146 chunks with command `0x10`
- **Result:** Rapid blinking, corrupted state, couldn't stop playback
- **Learning:** Command `0x10` is not correct for preset write

### Attempt 2: Complete Preset with 0x17
- Tried command `0x17` (observed in responses)
- Sent complete preset (sound + sequence)
- **Result:** Same corrupted behavior
- **Learning:** Response codes don't work for writes

### Attempt 3: .mbp File Export
- Implemented `mbp-writer.ts` for MIDI Control Center import
- Created `ai-sequence.mbp` file
- **User Feedback:** Don't want manual import workflow
- **Learning:** Need fully automated solution

### Attempt 4: Load Preset + Overwrite Sequence
- Send Program Change to load preset into edit buffer
- Wait 100ms for load
- Send only sequence chunks (70-145) with `0x16`
- **Result:** "?" display, play button lit, no sound
- **Learning:** MicroFreak doesn't accept SysEx writes to edit buffer

### Conclusion: Sequence Writing Not Supported
- MicroFreak only supports SysEx **reads**, not **writes**
- Factory doesn't provide write protocol documentation
- MIDI Control Center likely uses USB protocol (not standard MIDI)
- **Decision:** Remove sequence writing from MCP tools

**Result:** Understood hardware limitations, sequence analysis capabilities retained

## Phase 5: MCP Tool Refinement

**Goal:** Polish and document working features

### Tool Suite (7 Tools)
1. **list_synths** - Hardware discovery
2. **describe_synth** - Capabilities and features
3. **set_param** - Normalized parameter control
4. **set_synth_feature** - Oscillator/filter type selection
5. **set_modulation** - Mod matrix routing
6. **init** - Reset to clean state
7. **load_preset** - Factory preset loading

### Sound Design Testing
- Created TB-303 acid bass patch via MCP
- **User tested on live hardware:** ✓ Working!
- Validated filter sweeps, resonance, envelope
- Confirmed modulation matrix routing
- Init tool provides consistent starting point

### Handler Improvements
- Added proper init before sequence operations
- Implemented error handling
- Standardized success/error responses
- Added helpful messages for users

**Result:** Stable, tested MCP interface for sound design

## Current State

### What Works ✅
- **Real-time parameter control** (CC and NRPN)
- **Modulation matrix routing** (14-bit precision)
- **Preset loading** (256 factory presets)
- **Init/reset functionality**
- **Oscillator type switching** (22 types)
- **Sequence analysis** (encoder/decoder for .mbp files)
- **Live hardware validation** (tested on actual MicroFreak)

### What Doesn't Work ❌
- **Direct sequence writing** (hardware limitation)
- **Preset saving** (no write protocol)
- **SysEx preset modification** (read-only)

### Technical Achievements
- **Complete MIDI reference** for MicroFreak
- **4-lane sequence format** reverse engineered
- **Normalized parameter abstraction** across hardware
- **Type-safe MCP interface** with Zod validation
- **Extensible architecture** for multi-synth support

## Lessons Learned

### 1. Hardware Limitations Are Real
- Not all synths support full MIDI spec
- Manufacturers often hide implementation details
- Read-only SysEx is common
- USB protocols may differ from MIDI

### 2. Reverse Engineering Process
- Start with documentation (manual, libraries)
- Export real data from official tools
- Compare multiple examples to find patterns
- Validate discoveries with encoding round-trips

### 3. Abstraction Pays Off
- Canonical parameters work across hardware
- Normalized values (0.0-1.0) simplify AI interface
- Driver pattern enables multi-synth support
- Type safety catches errors early

### 4. User Feedback Drives Direction
- Originally planned .mbp workflow
- User rejected manual import steps
- Discovered SysEx limitations together
- Pivoted to focus on working features

## Future Opportunities

### 1. Additional Hardware Support
**Candidates:**
- Moog Matriarch (MIDI CC and NRPN)
- Elektron Digitakt/Digitone (SysEx control)
- Teenage Engineering OP-1/OP-Z
- Modular CV interfaces (Expert Sleepers, etc.)

**Strategy:**
- Implement `SynthAdapter` for each device
- Research MIDI implementation chart
- Map canonical params to device-specific CCs
- Add to registry for multi-synth sessions

### 2. Real-Time Sequencing
**Alternative to writing sequences:**
- Send MIDI notes in real-time
- AI generates note patterns
- MCP tool plays them live
- User records on synth's sequencer

**Implementation:**
```typescript
play_sequence(steps: {note, duration}[])
  → sendNoteOn/NoteOff with timing
  → User presses RECORD on hardware
  → Sequence captured natively
```

### 3. Sound Design Templates
**Common starting points:**
- Bass (low cutoff, fast attack, saw wave)
- Lead (bright filter, portamento, square wave)
- Pad (slow attack, high sustain, multiple waves)
- Arp (short decay, no sustain, high brightness)

**Implementation:**
- Preset library in JSON
- AI can modify templates
- "Make a bass like this but brighter"

### 4. Preset Management Tools
- **Compare:** Load two presets, analyze differences
- **Morph:** Interpolate between preset A and B
- **Randomize:** Controlled randomization of params
- **Undo/Redo:** Track parameter change history

### 5. Advanced Mod Matrix
- **Templates:** Common routings (vibrato, wobble, filter sweep)
- **Compound:** Multiple sources → one destination
- **Visualization:** Current routing map
- **Suggestions:** AI recommends mod routings

### 6. Learning & Documentation
- **Parameter guides:** What each param does sonically
- **Sound design tips:** Embedded in tool responses
- **Genre-specific advice:** "For techno bass, try..."
- **Common mistakes:** "Resonance >0.8 can self-oscillate"

### 7. Integration Possibilities
- **DAW sync:** Tempo, transport control
- **MIDI clock:** Keep sequences in sync
- **Ableton Link:** Network tempo sync
- **OSC:** Alternative to MIDI for modular

### 8. Analysis Tools
- **Preset analyzer:** Describe sound characteristics
- **Similarity search:** Find presets like X
- **Parameter extraction:** Learn from user's patches
- **Usage patterns:** Which params change most?

## Technical Debt

### Testing
- Only CC conversion has unit tests
- Need integration tests for drivers
- Mock hardware adapter for CI/CD
- Sequence encoder/decoder tests

### Documentation
- ✅ Architecture doc (this file)
- ✅ Development journey (this file)
- Need: API reference for each tool
- Need: Sound design guide
- Need: Multi-synth setup guide

### Code Quality
- Some duplicate code in drivers
- Handler error messages could be more specific
- Parameter validation could be stricter
- Need consistent logging strategy

### Performance
- Batch parameter changes (use `setParams`)
- MIDI message throttling for rapid changes
- Async/await everywhere (could optimize)

## Community & Open Source

### Potential Contributions
- Additional synth drivers
- Better sequence analysis
- Sound design templates
- Documentation improvements
- Testing coverage

### What Makes This Valuable
- **MCP-native:** Works with Claude, AI tools
- **Hardware-focused:** Real synths, not VSTs
- **Extensible:** Clean driver pattern
- **Documented:** Reverse engineering findings
- **Type-safe:** TypeScript throughout

### Sharing Strategy
- Open source on GitHub
- Document driver interface clearly
- Provide template for new drivers
- Share sequence discoveries
- Build community around hardware MCP tools

## Reflections

### What Worked Well
- Iterative discovery process
- User collaboration on hardware testing
- Clear separation of concerns (layers)
- Type safety caught many bugs
- MCP abstraction feels natural

### What Was Challenging
- SysEx documentation scarce
- Reverse engineering requires patience
- Hardware limitations (no writes)
- Balancing abstraction vs specificity

### Key Decisions
1. **Normalized parameters:** Made AI interface simple
2. **NRPN for mod matrix:** Precision matters for modulation
3. **Driver pattern:** Future multi-synth support
4. **Drop sequence writing:** Hardware doesn't support it
5. **Focus on sound design:** Where the value is

### What We Built
A solid foundation for AI-assisted hardware synthesis. The sequence reverse engineering was fascinating but hit hardware limits. The parameter control and modulation routing work beautifully. The architecture supports future expansion to multiple synths. This is a great starting point for human-AI collaboration in electronic music production.

---

**Last Updated:** December 14, 2024  
**Status:** Active development, core features stable  
**Next Focus:** Additional synth drivers or sound design templates
