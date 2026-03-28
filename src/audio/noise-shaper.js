/**
 * Spectral tilt functions for noise shaping.
 * Loaded into AudioWorkletGlobalScope via addModule() before dp-worklet.js.
 *
 * Rain:      pink tilt, -3 dB/octave (amplitude ∝ 1/√f)
 * Waterfall: flat below 500 Hz, -6 dB/octave above (amplitude ∝ 1/f)
 */

const NoiseShaper = {
  /**
   * Build a per-bin amplitude array for the given noise mode.
   * Pre-normalized so IFFT output has RMS ≈ 1.0.
   *
   * @param {string}  mode       'rain' | 'waterfall' | 'white'
   * @param {number}  fftSize    e.g. 2048
   * @param {number}  sampleRate e.g. 48000
   * @returns {Float64Array}     tilt[0 .. fftSize/2]
   */
  buildTiltArray(mode, fftSize, sampleRate) {
    const halfN = fftSize / 2;
    const numBins = halfN + 1;
    const tilt = new Float64Array(numBins);

    // DC and Nyquist stay zero
    for (let bin = 1; bin < halfN; bin++) {
      const freq = bin * sampleRate / fftSize;
      switch (mode) {
        case 'rain':
          // Pink: amplitude ∝ 1/√f
          tilt[bin] = 1 / Math.sqrt(freq);
          break;
        case 'waterfall':
          // Flat below 500 Hz, rolls off above
          tilt[bin] = freq <= 500 ? 1 : 500 / freq;
          break;
        default:
          tilt[bin] = 1;
      }
    }

    // Normalize so IFFT output has RMS ≈ 1.0
    // Parseval: RMS²(x) = 2·Σtilt² / N²  →  gain = N / √(2·Σtilt²)
    let sumSq = 0;
    for (let bin = 1; bin < halfN; bin++) sumSq += tilt[bin] * tilt[bin];
    if (sumSq > 0) {
      const gain = fftSize / Math.sqrt(2 * sumSq);
      for (let bin = 1; bin < halfN; bin++) tilt[bin] *= gain;
    }

    return tilt;
  },
};

globalThis.NoiseShaper = NoiseShaper;
