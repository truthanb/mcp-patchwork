# Patchwork Architecture

## Overview

Patchwork is an MCP (Model Context Protocol) server that enables AI-assisted control of hardware synthesizers via MIDI. It provides a clean abstraction layer between musical intent and synth-specific MIDI implementation.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         MCP Server Layer            │  - Tool definitions & handlers
│    (src/mcp/server.ts, tools.ts)    │  - Request/response routing
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Synth Adapter Interface        │  - Hardware abstraction
│     (src/synth/adapter.ts)          │  - Canonical parameter types
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Driver Implementations         │  - Synth-specific logic
│   (src/drivers/microfreak/*)        │  - MIDI mapping
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│         MIDI Layer                  │  - CC, NRPN, SysEx utilities
│  (src/midi/hardware-port.ts, etc)  │  - Hardware port management
└─────────────────────────────────────┘
```

## Core Components

### 1. MCP Server (`src/mcp/`)

**Purpose:** Bridge between AI and synthesizer hardware

**Key Files:**
- `server.ts` - Main MCP server, tool routing
- `tools.ts` - Tool schemas and definitions (Zod validation)
- `handlers.ts` - Tool implementation logic

**Tools Provided:**
- `list_synths` - Discover connected hardware
- `describe_synth` - Get capabilities, features, parameters
- `set_param` - Set normalized parameter values (0.0-1.0)
- `set_synth_feature` - Set discrete features (oscillator type, filter type)
- `set_modulation` - Configure modulation matrix routing
- `init` - Reset synth to clean baseline state
- `load_preset` - Load factory presets by slot number
- `dump_preset` - Read preset data via SysEx for analysis

### 2. Synth Adapter Interface (`src/synth/`)

**Purpose:** Define consistent API across different synth hardware

**Key Concepts:**

**Canonical Parameters:**
- `osc.type`, `osc.mix`, `osc.wave`, `osc.shape`
- `filter.cutoff`, `filter.resonance`, `filter.type`
- `env.amp.*`, `env.filter.*` (attack, decay, sustain, release)
- `lfo1.rate`, `lfo1.amount`, `lfo2.rate`, `lfo2.amount`
- `fx.mix`, `fx.param1`, `fx.param2`

**Normalized Values:**
- All parameters use 0.0-1.0 range
- Drivers map to hardware-specific ranges (CC 0-127, NRPN 0-16383)

**Features:**
- Discrete capabilities with specific values (e.g., oscillator types)
- Synth-specific, not normalized

**Interface Methods:**
```typescript
interface SynthAdapter {
  setParam(param: CanonicalParam, value: NormalizedValue): Promise<boolean>;
  setParams(settings: ParamSetting[]): Promise<ApplyResult>;
  setFeature(feature: string, value: string): Promise<FeatureResult>;
  setModulation?(source: string, destination: string, amount: number): Promise<ModulationResult>;
  loadPreset?(slot: number): Promise<boolean>;
  resetToInit(): Promise<void>;
  getCapabilities(): SynthCapabilities;
  getFeatures(): SynthFeature[];
  // ... more
}
```

### 3. MicroFreak Driver (`src/drivers/microfreak/`)

**Purpose:** Implement adapter interface for Arturia MicroFreak

**Key Files:**
- `driver.ts` - Main driver implementation
- `param-map.ts` - Canonical param → CC/NRPN mapping
- `mod-matrix.ts` - Modulation routing (14-bit NRPN)
- `preset.ts` - Preset structure definitions

**MIDI Implementation:**
- 7-bit CC for basic parameters
- 14-bit NRPN for mod matrix (precise control)
- SysEx for preset dumps (read-only)
- Program Change for preset loading

**Oscillator Types (22):**
```
Basic, Saw-X, Harmo, KarplusS, VAna, WaveMap, Harm, Sawtor,
FormntV, FormntF, ChipTune, BitCrsh, ZSync, SuperWv, Wavet,
Harmonic, KarpStr, VAnalog, Wavemap, SawSquare, Speech, Modal, Bass
```

**Modulation Matrix:**
- Sources: LFO, Envelope, CyclingEnv, Pressure, Keyboard, Aftertouch
- Destinations: Pitch, Wave, Timbre, Cutoff, Resonance, Assign1-3
- 14-bit precision via NRPN

### 4. MIDI Layer (`src/midi/`)

**Purpose:** Low-level MIDI communication utilities

**Key Files:**
- `hardware-port.ts` - Hardware MIDI port wrapper (node-midi)
- `virtual-port.ts` - Virtual MIDI port for testing
- `cc.ts` - CC conversion utilities (normalized ↔ 7-bit)
- `sysex.ts` - SysEx message building/parsing

**Hardware Port:**
```typescript
class HardwareMidiPort {
  sendCC(channel: number, cc: number, value: number): boolean;
  sendNRPN(channel: number, paramNumber: number, value: number): boolean;
  sendSysEx(message: number[]): boolean;
  sendProgramChange(channel: number, program: number): boolean;
}
```

## Data Flow

### Setting a Parameter

```
AI Request: "Set filter cutoff to 50%"
    ↓
MCP Tool: set_param(param: "filter.cutoff", value: 0.5)
    ↓
Handler: handleSetParam() validates and routes
    ↓
Driver: microfreakDriver.setParam("filter.cutoff", 0.5)
    ↓
Param Map: Maps "filter.cutoff" → CC 23
    ↓
CC Conversion: 0.5 → 64 (7-bit)
    ↓
MIDI Port: sendCC(channel=0, cc=23, value=64)
    ↓
Hardware: MicroFreak filter opens to 50%
```

### Loading a Preset

```
AI Request: "Load preset 100"
    ↓
MCP Tool: load_preset(slot: 100)
    ↓
Handler: handleLoadPreset() validates slot
    ↓
Driver: microfreakDriver.loadPreset(100)
    ↓
MIDI Port: sendProgramChange(channel=0, program=99)
    ↓
Hardware: MicroFreak loads preset 100
```

### Modulation Routing

```
AI Request: "Route LFO to filter cutoff at 80%"
    ↓
MCP Tool: set_modulation(source: "LFO", destination: "Cutoff", amount: 0.8)
    ↓
Handler: handleSetModulation() validates routing
    ↓
Driver: microfreakDriver.setModulation("LFO", "Cutoff", 0.8)
    ↓
Mod Matrix: Maps LFO→Cutoff → NRPN 264
    ↓
NRPN Conversion: 0.8 → 13107 (14-bit)
    ↓
MIDI Port: sendNRPN(channel=0, param=264, value=13107)
    ↓
Hardware: LFO modulates cutoff at 80%
```

## Design Principles

### 1. **Normalized Interface**
- All parameter values use 0.0-1.0 range
- Drivers handle hardware-specific scaling
- AI doesn't need to know CC numbers or MIDI details

### 2. **Hardware Abstraction**
- Canonical parameter names work across synths
- Driver maps canonical → hardware-specific
- Easy to add new synth implementations

### 3. **Discoverable Capabilities**
- `describe_synth` reveals what each synth can do
- Features list oscillator types, filter types, etc.
- AI can adapt to hardware differences

### 4. **Type Safety**
- TypeScript throughout for compile-time checks
- Zod schemas for MCP tool validation
- Clear interfaces between layers

### 5. **Extensibility**
- New synths implement `SynthAdapter` interface
- Registry pattern for multi-device support
- Modular driver structure

## Testing Strategy

**Unit Tests:**
- `src/midi/cc.test.ts` - CC conversion utilities
- More tests needed for drivers, handlers

**Manual Testing:**
- MCP tools tested via AI interactions
- Real hardware validation (MicroFreak)
- Parameter changes verified by ear

**Future Testing:**
- Virtual MIDI port for automated testing
- Mock synth adapter for integration tests
- Sequence encoder/decoder validation

## Future Directions

### 1. **Multi-Synth Support**
- Registry manages multiple devices
- Tools accept optional `synthId` parameter
- Already architected, needs implementation

### 2. **Additional Drivers**
- Moog Matriarch, Mother-32
- Elektron devices
- Modular CV interfaces

### 3. **Sequence Writing**
- Currently blocked (MicroFreak doesn't support SysEx writes)
- Possible workaround: MIDI Control Center automation
- Alternative: Real-time MIDI note playback

### 4. **Preset Management**
- Save current state to preset slot
- Preset library/favorites
- A/B comparison tools

### 5. **Sound Design Templates**
- Common patches (bass, lead, pad, etc.)
- Genre-specific starting points
- Learning examples for AI

## Dependencies

**Runtime:**
- `midi` - Node.js MIDI bindings (native)
- `@modelcontextprotocol/sdk` - MCP server implementation
- `zod` - Schema validation

**Development:**
- `typescript` - Type safety
- `vitest` - Testing framework
- `tsx` - TypeScript execution

## File Organization

```
patchwork/
├── src/
│   ├── mcp/              # MCP server layer
│   │   ├── server.ts
│   │   ├── tools.ts
│   │   └── handlers.ts
│   ├── synth/            # Abstraction layer
│   │   ├── adapter.ts
│   │   └── types.ts
│   ├── drivers/          # Hardware implementations
│   │   └── microfreak/
│   │       ├── driver.ts
│   │       ├── param-map.ts
│   │       ├── mod-matrix.ts
│   │       ├── sequence.ts
│   │       ├── preset.ts
│   │       └── mbp-writer.ts
│   └── midi/             # MIDI utilities
│       ├── hardware-port.ts
│       ├── virtual-port.ts
│       ├── cc.ts
│       └── sysex.ts
├── docs/                 # Documentation
│   ├── architecture.md   # This file
│   ├── journey.md        # Development history
│   └── sequence-*.md     # Reverse engineering notes
├── scripts/              # Development utilities
│   ├── parse-mbp.ts
│   ├── analyze-*.ts
│   └── verify-*.ts
└── tests/                # Test suite
    └── midi/
        └── cc.test.ts
```
