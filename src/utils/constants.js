export const SAMPLE_RATE = 48000;
export const FFT_SIZE = 2048;
export const HOP_SIZE = 1024;          // 50% overlap
export const WORKLET_QUANTUM = 128;    // Web Audio render quantum
export const QUANTA_PER_BLOCK = HOP_SIZE / WORKLET_QUANTUM; // 8

// Default DSP parameters
export const DEFAULTS = {
  sbr: 1.0,            // signal-to-background ratio
  tsSigMs: 0.6,        // signal time shift (ms) — optimal ITD
  tsBackMs: 0.0,       // background time shift (ms)
  lpfCutoff: 10000,    // low-pass filter cutoff (Hz)
  noiseMode: 'rain',   // 'rain' | 'waterfall'
  tonePan: 0.0,        // [-1, 1]
  bgPan: 0.0,          // [-1, 1]
  masterGain: 0.7,     // [0, 1]
};

// Piano range: C3 (MIDI 48) to C6 (MIDI 84)
export const MIDI_LOW = 48;
export const MIDI_HIGH = 84;
