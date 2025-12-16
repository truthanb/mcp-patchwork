#!/usr/bin/env node
import { listMidiOutputs, listMidiInputs } from '../midi/hardware-port.js';

console.log('\n📡 MIDI Ports:\n');
console.log('Outputs:', listMidiOutputs());
console.log('Inputs:', listMidiInputs());
