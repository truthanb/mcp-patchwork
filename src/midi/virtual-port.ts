/**
 * Virtual MIDI Port
 * 
 * Creates a virtual MIDI output port on macOS (CoreMIDI).
 * DAWs and hardware treat this as a standard MIDI device.
 */

import midi from 'midi';

export class VirtualMidiPort {
  private output: midi.Output | null = null;
  private isOpen: boolean = false;

  constructor(private portName: string = 'Patchwork') {}

  /**
   * Open the virtual MIDI port.
   * Creates a new virtual port visible to DAWs and other MIDI apps.
   */
  open(): boolean {
    try {
      this.output = new midi.Output();
      this.output.openVirtualPort(this.portName);
      this.isOpen = true;
      console.log(`Virtual MIDI port "${this.portName}" opened`);
      return true;
    } catch (error) {
      console.error('Failed to open virtual MIDI port:', error);
      return false;
    }
  }

  /**
   * Send a raw MIDI message.
   * @param message Array of bytes (e.g., [0x90, 60, 127] for note on)
   */
  send(message: number[]): boolean {
    if (!this.isOpen || !this.output) {
      console.warn('Virtual MIDI port not open');
      return false;
    }
    try {
      this.output.sendMessage(message as [number, number, number]);
      return true;
    } catch (error) {
      console.error('Failed to send MIDI message:', error);
      return false;
    }
  }

  /**
   * Send a Control Change message.
   * @param channel MIDI channel (0-15)
   * @param cc CC number (0-127)
   * @param value Value (0-127)
   */
  sendCC(channel: number, cc: number, value: number): boolean {
    const status = 0xb0 | (channel & 0x0f);
    return this.send([status, cc & 0x7f, value & 0x7f]);
  }

  /**
   * Send a Note On message.
   * @param channel MIDI channel (0-15)
   * @param note Note number (0-127)
   * @param velocity Velocity (0-127)
   */
  sendNoteOn(channel: number, note: number, velocity: number): boolean {
    const status = 0x90 | (channel & 0x0f);
    return this.send([status, note & 0x7f, velocity & 0x7f]);
  }

  /**
   * Send a Note Off message.
   * @param channel MIDI channel (0-15)
   * @param note Note number (0-127)
   */
  sendNoteOff(channel: number, note: number): boolean {
    const status = 0x80 | (channel & 0x0f);
    return this.send([status, note & 0x7f, 0]);
  }

  /**
   * Send a Program Change message.
   * @param channel MIDI channel (0-15)
   * @param program Program number (0-127)
   */
  sendProgramChange(channel: number, program: number): boolean {
    const status = 0xc0 | (channel & 0x0f);
    return this.send([status, program & 0x7f]);
  }

  /**
   * Send a SysEx message.
   * @param data Full SysEx message including F0 and F7
   */
  sendSysEx(data: Uint8Array | number[]): boolean {
    return this.send(Array.from(data));
  }

  /** Close the virtual MIDI port */
  close(): void {
    if (this.isOpen && this.output) {
      this.output.closePort();
      this.isOpen = false;
      console.log(`Virtual MIDI port "${this.portName}" closed`);
    }
  }

  /** Check if port is open */
  get opened(): boolean {
    return this.isOpen;
  }
}

/** List available hardware MIDI output ports */
export function listMidiOutputs(): string[] {
  const output = new midi.Output();
  const count = output.getPortCount();
  const ports: string[] = [];
  for (let i = 0; i < count; i++) {
    ports.push(output.getPortName(i));
  }
  output.closePort();
  return ports;
}

/** List available hardware MIDI input ports */
export function listMidiInputs(): string[] {
  const input = new midi.Input();
  const count = input.getPortCount();
  const ports: string[] = [];
  for (let i = 0; i < count; i++) {
    ports.push(input.getPortName(i));
  }
  input.closePort();
  return ports;
}
