# patchwork
**Tell your synth what you want**

LLM-friendly MIDI control plane for synthesizers. Natural language → sound design through MCP (Model Context Protocol).

## Features

- **7 MCP Tools**: Complete synth control (list, describe, set params, modulation, presets, init)
- **NRPN Support**: 14-bit parameter control for smooth modulation amounts  
- **Full Mod Matrix**: 5 sources × 7 destinations = 35 routing possibilities
- **Dynamic Resources**: Synth capabilities exposed as MCP resources (param maps, MIDI reference)
- **Type-Safe**: Full TypeScript implementation with strict validation
- **Hardware-First**: Direct MIDI communication, no DAW required

## Quick Start

```bash
npm install
npm run build
npm run dev  # Starts MCP server on stdio
```

Connect via MCP client (Claude Desktop, etc.) and control your MicroFreak:

```typescript
// Create a kick drum
await init();  // Reset to clean state
await set_synth_feature("oscillatorType", "Modal");
await set_param("env.amp.decay", 0.15);
await set_param("filter.cutoff", 0.3);
await set_modulation("Envelope", "Pitch", -0.35);
await set_modulation("Envelope", "Cutoff", 0.5);
```

## Architecture

**patchwork** = MCP Server + SynthAdapter abstraction + Hardware MIDI

- **MCP Layer** (`src/mcp/`): 7 tools + 2 resources, stdio transport
- **Synth Abstraction** (`src/synth/`): Generic parameter interface, driver-agnostic
- **MIDI Layer** (`src/midi/`): CC + NRPN + SysEx message building, hardware port management
- **MicroFreak Driver** (`src/drivers/microfreak/`): 22 oscillator types, full mod matrix, param mappings, preset structure

## MCP Tools

| Tool | Purpose |
|------|---------|
| `list_synths` | List connected synthesizers |
| `describe_synth` | Get capabilities (oscillators, mod matrix, params) |
| `set_param` | Set normalized parameter (0.0-1.0) |
| `set_synth_feature` | Set oscillator/filter type |
| `set_modulation` | Route mod source → destination (-1.0 to 1.0) |
| `init` | Reset synth to baseline (zero mods, neutral envelopes) |
| `load_preset` | Load preset from slot (0-127) |

## MCP Resources

| Resource | Description |
|----------|-------------|
| `synth://<id>/params` | JSON param map with descriptions and tips |
| `synth://<id>/midi-reference` | Complete MIDI CC/NRPN reference with examples |

## Tests

```bash
npm test  # 20 tests: CC/NRPN conversion, normalization, clamping
```

## Status

- ✅ Full MicroFreak support (22 oscillators, mod matrix, presets)
- ✅ NRPN 14-bit modulation control
- ✅ SysEx protocol documented (preset dump/load structure)
- ✅ Sequence API abstraction (getSequence/setSequence)
- ✅ MCP resource exposure
- ✅ Type-safe parameter handling
- 🔄 SysEx input handling (reading preset dumps from hardware)
- 🔄 Sequence format reverse engineering (chunks 40-145)
- 🔄 Additional synth drivers (extensible via SynthAdapter)

## Documentation

- [MIDI Reference](docs/microfreak-midi-reference.md) - Complete CC/NRPN/SysEx reference
- [SysEx Implementation](docs/sysex-implementation.md) - Preset dump/load architecture
- [Sequence Reverse Engineering](docs/sequence-reverse-engineering.md) - Decoding chunks 40-145
- [Integration Summary](docs/integration-summary.md) - Research credits and comparisons

