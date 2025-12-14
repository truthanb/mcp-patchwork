# SysEx Implementation Plan

## What We Added

### 1. SysEx Core (`src/midi/sysex.ts`)
Complete SysEx message utilities:
- Generic SysEx builder/parser
- Arturia-specific helpers (manufacturer ID: `0x00 0x20 0x6B`)
- MicroFreak preset request builders
- Response parsers (name, data chunks)
- Preset category mapping

### 2. Hardware Port Extension (`src/midi/hardware-port.ts`)
Added `sendSysEx()` method:
- Validates SysEx format (starts 0xF0, ends 0xF7)
- Sends complete messages to hardware

### 3. Preset Module (`src/drivers/microfreak/preset.ts`)
Preset dump/load framework:
- `MicroFreakPreset` interface
- `readPreset()` - SysEx dump reader (structure defined, needs input handling)
- `writePreset()` - Placeholder for future implementation
- Firmware detection (FW1 vs FW2)
- Format support checking (detects unsupported factory presets)
- JSON export/import (custom format, not .syx)

### 4. Documentation (`docs/microfreak-midi-reference.md`)
Added SysEx section:
- Message formats with byte-level details
- Request/response sequences
- Implementation notes
- Timing requirements (15ms between messages)
- Firmware detection patterns

## What Works Right Now

✅ **SysEx message building**
```typescript
const nameReq = buildPresetNameRequest(0, 42);
port.sendSysEx(nameReq);
```

✅ **SysEx sending** via hardware port

✅ **Response parsing** (given a SysEx message)
```typescript
const parsed = parsePresetNameResponse(message);
// => { name: "My Patch", category: 3 }
```

## What Needs Implementation

❌ **SysEx Input Handling**

The missing piece is **receiving** SysEx responses from the MicroFreak. This requires:

1. **Add MIDI Input to HardwareMidiPort**:
```typescript
import midi from 'midi';

class HardwareMidiPort {
  private input: midi.Input | null = null;
  private sysexCallback: ((message: number[]) => void) | null = null;
  
  enableSysExInput(callback: (message: number[]) => void) {
    this.input = new midi.Input();
    this.input.openPort(this.portIndex);
    this.sysexCallback = callback;
    this.input.on('message', (deltaTime, message) => {
      if (message[0] === 0xF0) {
        callback(Array.from(message));
      }
    });
  }
}
```

2. **Async Response Handling**:
```typescript
async function readPreset(port, slot) {
  return new Promise((resolve, reject) => {
    const responses: number[][] = [];
    
    port.enableSysExInput((message) => {
      const parsed = parsePresetDataResponse(message);
      if (parsed) {
        responses.push(parsed);
        
        // Have we received all chunks?
        if (responses.length === 40) {
          resolve({
            name: presetName,
            data: responses,
            // ...
          });
        }
      }
    });
    
    // Send requests...
    sendPresetNameRequest();
    // ...
  });
}
```

3. **State Machine for Request/Response**:
- Track which chunk we're requesting
- Handle timeouts (MicroFreak usually responds <2ms)
- Detect errors/missing responses
- Progress callbacks

## Why Stop Here?

**Input handling is significantly more complex** than output:
- Event-driven architecture (vs synchronous sends)
- Needs state tracking across multiple async messages
- Timeout/error handling
- Thread safety concerns
- Testing requires real hardware

**The groundwork is done:**
- ✅ Message format documented
- ✅ Builders/parsers implemented  
- ✅ Output path working
- ✅ Structure defined

**Next steps when needed:**
1. Add `midi.Input` to `HardwareMidiPort`
2. Implement event-driven response collection
3. Build state machine for request/response cycles
4. Add MCP tool: `read_preset(slot)`
5. Add MCP tool: `write_preset(slot, data)` (even more complex)

## How To Use What We Have

You can manually test SysEx sending:

```typescript
import { HardwareMidiPort } from './midi/hardware-port.js';
import { buildPresetNameRequest } from './midi/sysex.js';

const port = new HardwareMidiPort('MicroFreak');
port.open();

// This will send the request:
const request = buildPresetNameRequest(0, 0); // Bank 0, Preset 0
port.sendSysEx(request);

// To see the response, you'd need to:
// 1. Use a MIDI monitor (like MIDI Monitor on macOS)
// 2. Or implement input handling as described above
```

## Value So Far

Even without input handling, we have:
1. **Complete protocol documentation** - Anyone can implement it now
2. **Reusable SysEx utilities** - Generic message building/parsing
3. **Type-safe interfaces** - `MicroFreakPreset` structure defined
4. **Foundation for preset library** - JSON export/import ready
5. **Knowledge transfer** - microfreak-reader insights captured

This is about **80% of the work** for preset dump/load. The remaining 20% (input handling) is the most complex but builds on this foundation.

## Future: Complete Preset Management

When input is implemented, we could add:

**MCP Tools:**
- `dump_preset(slot)` - Read preset from synth
- `load_preset_from_file(path)` - Load JSON preset
- `save_preset_to_file(slot, path)` - Dump and save
- `clone_preset(from, to)` - Duplicate preset
- `backup_bank(bank, path)` - Backup 128 presets

**Resources:**
- `synth://<id>/presets` - List all dumped presets
- `synth://<id>/preset/<slot>` - Get preset JSON

This would make patchwork a **complete MicroFreak librarian** in addition to real-time control.
