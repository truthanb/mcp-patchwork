# patchwork
**Tell your synth what you want**

LLM-friendly MIDI control plane for synthesizers. Natural language → sound design through MCP (Model Context Protocol).

## Why Patchwork Exists

Patchwork started as a personal side project.

I own a few hardware synthesizers, but I don't use them constantly. Every time I pull one out after a break, I have to reload a completely different mental model: different layouts, different modulation schemes, different parameter names. Even when I know roughly what kind of sound I want, getting there can take longer than it should.

The idea behind Patchwork is simple:

**Instead of remembering how a synth works, describe what you want and let the system get you into the ballpark.**

Things like:
- "a soft evolving pad"
- "a darker, punchier bass"
- "more movement, less brightness"

Patchwork uses Model Context Protocol (MCP) as a control layer between an LLM and real hardware. The model reasons in terms of musical intent, while synth-specific drivers translate that intent into deterministic MIDI (CC, NRPN, SysEx) messages.

This is not a replacement for sound design knowledge, and it's not flawless. It won't perfectly recreate famous patches or guarantee a specific result. What it does well is reduce friction — getting close enough that you can start playing and tweaking instead of paging through manuals.

**Patchwork is intentionally focused on:**
- Intent-driven control
- Deterministic behavior
- Real hardware integration
- Clean abstractions over MIDI details

**It does not** generate audio, perform autonomously, or attempt to "make music for you."

## Features

- **8 MCP Tools**: Complete synth control including preset inspection and modulation routing
- **Multi-Synth Support**: Drivers for Arturia MicroFreak and Roland SE-02
- **Advanced Parameter Control**: NRPN support for 14-bit precision on compatible synths
- **Full Modulation Matrix**: Complete mod routing control (MicroFreak: 5 sources × 7 destinations)
- **SysEx Preset Reading**: Dump and inspect presets from hardware (MicroFreak: 512 slots across 4 banks)
- **Dynamic Resources**: Synth capabilities exposed as MCP resources (param maps, MIDI reference)
- **Type-Safe**: Full TypeScript implementation with strict validation
- **Hardware-First**: Direct MIDI communication, no DAW required

## Installation

```bash
npm install -g mcp-patchwork
# or clone and build locally:
git clone https://github.com/truthanb/mcp-patchwork
cd patchwork
npm install
npm run build
```

## MCP Configuration

Configure the server in your MCP client's settings file:

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "patchwork": {
      "command": "npx",
      "args": ["-y", "mcp-patchwork"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "patchwork": {
      "command": "node",
      "args": ["dist/mcp/server.js"],
      "cwd": "/path/to/patchwork"
    }
  }
}
```

### VS Code (Copilot)

Edit `~/Library/Application Support/Code/User/mcp.json` (macOS) or `%APPDATA%\Code\User\mcp.json` (Windows):

```json
{
  "mcpServers": {
    "patchwork": {
      "command": "npx",
      "args": ["-y", "mcp-patchwork"]
    }
  }
}
```

### Other MCP Clients

Any MCP-compatible client can connect using the stdio transport:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-patchwork"]
}
```

After configuration, restart your MCP client. The patchwork tools should appear automatically when your MicroFreak is connected.

## Quick Start

Connect your synthesizer via MIDI and control it through any MCP client using natural language:

```
"Create a warm bass sound with slow filter modulation"
"Make a plucky lead with fast decay"  
"Set up a pad with LFO on the filter"
```

Or use the tools directly:

```typescript
// List connected synths
await list_synths();  // Returns available MicroFreak and/or SE-02

// Create a kick drum on MicroFreak
await init();  // Reset to clean state
await set_synth_feature("oscillatorType", "Modal");
await set_param("env.amp.decay", 0.15);
await set_param("filter.cutoff", 0.3);
await set_modulation("Envelope", "Pitch", -0.35);
await set_modulation("Envelope", "Cutoff", 0.5);

// Create a bass on SE-02
await set_param("osc1.waveform", 0.0);  // Sawtooth
await set_param("filter.cutoff", 0.3);
await set_param("filter.resonance", 0.6);
await set_param("env.amp.decay", 0.4);
```

## Supported Hardware

### Arturia MicroFreak
- **Type**: Digital hybrid synthesizer with analog filter
- **Oscillators**: 22 oscillator types (wavetable, physical modeling, modal, granular, etc.)
- **Modulation**: 5 sources × 7 destinations = 35 mod matrix routings
- **Presets**: 512 slots across 4 banks (full SysEx read/write support)
- **Control**: MIDI CC + 14-bit NRPN for smooth modulation amounts
- **Special Features**: Cycling envelope, paraphonic mode, pressure sensitivity

