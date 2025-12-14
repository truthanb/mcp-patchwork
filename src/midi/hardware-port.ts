/**
 * Hardware MIDI Port
 * 
 * Connects to a real hardware MIDI device by port name.
 */

import midi from 'midi';

export class HardwareMidiPort {
  private output: midi.Output | null = null;
  private input: midi.Input | null = null;
  private isOpen: boolean = false;
  private portIndex: number = -1;
  private sysexCallback: ((message: number[]) => void) | null = null;

  constructor(private portName: string) {}

  /**
   * Find and open a hardware MIDI port by name (partial match).
   */
  open(): boolean {
    try {
      this.output = new midi.Output();
      const count = this.output.getPortCount();
      
      for (let i = 0; i < count; i++) {
        const name = this.output.getPortName(i);
        if (name.toLowerCase().includes(this.portName.toLowerCase())) {
          this.output.openPort(i);
          this.portIndex = i;
          this.isOpen = true;
          console.log(`Opened hardware MIDI port: "${name}" (index ${i})`);
          return true;
        }
      }

      console.error(`No MIDI port found matching "${this.portName}"`);
      console.error('Available ports:', listMidiOutputs());
      return false;
    } catch (error) {
      console.error('Failed to open hardware MIDI port:', error);
      return false;
    }
  }

  /**
   * Send a raw MIDI message.
   */
  send(message: number[]): boolean {
    if (!this.isOpen || !this.output) {
      console.warn('Hardware MIDI port not open');
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
   */
  sendCC(channel: number, cc: number, value: number): boolean {
    const status = 0xb0 | (channel & 0x0f);
    return this.send([status, cc & 0x7f, value & 0x7f]);
  }

  /**
   * Send a Note On message.
   */
  sendNoteOn(channel: number, note: number, velocity: number): boolean {
    const status = 0x90 | (channel & 0x0f);
    return this.send([status, note & 0x7f, velocity & 0x7f]);
  }

  /**
   * Send a Note Off message.
   */
  sendNoteOff(channel: number, note: number): boolean {
    const status = 0x80 | (channel & 0x0f);
    return this.send([status, note & 0x7f, 0]);
  }

  /**
   * Send a Program Change message.
   */
  sendProgramChange(channel: number, program: number): boolean {
    const status = 0xc0 | (channel & 0x0f);
    return this.send([status, program & 0x7f]);
  }

  /**
   * Send an NRPN message sequence.
   * @param channel MIDI channel (0-15)
   * @param paramNumber NRPN parameter number (0-16383)
   * @param value 14-bit value (0-16383)
   */
  sendNRPN(channel: number, paramNumber: number, value: number): boolean {
    const paramMSB = (paramNumber >> 7) & 0x7F;
    const paramLSB = paramNumber & 0x7F;
    const valueMSB = (value >> 7) & 0x7F;
    const valueLSB = value & 0x7F;

    // Send NRPN sequence
    return (
      this.sendCC(channel, 99, paramMSB) &&  // NRPN MSB
      this.sendCC(channel, 98, paramLSB) &&  // NRPN LSB
      this.sendCC(channel, 6, valueMSB) &&   // Data Entry MSB
      this.sendCC(channel, 38, valueLSB)     // Data Entry LSB
    );
  }

  /**
   * Send a System Exclusive (SysEx) message.
   * @param message Complete SysEx message including 0xF0 start and 0xF7 end
   */
  sendSysEx(message: number[]): boolean {
    if (!this.isOpen || !this.output) {
      console.warn('Hardware MIDI port not open');
      return false;
    }
    if (message.length < 2) {
      console.warn('SysEx message too short');
      return false;
    }
    if (message[0] !== 0xF0) {
      console.warn('SysEx message must start with 0xF0');
      return false;
    }
    if (message[message.length - 1] !== 0xF7) {
      console.warn('SysEx message must end with 0xF7');
      return false;
    }
    try {
      this.output.sendMessage(message as any);
      return true;
    } catch (error) {
      console.error('Failed to send SysEx message:', error);
      return false;
    }
  }

  /**
   * Enable SysEx input listening.
   * Opens a MIDI input port and calls the callback when SysEx messages arrive.
   * @param callback Function to handle incoming SysEx messages
   */
  enableSysExInput(callback: (message: number[]) => void): boolean {
    if (!this.isOpen) {
      console.warn('Output port not open, cannot enable SysEx input');
      return false;
    }

    try {
      this.input = new midi.Input();
      const count = this.input.getPortCount();
      
      // Find matching input port (same name as output)
      for (let i = 0; i < count; i++) {
        const name = this.input.getPortName(i);
        if (name.toLowerCase().includes(this.portName.toLowerCase())) {
          this.input.openPort(i);
          this.sysexCallback = callback;
          
          // Set up message listener
          this.input.on('message', (deltaTime: number, message: number[]) => {
            // Check if it's a SysEx message (starts with 0xF0)
            if (message[0] === 0xF0 && this.sysexCallback) {
              this.sysexCallback(message);
            }
          });
          
          console.log(`Enabled SysEx input on: "${name}" (index ${i})`);
          return true;
        }
      }

      console.error(`No MIDI input port found matching "${this.portName}"`);
      return false;
    } catch (error) {
      console.error('Failed to enable SysEx input:', error);
      return false;
    }
  }

  /**
   * Disable SysEx input listening.
   */
  disableSysExInput(): void {
    if (this.input) {
      this.input.closePort();
      this.input = null;
      this.sysexCallback = null;
      console.log('SysEx input disabled');
    }
  }

  /** Close the MIDI port */
  close(): void {
    this.disableSysExInput();
    if (this.isOpen && this.output) {
      this.output.closePort();
      this.isOpen = false;
      console.log('Hardware MIDI port closed');
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

/** Find a MIDI output port by partial name match */
export function findMidiOutput(partialName: string): string | null {
  const ports = listMidiOutputs();
  return ports.find(p => p.toLowerCase().includes(partialName.toLowerCase())) ?? null;
}
