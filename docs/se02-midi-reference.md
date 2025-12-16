# Roland SE-02 MIDI Reference

Complete MIDI CC reference for the Roland SE-02 analog synthesizer.

## Overview

The SE-02 is a boutique analog monosynth based on the classic SH-101 architecture. It features 3 true analog oscillators, a 4-pole low-pass filter, cross modulation, and a built-in delay effect. All parameters are controllable via MIDI CC messages.

## Quick CC Reference

| Parameter | CC# | Range | Section | Description |
|-----------|-----|-------|---------|-------------|
| **Portamento Time** | 5 | 0-127 | Performance | Glide/portamento time between notes |
| **Oscillator 1 Range** | 3 | 0-127 | Oscillator | OSC1 octave range (16', 8', 4', 2') |
| **Oscillator 1 Waveform** | 15 | 0-127 | Oscillator | OSC1 waveform (Saw, Pulse, Triangle) |
| **Oscillator 1 Level** | 16 | 0-127 | Mixer | OSC1 volume level |
| **Oscillator 2 Range** | 17 | 0-127 | Oscillator | OSC2 octave range |
| **Oscillator 2 Waveform** | 18 | 0-127 | Oscillator | OSC2 waveform |
| **Oscillator 2 Level** | 19 | 0-127 | Mixer | OSC2 volume level |
| **Oscillator 2 Tune** | 20 | 0-127 | Oscillator | OSC2 fine tuning (-50 to +50 cents) |
| **Oscillator 3 Range** | 21 | 0-127 | Oscillator | OSC3 octave range |
| **Oscillator 3 Waveform** | 22 | 0-127 | Oscillator | OSC3 waveform |
| **Oscillator 3 Level** | 85 | 0-127 | Mixer | OSC3 volume level |
| **Oscillator 3 Tune** | 23 | 0-127 | Oscillator | OSC3 fine tuning |
| **Noise Level** | 28 | 0-127 | Mixer | White noise generator level |
| **Sub Oscillator Level** | 86 | 0-127 | Mixer | Sub oscillator level (-1 octave) |
| **Filter Cutoff** | 74 | 0-127 | Filter | Low-pass filter cutoff frequency |
| **Filter Resonance** | 71 | 0-127 | Filter | Filter resonance/emphasis |
| **Filter Envelope Amount** | 24 | 0-127 | Filter | Envelope modulation to filter cutoff |
| **Filter Keytrack** | 25 | 0-127 | Filter | Keyboard tracking amount |
| **Filter Mod Source** | 83 | 0-127 | Filter | Modulation source for filter |
| **Envelope Attack** | 73 | 0-127 | Envelope | Attack time (shared amp/filter) |
| **Envelope Decay** | 75 | 0-127 | Envelope | Decay time |
| **Envelope Sustain** | 79 | 0-127 | Envelope | Sustain level |
| **Envelope Release** | 72 | 0-127 | Envelope | Release time |
| **LFO Rate** | 26 | 0-127 | LFO | LFO speed/frequency |
| **LFO Amount** | 27 | 0-127 | LFO | LFO modulation depth |
| **LFO Waveform** | 88 | 0-127 | LFO | LFO wave shape |
| **LFO Delay** | 89 | 0-127 | LFO | LFO delay time before onset |
| **Cross Modulation** | 80 | 0-127 | Modulation | OSC1 modulates OSC2 frequency |
| **PWM Source** | 81 | 0-127 | Modulation | Pulse width modulation source |
| **PWM Amount** | 82 | 0-127 | Modulation | Pulse width modulation depth |
| **Portamento Mode** | 65 | 0-127 | Performance | Portamento on/off |
| **Pitch Bend Range** | 84 | 0-127 | Performance | Pitch bend wheel range in semitones |
| **Velocity Sensitivity** | 90 | 0-127 | Performance | Velocity response amount |
| **Delay Time** | 87 | 0-127 | Effects | Delay time/speed |
| **Delay Feedback** | 91 | 0-127 | Effects | Delay feedback/repeats |
| **Delay Level** | 92 | 0-127 | Effects | Delay wet/dry mix |

## Oscillator Architecture

The SE-02 features 3 independent analog oscillators with the following characteristics:

### Oscillator Ranges (CC 3, 17, 21)
- **0-31**: 16' (sub-bass, -2 octaves)
- **32-63**: 8' (bass, -1 octave)
- **64-95**: 4' (normal pitch)
- **96-127**: 2' (high, +1 octave)

