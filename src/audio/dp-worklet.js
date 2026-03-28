/**
 * Dichotic Pitch AudioWorkletProcessor
 *
 * M3: Shaped noise — frequency-domain noise generation, spectral tilt,
 *     IFFT, Hann-windowed overlap-add output.
 * M4+ will add bandpass masks, SBR, time shifts for the full DP pipeline.
 *
 * Depends on globalThis.FFT and globalThis.NoiseShaper
 * (loaded via prior addModule() calls in AudioEngine).
 */

const FFT_SIZE = 2048;
const HOP_SIZE = 1024;           // 50% overlap
const QUANTUM = 128;             // Web Audio render quantum
const QUANTA_PER_BLOCK = HOP_SIZE / QUANTUM; // 8
const RING_SIZE = FFT_SIZE * 2;  // 4096 — room for one full overlap cycle
const TWO_PI = 2 * Math.PI;

class DPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.running = false;
    this.amplitude = 0.3;
    this.noiseMode = 'rain';

    // FFT engine
    this.fft = new globalThis.FFT(FFT_SIZE);

    // Preallocated complex buffers (interleaved [re, im, re, im, ...])
    this.specL = new Float64Array(FFT_SIZE * 2);
    this.specR = new Float64Array(FFT_SIZE * 2);
    this.timeL = new Float64Array(FFT_SIZE * 2);
    this.timeR = new Float64Array(FFT_SIZE * 2);

    // OLA output ring buffers
    this.ringL = new Float64Array(RING_SIZE);
    this.ringR = new Float64Array(RING_SIZE);
    this.readPos = 0;
    this.writePos = 0;
    this.quantaCount = 0;

    // Hann window table
    this.hann = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.hann[i] = 0.5 * (1 - Math.cos(TWO_PI * i / FFT_SIZE));
    }

    // Spectral tilt (pre-normalized for RMS ≈ 1 after IFFT)
    this.tilt = globalThis.NoiseShaper.buildTiltArray(
      this.noiseMode, FFT_SIZE, sampleRate
    );

    this.port.onmessage = this.handleMessage.bind(this);

    // Pre-fill first block so output is immediate
    this._generateBlock();
    this.writePos = (this.writePos + HOP_SIZE) % RING_SIZE;
  }

  handleMessage(e) {
    const { type, value } = e.data;
    switch (type) {
      case 'start':
        this.running = true;
        break;
      case 'stop':
        this.running = false;
        break;
      case 'paramUpdate':
        if (e.data.param === 'masterGain') {
          this.amplitude = value;
        } else if (e.data.param === 'noiseMode') {
          this.noiseMode = value;
          this.tilt = globalThis.NoiseShaper.buildTiltArray(
            value, FFT_SIZE, sampleRate
          );
        }
        break;
    }
  }

  /** Fill a complex spectrum array with shaped random noise. */
  _fillSpectrum(spec) {
    const halfN = FFT_SIZE / 2;
    const tilt = this.tilt;

    // DC = 0
    spec[0] = 0;
    spec[1] = 0;

    // Bins 1 .. N/2-1: random phase, tilt-scaled amplitude
    for (let bin = 1; bin < halfN; bin++) {
      const phase = Math.random() * TWO_PI;
      const amp = tilt[bin];
      const idx = bin * 2;
      spec[idx] = amp * Math.cos(phase);
      spec[idx + 1] = amp * Math.sin(phase);
    }

    // Nyquist = 0
    const nyq = halfN * 2;
    spec[nyq] = 0;
    spec[nyq + 1] = 0;

    // Conjugate-symmetric upper half
    this.fft.completeSpectrum(spec);
  }

  /** Generate one OLA block and accumulate into the ring buffer. */
  _generateBlock() {
    // L channel
    this._fillSpectrum(this.specL);
    this.fft.inverseTransform(this.timeL, this.specL);

    // R channel (independent noise)
    this._fillSpectrum(this.specR);
    this.fft.inverseTransform(this.timeR, this.specR);

    // Hann window + overlap-add into ring buffer
    const wp = this.writePos;
    const hann = this.hann;
    const tL = this.timeL;
    const tR = this.timeR;
    const rL = this.ringL;
    const rR = this.ringR;

    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = (wp + i) % RING_SIZE;
      const w = hann[i];
      rL[idx] += tL[i * 2] * w;   // real part of complex IFFT output
      rR[idx] += tR[i * 2] * w;
    }
  }

  process(inputs, outputs) {
    const outL = outputs[0][0];
    const outR = outputs[0][1];

    if (!this.running) {
      outL.fill(0);
      outR.fill(0);
      return true;
    }

    const amp = this.amplitude;
    const rp = this.readPos;
    const rL = this.ringL;
    const rR = this.ringR;

    // Read from ring buffer and clear consumed samples
    for (let i = 0; i < QUANTUM; i++) {
      const idx = (rp + i) % RING_SIZE;
      outL[i] = rL[idx] * amp;
      outR[i] = rR[idx] * amp;
      rL[idx] = 0;
      rR[idx] = 0;
    }
    this.readPos = (rp + QUANTUM) % RING_SIZE;

    // Every HOP_SIZE samples (8 quanta), generate the next block
    this.quantaCount++;
    if (this.quantaCount >= QUANTA_PER_BLOCK) {
      this.quantaCount = 0;
      this._generateBlock();
      this.writePos = (this.writePos + HOP_SIZE) % RING_SIZE;
    }

    return true;
  }
}

registerProcessor('dp-processor', DPProcessor);
