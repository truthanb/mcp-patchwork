/**
 * MIDI Sequencer
 * 
 * Plays note sequences in real-time through a MIDI port.
 * Perfect for testing patches with musical patterns.
 */

export interface Note {
  /** MIDI note number (0-127, where 60 = middle C) */
  note: number;
  /** Velocity (0-127, 100 is typical) */
  velocity?: number;
  /** Duration in beats (1.0 = quarter note) */
  duration: number;
  /** Delay before this note in beats (0 = play immediately after previous) */
  delay?: number;
}

export interface SequenceOptions {
  /** Tempo in BPM (default: 120) */
  tempo?: number;
  /** MIDI channel (0-15, default: 0) */
  channel?: number;
  /** Loop the sequence (default: false) */
  loop?: boolean;
  /** Number of times to loop (default: infinite if loop=true) */
  loopCount?: number;
}

export interface MidiOutput {
  sendNoteOn(channel: number, note: number, velocity: number): boolean;
  sendNoteOff(channel: number, note: number): boolean;
}

/**
 * Play a sequence of notes through a MIDI port.
 * 
 * @param port - MIDI output port
 * @param notes - Array of notes to play
 * @param options - Playback options
 * @returns Promise that resolves when sequence completes
 */
export async function playSequence(
  port: MidiOutput,
  notes: Note[],
  options: SequenceOptions = {}
): Promise<void> {
  const tempo = options.tempo ?? 120;
  const channel = options.channel ?? 0;
  const loop = options.loop ?? false;
  const loopCount = options.loopCount ?? Infinity;
  
  // Calculate milliseconds per beat
  const msPerBeat = (60 / tempo) * 1000;
  
  let currentLoop = 0;
  
  do {
    for (const noteData of notes) {
      const velocity = noteData.velocity ?? 100;
      const delay = noteData.delay ?? 0;
      
      // Wait for delay
      if (delay > 0) {
        await wait(delay * msPerBeat);
      }
      
      // Note On
      port.sendNoteOn(channel, noteData.note, velocity);
      
      // Wait for duration
      await wait(noteData.duration * msPerBeat);
      
      // Note Off
      port.sendNoteOff(channel, noteData.note);
    }
    
    currentLoop++;
  } while (loop && currentLoop < loopCount);
}

/**
 * Stop all notes on a channel (panic).
 */
export function stopAllNotes(port: MidiOutput, channel: number = 0): void {
  // Send Note Off for all MIDI notes
  for (let note = 0; note < 128; note++) {
    port.sendNoteOff(channel, note);
  }
}

/**
 * Utility: Wait for a specified time.
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Note name to MIDI number conversion.
 * C4 (middle C) = 60
 */
const NOTE_NAMES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

/**
 * Convert note name to MIDI number.
 * Examples: "C4" = 60, "A3" = 57, "F#5" = 78
 */
export function noteNameToNumber(name: string): number {
  const match = name.match(/^([A-G][#b]?)(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid note name: ${name}`);
  }
  
  const [, noteName, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);
  const noteOffset = NOTE_NAMES[noteName];
  
  if (noteOffset === undefined) {
    throw new Error(`Invalid note name: ${noteName}`);
  }
  
  // MIDI note 0 = C-1, so C4 (middle C) = 60
  return (octave + 1) * 12 + noteOffset;
}

/**
 * Convert MIDI number to note name.
 */
export function noteNumberToName(midiNumber: number): string {
  const octave = Math.floor(midiNumber / 12) - 1;
  const noteIndex = midiNumber % 12;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return noteNames[noteIndex] + octave;
}

/**
 * Common sequence patterns for quick testing.
 */
export const SequencePatterns = {
  /** Simple C major arpeggio */
  cMajorArp: (): Note[] => [
    { note: 60, duration: 0.25 }, // C4
    { note: 64, duration: 0.25 }, // E4
    { note: 67, duration: 0.25 }, // G4
    { note: 72, duration: 0.25 }, // C5
  ],
  
  /** Classic acid bassline pattern */
  acidBass: (): Note[] => [
    { note: 36, duration: 0.125 },  // C2
    { note: 36, duration: 0.125 },  // C2
    { note: 39, duration: 0.125 },  // Eb2
    { note: 43, duration: 0.125 },  // G2
    { note: 36, duration: 0.125 },  // C2
    { note: 39, duration: 0.125 },  // Eb2
    { note: 43, duration: 0.125 },  // G2
    { note: 48, duration: 0.125 },  // C3
  ],
  
  /** Pentatonic melody */
  pentatonic: (): Note[] => [
    { note: 60, duration: 0.5 },   // C4
    { note: 62, duration: 0.5 },   // D4
    { note: 64, duration: 0.5 },   // E4
    { note: 67, duration: 0.5 },   // G4
    { note: 69, duration: 1.0 },   // A4
  ],
  
  /** Test all octaves (one note per octave) */
  octaveTest: (): Note[] => {
    const notes: Note[] = [];
    for (let octave = -1; octave <= 8; octave++) {
      notes.push({
        note: (octave + 1) * 12, // C of each octave
        duration: 0.5
      });
    }
    return notes;
  }
};