### Waveform Selection (CC 15, 18, 22)
- **0-42**: Sawtooth wave (bright, harmonically rich)
- **43-85**: Pulse/Square wave (hollow, variable width)
- **86-127**: Triangle wave (mellow, flute-like)

### Oscillator Tuning (CC 20, 23)
- **64**: Center (no detune)
- **0-63**: Flatten (-50 to 0 cents)
- **65-127**: Sharpen (0 to +50 cents)

**Sound Design Tip**: Slight detuning of OSC2/OSC3 (values 58-62 or 66-70) creates classic analog thickness.

## Filter Section

### 4-Pole Low-Pass Filter

The SE-02's filter is a classic 4-pole (24dB/octave) low-pass design inspired by the Roland IR3109 chip.

#### Filter Cutoff (CC 74)
- **0-20**: Sub-bass only, very dark
- **20-50**: Bass to low-mids, warm
- **50-80**: Open, bright
- **80-127**: Fully open, pristine

#### Filter Resonance (CC 71)
- **0**: No emphasis
- **60-80**: Sweet spot for analog character
- **90-127**: Self-oscillation (filter rings as sine wave)

#### Filter Envelope Amount (CC 24)
- **0-63**: Negative envelope (inverted)
- **64**: No modulation
- **65-127**: Positive envelope (classic sweep)

**Sound Design Tip**: For plucks, set cutoff low (20-40), envelope amount high (100-127), and fast envelope for percussive attack.

## Envelope Section

The SE-02 uses a single ADSR envelope that controls both amplitude and filter cutoff (via envelope amount).

### Envelope Parameters
- **Attack (CC 73)**: 0 = instant, 127 = ~10 seconds
- **Decay (CC 75)**: 0 = instant, 127 = ~10 seconds  
- **Sustain (CC 79)**: 0 = silent, 127 = full level
- **Release (CC 72)**: 0 = instant, 127 = ~10 seconds

### Classic Envelope Shapes

| Sound Type | Attack | Decay | Sustain | Release | Description |
|------------|--------|-------|---------|---------|-------------|
| **Pluck** | 0 | 20-40 | 0-20 | 10-30 | Fast percussive |
| **Pad** | 40-80 | 60-90 | 80-110 | 60-100 | Slow, evolving |
| **Bass** | 0-5 | 30-50 | 80-100 | 20-40 | Punchy with sustain |
| **Lead** | 0-10 | 40-60 | 90-110 | 30-50 | Bright, sustained |
| **Stab** | 0 | 40-60 | 0 | 0-10 | Short, punchy |

## LFO (Low Frequency Oscillator)

### LFO Rate (CC 26)
- **0-30**: Very slow (atmospheric)
- **30-60**: Slow (tremolo/vibrato)
- **60-90**: Medium (wobble effects)
- **90-127**: Fast (audio rate FM)

### LFO Waveform (CC 88)
- **0-31**: Triangle (smooth, musical)
- **32-63**: Sawtooth (rising sweep)
- **64-95**: Reverse Sawtooth (falling sweep)
- **96-127**: Square (choppy, rhythmic)

### LFO Amount (CC 27)
Controls depth of modulation to the currently selected destination.

**Sound Design Tip**: Triangle LFO on filter cutoff (amount 40-80) creates smooth wah effects. Square wave creates rhythmic filter gating.

## Cross Modulation

### Cross Mod Amount (CC 80)
OSC1 frequency modulates OSC2 frequency for FM-like timbres.

- **0**: No modulation
- **10-40**: Subtle harmonic richness
- **40-80**: Metallic, bell-like tones
- **80-127**: Aggressive, inharmonic textures

**Sound Design Tip**: Combine with pulse wave on OSC1 and sawtooth on OSC2 for complex, evolving tones.

## Pulse Width Modulation (PWM)

### PWM Source (CC 81)
- **0-42**: Manual (static pulse width)
- **43-85**: LFO modulation
- **86-127**: Envelope modulation

### PWM Amount (CC 82)
Controls depth of pulse width variation. Creates chorusing, string-like effects.

**Sound Design Tip**: LFO PWM at slow rate (LFO rate 20-40) creates classic analog string sounds.

## Delay Effect

The SE-02 includes a built-in delay effect.

### Delay Time (CC 87)
- **0-40**: Short (slapback echo)
- **40-80**: Medium (rhythmic delay)
- **80-127**: Long (ambient)

### Delay Feedback (CC 91)
- **0-40**: Single repeat
- **40-80**: Multiple repeats
- **80-127**: Infinite repeats (runaway delay)

