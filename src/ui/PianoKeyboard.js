import { MIDI_LOW, MIDI_HIGH } from '../utils/constants.js';

/**
 * SVG piano keyboard, C3–C6 (MIDI 48–84).
 * Emits noteOn/noteOff via a callback.
 */

const BLACK_KEY_OFFSETS = [1, 3, 6, 8, 10]; // semitone offsets within octave that are black

function isBlack(midi) {
  return BLACK_KEY_OFFSETS.includes(midi % 12);
}

export class PianoKeyboard {
  constructor(container, { onNoteOn, onNoteOff }) {
    this.container = container;
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.activeKeys = new Set();
    this.keyElements = new Map(); // midi -> SVG rect
    this.pointerNotes = new Map(); // pointerId -> midi

    // Computer keyboard mapping (bottom two rows)
    // White keys: Z X C V B N M , . / (and more)
    // Black keys: S D   G H J   L ;
    this.keyboardMap = this._buildKeyboardMap();

    this._build();
    this._bindPointerEvents();
    this._bindKeyboardEvents();
  }

  _buildKeyboardMap() {
    const map = new Map();
    // Map computer keys to MIDI notes starting from C3
    // White keys on bottom row
    const whiteKeys = 'zxcvbnm,./';
    const blackKeys = 'sdghjl;';

    // Enumerate white notes from MIDI_LOW
    const whiteNotes = [];
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (!isBlack(m)) whiteNotes.push(m);
    }
    // Map Z-/ to first ~10 white keys
    for (let i = 0; i < whiteKeys.length && i < whiteNotes.length; i++) {
      map.set(whiteKeys[i], whiteNotes[i]);
    }

    // Second row white keys: Q W E R T Y U I O P
    const whiteKeys2 = 'qwertyuiop';
    for (let i = 0; i < whiteKeys2.length && i + whiteKeys.length < whiteNotes.length; i++) {
      map.set(whiteKeys2[i], whiteNotes[i + whiteKeys.length]);
    }

    // Black keys on the row above bottom
    const blackNotes = [];
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (isBlack(m)) blackNotes.push(m);
    }
    for (let i = 0; i < blackKeys.length && i < blackNotes.length; i++) {
      map.set(blackKeys[i], blackNotes[i]);
    }

    // Second row black keys: 2 3   5 6 7   9 0
    const blackKeys2 = '23567890';
    for (let i = 0; i < blackKeys2.length && i + blackKeys.length < blackNotes.length; i++) {
      map.set(blackKeys2[i], blackNotes[i + blackKeys.length]);
    }

    return map;
  }

  _build() {
    // Count white keys for sizing
    let whiteCount = 0;
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (!isBlack(m)) whiteCount++;
    }

    const W = 100; // percentage width
    const whiteW = W / whiteCount;
    const blackW = whiteW * 0.6;
    const whiteH = 100;
    const blackH = 62;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${whiteH}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.display = 'block';
    svg.style.touchAction = 'none'; // prevent scroll on touch

    // Draw white keys first (background layer)
    let whiteIndex = 0;
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (isBlack(m)) continue;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const x = whiteIndex * whiteW;
      rect.setAttribute('x', x);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', whiteW);
      rect.setAttribute('height', whiteH);
      rect.setAttribute('data-midi', m);
      rect.classList.add('piano-key', 'white-key');
      svg.appendChild(rect);
      this.keyElements.set(m, rect);
      whiteIndex++;
    }

    // Draw black keys on top
    whiteIndex = 0;
    for (let m = MIDI_LOW; m <= MIDI_HIGH; m++) {
      if (isBlack(m)) {
        // Black key sits between the previous white key and this position
        const x = whiteIndex * whiteW - blackW / 2;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', 0);
        rect.setAttribute('width', blackW);
        rect.setAttribute('height', blackH);
        rect.setAttribute('rx', 0.3);
        rect.setAttribute('data-midi', m);
        rect.classList.add('piano-key', 'black-key');
        svg.appendChild(rect);
        this.keyElements.set(m, rect);
      } else {
        whiteIndex++;
      }
    }

    this.svg = svg;
    this.container.appendChild(svg);
  }

  _midiFromEvent(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || !el.classList.contains('piano-key')) return null;
    return parseInt(el.getAttribute('data-midi'), 10);
  }

  _bindPointerEvents() {
    const svg = this.svg;

    svg.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      const midi = this._midiFromEvent(e);
      if (midi != null) {
        this.pointerNotes.set(e.pointerId, midi);
        this._pressKey(midi);
      }
    });

    svg.addEventListener('pointermove', (e) => {
      if (!this.pointerNotes.has(e.pointerId)) return;
      const midi = this._midiFromEvent(e);
      const prev = this.pointerNotes.get(e.pointerId);
      if (midi !== prev) {
        if (prev != null) this._releaseKey(prev);
        if (midi != null) {
          this.pointerNotes.set(e.pointerId, midi);
          this._pressKey(midi);
        } else {
          this.pointerNotes.set(e.pointerId, null);
        }
      }
    });

    const pointerUp = (e) => {
      const prev = this.pointerNotes.get(e.pointerId);
      if (prev != null) this._releaseKey(prev);
      this.pointerNotes.delete(e.pointerId);
    };
    svg.addEventListener('pointerup', pointerUp);
    svg.addEventListener('pointercancel', pointerUp);
  }

  _bindKeyboardEvents() {
    this._heldKeys = new Set();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const midi = this.keyboardMap.get(e.key.toLowerCase());
      if (midi != null && !this._heldKeys.has(e.key.toLowerCase())) {
        this._heldKeys.add(e.key.toLowerCase());
        this._pressKey(midi);
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key.toLowerCase();
      const midi = this.keyboardMap.get(key);
      if (midi != null) {
        this._heldKeys.delete(key);
        this._releaseKey(midi);
      }
    });
  }

  _pressKey(midi) {
    if (this.activeKeys.has(midi)) return;
    this.activeKeys.add(midi);
    const el = this.keyElements.get(midi);
    if (el) el.classList.add('active');
    this.onNoteOn(midi);
  }

  _releaseKey(midi) {
    if (!this.activeKeys.has(midi)) return;
    this.activeKeys.delete(midi);
    const el = this.keyElements.get(midi);
    if (el) el.classList.remove('active');
    this.onNoteOff(midi);
  }
}
