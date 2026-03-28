import { PianoKeyboard } from './PianoKeyboard.js';
import { ParamPanel } from './ParamPanel.js';
import { TransportBar } from './TransportBar.js';

/**
 * Top-level UI coordinator. Wires piano, param panel, transport,
 * and MIDI input to the AudioEngine.
 */
export class UIManager {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;

    this.transport = new TransportBar(
      document.getElementById('transport-bar'),
      {
        onStart: () => audioEngine.startNoise(),
        onStop: () => audioEngine.stopNoise(),
      }
    );

    this.paramPanel = new ParamPanel(
      document.getElementById('param-panel'),
      {
        onParamChange: (param, value) => audioEngine.setParam(param, value),
      }
    );

    this.piano = new PianoKeyboard(
      document.getElementById('piano-container'),
      {
        onNoteOn: (midi) => audioEngine.noteOn(midi),
        onNoteOff: (midi) => audioEngine.noteOff(midi),
      }
    );

    this._initMIDI();
  }

  async _initMIDI() {
    if (!navigator.requestMIDIAccess) return;
    try {
      const midi = await navigator.requestMIDIAccess();
      for (const input of midi.inputs.values()) {
        this._connectMIDIInput(input);
      }
      midi.onstatechange = (e) => {
        if (e.port.type === 'input' && e.port.state === 'connected') {
          this._connectMIDIInput(e.port);
        }
      };
    } catch (err) {
      console.warn('MIDI not available:', err.message);
    }
  }

  _connectMIDIInput(input) {
    input.onmidimessage = (e) => {
      const [status, note, velocity] = e.data;
      const cmd = status & 0xf0;
      if (cmd === 0x90 && velocity > 0) {
        this.audioEngine.noteOn(note, velocity);
      } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
        this.audioEngine.noteOff(note);
      }
    };
  }
}
