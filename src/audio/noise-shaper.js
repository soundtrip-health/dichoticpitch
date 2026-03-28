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
        case 'wind':
          // Wind base: same pink tilt as rain (modulated per-block by NoiseMod)
          tilt[bin] = 1 / Math.sqrt(freq);
          break;
        case 'stream':
          // Slightly steeper pink (1/f^0.6) with 200-800 Hz boost
          tilt[bin] = 1 / Math.pow(freq, 0.6);
          if (freq >= 200 && freq <= 800) tilt[bin] *= 1.5;
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

/**
 * Stateful per-block noise modulation.
 * Manages LFOs and produces a modulated tilt array each block (~21ms).
 * Preallocates all buffers — safe for AudioWorklet process().
 */
class NoiseMod {
  constructor(fftSize, sampleRate) {
    this.fftSize = fftSize;
    this.sampleRate = sampleRate;
    this.halfN = fftSize / 2;

    // 4 independent LFOs (filtered-noise, not sine)
    this.lfo = new Float64Array(4);
    this.lfoAlpha = new Float64Array(4);

    // Precomputed per-bin frequencies (Hz)
    this.binFreqs = new Float64Array(this.halfN + 1);
    for (let bin = 0; bin <= this.halfN; bin++) {
      this.binFreqs[bin] = bin * sampleRate / fftSize;
    }

    this.mode = 'rain';
    this._configureLFOs('rain');
  }

  setMode(mode) {
    this.mode = mode;
    this._configureLFOs(mode);
  }

  _configureLFOs(mode) {
    // Reset LFO alphas; modes configure what they need
    this.lfoAlpha.fill(0);
    switch (mode) {
      case 'rain':
        // Gentle HF variation
        this.lfoAlpha[0] = 0.015;
        break;
      case 'waterfall':
        // Slow surge
        this.lfoAlpha[0] = 0.005;
        break;
      case 'wind':
        // Slope LFO (~1-2s), cutoff LFO (~3-4s)
        this.lfoAlpha[0] = 0.02;
        this.lfoAlpha[1] = 0.01;
        break;
      case 'stream':
        // Fast bubbling, medium texture, slow swell
        this.lfoAlpha[0] = 0.08;
        this.lfoAlpha[1] = 0.03;
        this.lfoAlpha[2] = 0.005;
        break;
    }
  }

  _tickLFOs() {
    for (let i = 0; i < 4; i++) {
      const alpha = this.lfoAlpha[i];
      if (alpha > 0) {
        this.lfo[i] += alpha * (Math.random() - 0.5 - this.lfo[i]);
      }
    }
  }

  /**
   * Produce a modulated tilt array for the current block.
   * @param {Float64Array} baseTilt  Static tilt from NoiseShaper.buildTiltArray
   * @param {Float64Array} outTilt   Output buffer (same size as baseTilt)
   */
  getModulatedTilt(baseTilt, outTilt) {
    this._tickLFOs();

    const halfN = this.halfN;
    const freqs = this.binFreqs;

    switch (this.mode) {
      case 'wind': {
        // Dual-LFO: slope variation + cutoff drift
        const slopeMod = 0.4 * this.lfo[0]; // [-0.4, 0.4] added to exponent
        const cutoffHz = 6000 + 3000 * this.lfo[1]; // 3000-9000 Hz
        const refFreq = 1000; // reference frequency for slope pivot
        for (let bin = 1; bin < halfN; bin++) {
          const f = freqs[bin];
          // Slope modulation: multiply by (f/ref)^slopeMod
          const slopeGain = Math.pow(f / refFreq, slopeMod);
          // Smooth sigmoid rolloff around cutoff (4th-order)
          const ratio = f / cutoffHz;
          const r2 = ratio * ratio;
          const rolloff = 1 / (1 + r2 * r2);
          outTilt[bin] = baseTilt[bin] * slopeGain * rolloff;
        }
        outTilt[0] = 0;
        outTilt[halfN] = 0;
        break;
      }

      case 'rain': {
        // Gentle HF variation above 2kHz
        const hfMod = 0.15 * this.lfo[0]; // [-0.15, 0.15]
        for (let bin = 1; bin < halfN; bin++) {
          const f = freqs[bin];
          if (f > 2000) {
            // Smooth attenuation that increases with frequency above 2kHz
            const t = Math.min((f - 2000) / 4000, 1);
            outTilt[bin] = baseTilt[bin] * (1 - hfMod * t);
          } else {
            outTilt[bin] = baseTilt[bin];
          }
        }
        outTilt[0] = 0;
        outTilt[halfN] = 0;
        break;
      }

      case 'waterfall': {
        // Slow uniform amplitude surge
        const surgeMod = 0.85 + 0.15 * this.lfo[0]; // [0.7, 1.0]
        for (let bin = 0; bin <= halfN; bin++) {
          outTilt[bin] = baseTilt[bin] * surgeMod;
        }
        break;
      }

      case 'stream': {
        // Fast bubbling AM on mids, medium texture on HF, slow overall swell
        const overallSwell = 0.9 + 0.1 * this.lfo[2]; // [0.8, 1.0]
        for (let bin = 1; bin < halfN; bin++) {
          const f = freqs[bin];
          // Mid-band bubbling (300-2000 Hz bandpass weight)
          let midWeight = 0;
          if (f >= 300 && f <= 2000) {
            midWeight = 1;
          } else if (f > 2000 && f < 3000) {
            midWeight = (3000 - f) / 1000;
          } else if (f > 150 && f < 300) {
            midWeight = (f - 150) / 150;
          }
          const midMod = 1 + 0.3 * this.lfo[0] * midWeight;
          // HF texture variation above 1kHz
          const hfWeight = f > 1000 ? Math.min((f - 1000) / 2000, 1) : 0;
          const hfMod = 1 + 0.2 * this.lfo[1] * hfWeight;
          outTilt[bin] = baseTilt[bin] * midMod * hfMod * overallSwell;
        }
        outTilt[0] = 0;
        outTilt[halfN] = 0;
        break;
      }

      default:
        for (let bin = 0; bin <= halfN; bin++) {
          outTilt[bin] = baseTilt[bin];
        }
        break;
    }
  }
}

globalThis.NoiseMod = NoiseMod;