### Delay Level (CC 92)
- **0**: Dry (no delay)
- **20-40**: Subtle depth
- **64**: 50/50 wet/dry
- **100-127**: Delay-dominant

## Portamento

### Portamento Time (CC 5)
- **0**: No glide (instant pitch change)
- **20-60**: Short glide (expressive)
- **60-100**: Medium glide (synth lead)
- **100-127**: Long glide (dramatic)

### Portamento Mode (CC 65)
- **0-63**: Off
- **64-127**: On

**Sound Design Tip**: Portamento on leads with medium time (40-60) adds expression without being overwhelming.

## Performance Controls

### Pitch Bend Range (CC 84)
Sets the pitch bend wheel range in semitones.
- **24**: ±2 semitones (common)
- **36**: ±3 semitones  
- **48**: ±4 semitones
- **84**: ±7 semitones (full octave with overshoot)

### Velocity Sensitivity (CC 90)
Controls how much key velocity affects volume.
- **0**: No velocity response (all notes same volume)
- **64**: Standard response
- **127**: Maximum dynamics

## Preset Management

The SE-02 has 128 preset slots accessible via MIDI Program Change messages:

- **Program Change 0-127**: Load preset 1-128

## Sound Design Recipes

### Warm Bass
```
OSC1: Sawtooth, 8' range, level 100
OSC2: Pulse, 8' range, level 80, tune 63
OSC3: Off
Filter Cutoff: 30-40
Filter Resonance: 50-70
Envelope: A=0, D=40, S=100, R=30
```

### Lead Synth
```
OSC1: Sawtooth, 4' range, level 100
OSC2: Sawtooth, 4' range, level 90, tune 66 (slight detune)
OSC3: Off
Filter Cutoff: 80-100
Filter Resonance: 40-60
Envelope: A=5, D=50, S=100, R=40
LFO: Triangle, rate 30, amount 40 (on pitch for vibrato)
Portamento: 30-50
```

### Pluck/Pizzicato
```
OSC1: Sawtooth, 4' range, level 100
OSC2: Off
OSC3: Off
Filter Cutoff: 20-30
Filter Resonance: 80-100
Filter Envelope Amount: 110-127
Envelope: A=0, D=25, S=0, R=20
```

### Aggressive Lead with Cross Mod
```
OSC1: Pulse, 4' range, level 100
OSC2: Sawtooth, 4' range, level 100
Cross Mod: 60-80
Filter Cutoff: 70-90
Filter Resonance: 60-80
Envelope: A=0, D=60, S=80, R=40
```

### Analog Pad
```
OSC1: Sawtooth, 8' range, level 100
OSC2: Sawtooth, 8' range, level 95, tune 66
OSC3: Triangle, 4' range, level 60
Sub Osc: 40
Filter Cutoff: 50-70
Filter Resonance: 30-50
Envelope: A=60, D=80, S=90, R=80
LFO: Triangle, rate 20, amount 30 (on filter cutoff)
Delay: Time 60, Feedback 50, Level 30
```

### String Ensemble
```
OSC1: Pulse, 8' range, level 100
OSC2: Pulse, 4' range, level 70, tune 66
PWM Source: LFO
PWM Amount: 60-80
LFO: Triangle, rate 25, delay 20
Filter Cutoff: 70-85
Filter Resonance: 20-40
Envelope: A=50, D=60, S=100, R=60
```

## Tips for MCP/LLM Integration

When controlling the SE-02 via the MCP server:

1. **Start with filter open**: Set cutoff to 0.8 (CC value ~100) so you can hear changes
2. **Use normalized values**: All setParam calls expect 0.0-1.0 range
3. **Combine parameters**: SE-02 sounds best with multiple oscillators - set levels for OSC1, OSC2, OSC3
4. **Envelope is shared**: Remember the envelope controls both amp and filter - use filter envelope amount to separate behaviors
5. **Cross mod is powerful**: Even small amounts (0.2-0.4 normalized) add significant character
6. **Delay adds depth**: Use sparingly (mix 0.2-0.3) for subtle enhancement

## MIDI Channel

Default MIDI channel is 1 (channel 0 in 0-indexed systems). This can be changed in the SE-02 global settings.

## Notes

- The SE-02 is **monophonic** (1 voice)
- True analog signal path - slight variations between units add character
- No SysEx preset dumps supported in this driver version
- Filter can self-oscillate at high resonance, acting as a sine wave oscillator
- Cross modulation is unidirectional: OSC1 → OSC2 only
