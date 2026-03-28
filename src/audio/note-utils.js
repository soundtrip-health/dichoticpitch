/**
 * Note utilities for dichotic pitch.
 * Loaded into AudioWorkletGlobalScope via addModule() before dp-worklet.js.
 *
 * MIDI → frequency conversion, bandwidth calculation, note names.
 */

const NoteUtils = {
  /**
   * MIDI note number → frequency in Hz.
   * @param {number} midi  MIDI note (e.g. 60 = C4)
   * @returns {number}     frequency in Hz
   */
  midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  /**
   * Bandwidth for a DP note, matching Matlab convention: peak / 20.
   * Produces a narrow rectangular passband (~5% of center frequency).
   * @param {number} freq  center frequency in Hz
   * @returns {number}     bandwidth in Hz
   */
  noteBandwidth(freq) {
    return freq / 20;
  },

  /**
   * MIDI note number → human-readable name (e.g. 60 → "C4").
   * @param {number} midi
   * @returns {string}
   */
  noteName(midi) {
    const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return names[midi % 12] + octave;
  },

  /**
   * Compute FFT bin range for a note.
   * @param {number} freq       center frequency in Hz
   * @param {number} fftSize    FFT size (e.g. 2048)
   * @param {number} sampleRate e.g. 48000
   * @returns {{ lowBin: number, highBin: number }}
   */
  noteBins(freq, fftSize, sampleRate) {
    const bw = NoteUtils.noteBandwidth(freq);
    const binHz = sampleRate / fftSize;
    return {
      lowBin: Math.floor((freq - bw / 2) / binHz),
      highBin: Math.ceil((freq + bw / 2) / binHz),
    };
  },
};

globalThis.NoteUtils = NoteUtils;
