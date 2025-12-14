# Changelog

## [Unreleased] - 2025-12-14

### Added - SysEx Foundation
- **SysEx Message Utilities** (`src/midi/sysex.ts`): Generic builder/parser, Arturia helpers, MicroFreak preset requests
- **Hardware Port SysEx**: `sendSysEx()` method with format validation  
- **Preset Module** (`src/drivers/microfreak/preset.ts`): Preset structure, dump/load framework, firmware detection
- **SysEx Documentation**: Complete protocol reference in MIDI docs, implementation guide

### Added - Oscillator Coverage
- **MIDI Reference Resource**: Complete CC and NRPN documentation exposed as `synth://<id>/midi-reference` MCP resource
- **Wavetable Oscillator**: Added missing oscillator type (position 2, CC 12)
- **HarmNE Oscillator**: Added Noise Engineering Harmonic oscillator (position 15, CC 91)
- **Comprehensive Documentation**: Created `docs/microfreak-midi-reference.md` with:
  - Full CC reference table
  - 22 oscillator types with accurate CC mappings
  - Oscillator parameter matrix (Wave/Timbre/Shape per type)
  - Modulation matrix NRPN reference
  - MCP tool usage examples
  - Sound design recipes (wobble bass, pad, kick drum)
  - SysEx preset dump/load protocol
  - Tips for normalized values and modulation


