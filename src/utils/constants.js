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
  noiseMode: 'rain',   // 'rain' | 'waterfall' | 'wind' | 'stream'
  tonePan: 0.0,        // [-1, 1]
  bgPan: 0.0,          // [-1, 1]
  masterGain: 0.7,     // [0, 1]
};

// Piano range: C3 (MIDI 48) to C6 (MIDI 84)
export const MIDI_LOW = 48;
export const MIDI_HIGH = 84;

// Visualization
export const VIZ_BINS = 128;           // decimated bin count for worklet spectra
export const VIZ_DEFAULTS = {
  // Mode
  mode: 'wavySpiral',   // 'spiral' | 'wavySpiral' | 'flower' | 'circle'
  animate: true,
  intensity: 0.18,       // audio reactivity multiplier
  fov: 35,               // camera field of view (zoom)
  particleCount: 1024,   // particles per spiral
  pointSize: 3.0,

  // Spiral mode params
  spiralA: 0.15,         // inner radius
  spiralB: 0.20,         // outer radius
  spiralAngle: 11,       // winding angle

  // Wavy Spiral mode params
  wavyA: 1.20,
  wavyB: 0.76,
  wavyAngle: 2.44,

  // Flower mode params
  flowerA: 25,
  flowerB: 0,
  flowerAngle: 2.86,

  // Circle mode params
  circleRadius: 50,

  // Color
  colorEmphasis: 'red',  // 'red' | 'green' | 'blue'
  colorR: 0.7,
  colorG: 0.0,
  colorB: 0.7,

  // Spatial emergence timing (ms)
  emergenceRiseMs: 200,
  emergenceFallMs: 500,
};