### Roland SE-02
- **Type**: Boutique analog monosynth (SH-101 heritage)
- **Oscillators**: 3 true analog oscillators with multiple waveforms
- **Filter**: 4-pole analog low-pass filter
- **Modulation**: Cross modulation, LFO with delay, comprehensive routing
- **Control**: MIDI CC for all parameters
- **Special Features**: Built-in delay, sub oscillator, noise generator, oscillator sync

### Extensibility
The `SynthAdapter` interface allows adding new synthesizers. Each driver provides:
- Parameter mapping (normalized 0.0-1.0 values to hardware MIDI)
- Synth-specific features (oscillator types, filter modes, etc.)
- Capabilities description (available parameters, modulation routing)
- Optional SysEx protocol implementation (preset dump/load)

## MCP Tools

| Tool | Purpose | MicroFreak | SE-02 |
|------|---------|------------|-------|
| `list_synths` | List connected synthesizers and their capabilities | ✅ | ✅ |
| `describe_synth` | Get detailed capabilities (oscillators, params, mod matrix) | ✅ | ✅ |
| `set_param` | Set normalized parameter (0.0-1.0) | ✅ | ✅ |
| `set_synth_feature` | Set oscillator/filter types and modes | ✅ | ✅ |
| `set_modulation` | Route mod source → destination (-1.0 to 1.0) | ✅ | ⚠️ |
| `init` | Reset synth to baseline (zero mods, neutral envelopes) | ✅ | ✅ |
| `load_preset` | Load preset from slot (1-512 for MicroFreak) | ✅ | ⚠️ |
| `dump_preset` | Read complete preset data via SysEx | ✅ | ⚠️ |

**Legend**: ✅ Fully supported | ⚠️ Limited/not applicable | ❌ Not supported

**Notes**:
- **SE-02 Modulation**: The SE-02 has fixed modulation routing controlled via dedicated CCs rather than a flexible mod matrix
- **SE-02 Presets**: The SE-02 supports program changes for 128 presets but does not support SysEx preset dumps in the same way as MicroFreak



## MCP Resources

| Resource | Description |
|----------|-------------|
| `synth://<id>/params` | JSON param map with descriptions and tips |
| `synth://<id>/midi-reference` | Complete MIDI CC/NRPN reference with examples |

## Tests

```bash
npm test  # 20 tests: CC/NRPN conversion, normalization, clamping
```

## Architecture

**patchwork** = MCP Server + SynthAdapter abstraction + Hardware MIDI

- **MCP Layer** (`src/mcp/`): 8 tools + 2 resources, stdio transport
- **Synth Abstraction** (`src/synth/`): Generic parameter interface, driver-agnostic API
- **MIDI Layer** (`src/midi/`): CC + NRPN + SysEx message building, hardware port management
- **Drivers** (`src/drivers/`):
  - **MicroFreak** (`microfreak/`): 22 oscillator types, full mod matrix (5×7), NRPN parameter mappings, SysEx preset protocol
  - **SE-02** (`se02/`): Analog architecture modeling, comprehensive CC mappings, oscillator sync, cross modulation

### Adding New Drivers

To add support for a new synthesizer:

1. Implement the `SynthAdapter` interface in `src/drivers/yoursynth/driver.ts`
2. Define parameter mappings (canonical params → hardware MIDI CC/NRPN)
3. Specify synth-specific features (oscillator types, filter modes, etc.)
4. Optionally implement SysEx protocol for preset dump/load
5. Register the driver in `src/synth/manager.ts`

See [MicroFreak driver](src/drivers/microfreak/driver.ts) and [SE-02 driver](src/drivers/se02/driver.ts) for reference implementations.

## Status

- ✅ MCP tool suite (8 tools, 2 resources)
- ✅ MicroFreak driver with full feature support
- ✅ SE-02 driver with comprehensive parameter control
- ✅ SysEx preset reading for MicroFreak (512 presets across 4 banks)
- ✅ MIDI input handling for SysEx responses
- ✅ Type-safe parameter handling with Zod validation
- ✅ Hot-plug synth detection
- ✅ Multi-synth support (multiple synths can be connected simultaneously)

## Publishing

To publish a new version to npm:

```bash
npm run build
npm test
npm version patch  # or minor/major
npm publish
```

## Documentation

### General
- [Architecture Overview](docs/architecture.md) - System design and component interaction

### MicroFreak
- [MIDI Reference](docs/microfreak-midi-reference.md) - Complete CC/NRPN/SysEx reference
- [SysEx Implementation](docs/microfreak-sysex-implementation.md) - Preset dump/load protocol (if exists)

### SE-02
- [MIDI Reference](docs/se02-midi-reference.md) - Complete CC mapping and parameter reference
- [SysEx Implementation](docs/se02-sysex-implementation.md) - Roland SysEx protocol details

