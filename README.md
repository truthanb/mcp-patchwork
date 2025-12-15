# patchwork
**Tell your synth what you want**

LLM-friendly MIDI control plane for synthesizers. Natural language → sound design through MCP (Model Context Protocol).

## Features

- **8 MCP Tools**: Complete synth control including preset inspection
- **NRPN Support**: 14-bit parameter control for smooth modulation amounts  
- **Full Mod Matrix**: 5 sources × 7 destinations = 35 routing possibilities
- **SysEx Preset Reading**: Dump and inspect any of 512 preset slots from hardware
- **Bank Select Support**: Access all 4 banks (512 presets) via MIDI Bank Select
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

Connect via MCP client with your MicroFreak connected, and control it using natural language:

```
"Create a warm bass sound with slow filter modulation"
"Make a plucky lead with fast decay"  
"Set up a pad with LFO on the filter"
```

Or use the tools directly:

```typescript
// Create a kick drum
await init();  // Reset to clean state
await set_synth_feature("oscillatorType", "Modal");
await set_param("env.amp.decay", 0.15);
await set_param("filter.cutoff", 0.3);
await set_modulation("Envelope", "Pitch", -0.35);
await set_modulation("Envelope", "Cutoff", 0.5);
```

## Supported Hardware

Currently supports:
- **Arturia MicroFreak** (via MIDI + SysEx)

Extensible architecture allows adding new synths via the `SynthAdapter` interface.

## MCP Tools

| Tool | Purpose |
|------|---------|
| `list_synths` | List connected synthesizers |
| `describe_synth` | Get capabilities (oscillators, mod matrix, params) |
| `set_param` | Set normalized parameter (0.0-1.0) |
| `set_synth_feature` | Set oscillator/filter type |
| `set_modulation` | Route mod source → destination (-1.0 to 1.0) |
| `init` | Reset synth to baseline (zero mods, neutral envelopes) |
| `load_preset` | Load preset from slot (1-512, matches hardware) |
| `dump_preset` | Read complete preset data via SysEx |



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

**mcp-patchwork** = MCP Server + SynthAdapter abstraction + Hardware MIDI

- **MCP Layer** (`src/mcp/`): 10 tools + 2 resources, stdio transport
- **Synth Abstraction** (`src/synth/`): Generic parameter interface, driver-agnostic
- **MIDI Layer** (`src/midi/`): CC + NRPN + SysEx message building, hardware port management
- **MicroFreak Driver** (`src/drivers/microfreak/`): 22 oscillator types, full mod matrix, param mappings, preset structure

## Status10

- ✅ Complete MCP tool suite (8 tools, 2 resources)
- ✅ Preset reading (dump presets from hardware via SysEx)
- ✅ 512-preset support with 4-bank MIDI Bank Select
- ✅ MIDI input handling for SysEx responses
- ✅ Type-safe parameter handling
- ✅ Hot-plug synth detection
- 🔄 Sequence writing (SysEx write protocol not yet reverse engineered)
- 🔄 SysEx preset writing (save presets to hardware)
- 🔄 Additional synth drivers (extensible via SynthAdapter)

## Publishing

To publish a new version to npm:

```bash
npm run build
npm test
npm version patch  # or minor/major
npm publish
```

## Documentation

- [MIDI Reference](docs/microfreak-midi-reference.md) - Complete CC/NRPN/SysEx reference
- [SysEx Implementation](docs/sysex-implementation.md) - Preset dump/load architecture
- [Sequence Reverse Engineering](docs/sequence-reverse-engineering.md) - Decoding chunks 40-145

