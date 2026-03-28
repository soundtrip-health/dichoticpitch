/**
 * Dichotic Pitch AudioWorkletProcessor
 *
 * M4: Full DP pipeline — frequency-domain noise generation, bandpass masks
 * M7: Independent equal-power panning for tone (sig) and background.
 * M9: 20ms parameter ramping, denormal protection, soft limiter (-1dB).
 *
 * Algorithm (matches Matlab dichoticPitch.m):
 *   [freq]  sig  = tilt-shaped random spectrum
 *   [freq]  back = independent tilt-shaped random spectrum
 *   [freq]  sigFiltered  = sig  * sigMask   (sbr*renorm in-band, 0 out)
 *   [freq]  backFiltered = back * backMask  (max(1-sbr,0)*renorm in-band, 1 out)
 *   [time]  sig_t  = IFFT(sigFiltered),  back_t = IFFT(backFiltered)
 *   [time]  left  = sig_t + back_t
 *   [time]  right = circShift(sig_t, tsSig) + circShift(back_t, tsBack)
 *   [time]  Hann window + overlap-add into output ring buffer
 *
 * Depends on globalThis.FFT, globalThis.NoiseShaper, globalThis.NoteUtils
 * (loaded via prior addModule() calls in AudioEngine).
 */

const FFT_SIZE = 2048;
const HOP_SIZE = 1024;           // 50% overlap
const QUANTUM = 128;             // Web Audio render quantum
const QUANTA_PER_BLOCK = HOP_SIZE / QUANTUM; // 8
const RING_SIZE = FFT_SIZE * 2;  // 4096 — room for one full overlap cycle
const TWO_PI = 2 * Math.PI;
const HALF_N = FFT_SIZE / 2;

// Soft limiter threshold: -1 dBFS ≈ 0.891
const LIMITER_THRESH = Math.pow(10, -1 / 20);

// Denormal protection: values below this are flushed to zero
const DENORMAL_THRESH = 1e-15;

class DPProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.running = false;

    // ---- DSP parameters (smoothed current values) ----
    this.sbr = 1.0;
    this.tsSigMs = 0.6;
    this.tsBackMs = 0.0;
    this.lpfCutoff = 10000;
    this.amplitude = 0.3;
    this.noiseMode = 'rain';
    this.tonePan = 0.0;
    this.bgPan = 0.0;

    // ---- Smoothing targets (set by incoming messages) ----
    this.sbrTarget = 1.0;
    this.tsSigMsTarget = 0.6;
    this.tsBackMsTarget = 0.0;
    this.lpfCutoffTarget = 10000;
    this.amplitudeTarget = 0.3;
    this.tonePanTarget = 0.0;
    this.bgPanTarget = 0.0;

    // ---- Smoothing coefficients ----
    // Per-quantum (~2.7ms at 48kHz): ~7 steps to reach 20ms time constant
    this.smoothCoeff = 1 - Math.exp(-QUANTUM / (0.02 * sampleRate));
    // Per-sample smoothing for amplitude (click-free gain changes)
    this.ampSmoothCoeff = 1 - Math.exp(-1 / (0.02 * sampleRate));

    // ---- Active notes (MIDI → { freq, lowBin, highBin }) ----
    this.activeNotes = new Map();

    // ---- FFT engine ----
    this.fft = new globalThis.FFT(FFT_SIZE);

    // ---- Preallocated complex buffers (interleaved [re, im, ...]) ----
    this.specSig = new Float64Array(FFT_SIZE * 2);
    this.specBack = new Float64Array(FFT_SIZE * 2);
    this.timeSig = new Float64Array(FFT_SIZE * 2);
    this.timeBack = new Float64Array(FFT_SIZE * 2);

    // ---- Filter masks (real-valued, per positive-freq bin) ----
    this.sigMask = new Float64Array(HALF_N + 1);
    this.backMask = new Float64Array(HALF_N + 1);

    // ---- OLA output ring buffers ----
    this.ringL = new Float64Array(RING_SIZE);
    this.ringR = new Float64Array(RING_SIZE);
    this.readPos = 0;
    this.writePos = 0;
    this.quantaCount = 0;

    // ---- Hann window table ----
    this.hann = new Float64Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this.hann[i] = 0.5 * (1 - Math.cos(TWO_PI * i / FFT_SIZE));
    }

    // ---- Spectral tilt (noise shaping) ----
    this.tilt = globalThis.NoiseShaper.buildTiltArray(
      this.noiseMode, FFT_SIZE, sampleRate
    );

    // Build initial masks (no notes → pure shaped noise)
    this._buildMasks();

    this.port.onmessage = this.handleMessage.bind(this);

    // Pre-fill first block so output is immediate
    this._generateBlock();
    this.writePos = (this.writePos + HOP_SIZE) % RING_SIZE;
  }

  // ------------------------------------------------------------------
  // Message handling
  // ------------------------------------------------------------------

  handleMessage(e) {
    const { type } = e.data;
    switch (type) {
      case 'start':
        this.running = true;
        break;
      case 'stop':
        this.running = false;
        break;

      case 'noteOn': {
        const { note } = e.data;
        const freq = globalThis.NoteUtils.midiToFreq(note);
        const { lowBin, highBin } = globalThis.NoteUtils.noteBins(
          freq, FFT_SIZE, sampleRate
        );
        this.activeNotes.set(note, { freq, lowBin, highBin });
        this._buildMasks();
        break;
      }
      case 'noteOff':
        this.activeNotes.delete(e.data.note);
        this._buildMasks();
        break;

      case 'paramUpdate': {
        const { param, value } = e.data;
        switch (param) {
          case 'sbr':        this.sbrTarget = value; break;
          case 'tsSigMs':    this.tsSigMsTarget = value; break;
          case 'tsBackMs':   this.tsBackMsTarget = value; break;
          case 'lpfCutoff':  this.lpfCutoffTarget = value; break;
          case 'masterGain': this.amplitudeTarget = value; break;
          case 'tonePan':    this.tonePanTarget = value; break;
          case 'bgPan':      this.bgPanTarget = value; break;
          case 'noiseMode':
            this.noiseMode = value;
            this.tilt = globalThis.NoiseShaper.buildTiltArray(
              value, FFT_SIZE, sampleRate
            );
            break;
        }
        break;
      }
    }
  }

  // ------------------------------------------------------------------
  // Parameter smoothing — one-pole exponential, per quantum (~2.7ms)
  // ------------------------------------------------------------------

  _smoothParams() {
    const c = this.smoothCoeff;
    let masksNeedRebuild = false;

    // Smooth spectral-shape params; check if they moved enough to warrant mask rebuild
    const prevSbr = this.sbr;
    const prevLpf = this.lpfCutoff;
    this.sbr += c * (this.sbrTarget - this.sbr);
    this.tsSigMs += c * (this.tsSigMsTarget - this.tsSigMs);
    this.tsBackMs += c * (this.tsBackMsTarget - this.tsBackMs);
    this.lpfCutoff += c * (this.lpfCutoffTarget - this.lpfCutoff);
    this.tonePan += c * (this.tonePanTarget - this.tonePan);
    this.bgPan += c * (this.bgPanTarget - this.bgPan);

    // Rebuild masks only when sbr or lpfCutoff changed appreciably
    if (Math.abs(this.sbr - prevSbr) > 1e-6 ||
        Math.abs(this.lpfCutoff - prevLpf) > 0.5) {
      masksNeedRebuild = true;
    }

    return masksNeedRebuild;
  }

  // ------------------------------------------------------------------
  // Soft limiter: tanh-based saturation at -1 dBFS
  // ------------------------------------------------------------------

  static _softLimit(x) {
    if (x > LIMITER_THRESH) {
      return LIMITER_THRESH * Math.tanh(x / LIMITER_THRESH);
    } else if (x < -LIMITER_THRESH) {
      return -LIMITER_THRESH * Math.tanh(-x / LIMITER_THRESH);
    }
    return x;
  }

  // ------------------------------------------------------------------
  // Denormal protection: flush tiny values to zero
  // ------------------------------------------------------------------

  static _flushDenormal(x) {
    return (x > DENORMAL_THRESH || x < -DENORMAL_THRESH) ? x : 0;
  }

  // ------------------------------------------------------------------
  // Filter mask construction (per Matlab lines 86-95, with folded renorm)
  // ------------------------------------------------------------------

  _buildMasks() {
    const sigM = this.sigMask;
    const backM = this.backMask;
    const sbr = this.sbr;

    // Renormalization factor: keeps overall energy constant when sbr < 1.
    // For independent noise sources: renorm = 1 / sqrt(sbr² + (1-sbr)²)
    const renorm = sbr < 1
      ? 1 / Math.sqrt(sbr * sbr + (1 - sbr) * (1 - sbr))
      : 1;

    // Default: sig = 0 (no pitch signal), back = 1 (full noise everywhere)
    sigM.fill(0);
    backM.fill(1);

    // Apply note bands — OR logic: each band independently stamps the mask
    for (const { lowBin, highBin } of this.activeNotes.values()) {
      const lo = Math.max(1, lowBin);
      const hi = Math.min(HALF_N - 1, highBin);
      for (let bin = lo; bin <= hi; bin++) {
        sigM[bin] = sbr * renorm;
        backM[bin] = Math.max(1 - sbr, 0) * renorm;
      }
    }

    // Spectral LPF: zero everything above cutoff
    const lpfBin = Math.round(this.lpfCutoff / (sampleRate / FFT_SIZE));
    const startZero = Math.min(lpfBin + 1, HALF_N);
    for (let bin = startZero; bin <= HALF_N; bin++) {
      sigM[bin] = 0;
      backM[bin] = 0;
    }
  }

  // ------------------------------------------------------------------
  // Spectrum generation: tilt-shaped amplitude × mask, random phases
  // ------------------------------------------------------------------

  _fillSpectrum(spec, mask) {
    const tilt = this.tilt;

    // DC = 0
    spec[0] = 0;
    spec[1] = 0;

    // Bins 1 .. N/2-1
    for (let bin = 1; bin < HALF_N; bin++) {
      const amp = tilt[bin] * mask[bin];
      if (amp === 0) {
        spec[bin * 2] = 0;
        spec[bin * 2 + 1] = 0;
      } else {
        const phase = Math.random() * TWO_PI;
        spec[bin * 2] = amp * Math.cos(phase);
        spec[bin * 2 + 1] = amp * Math.sin(phase);
      }
    }

    // Nyquist = 0
    spec[HALF_N * 2] = 0;
    spec[HALF_N * 2 + 1] = 0;

    // Fill conjugate-symmetric upper half
    this.fft.completeSpectrum(spec);
  }

  // ------------------------------------------------------------------
  // Block generation: the full DP pipeline
  // ------------------------------------------------------------------

  _generateBlock() {
    // 1. Generate sig and back spectra (tilt × mask applied)
    this._fillSpectrum(this.specSig, this.sigMask);
    this._fillSpectrum(this.specBack, this.backMask);

    // 2. IFFT → time domain
    this.fft.inverseTransform(this.timeSig, this.specSig);
    this.fft.inverseTransform(this.timeBack, this.specBack);

    // 3. Compute circular shift amounts (samples)
    const tsSigSamp = Math.round(this.tsSigMs / 1000 * sampleRate);
    const tsBackSamp = Math.round(this.tsBackMs / 1000 * sampleRate);

    // 4. Equal-power panning gains for tone (sig) and background
    //    pan in [-1,1] → angle in [0, π/2]; gainL = cos(θ), gainR = sin(θ)
    const QUARTER_PI = Math.PI * 0.25;
    const toneAngle = (this.tonePan + 1) * QUARTER_PI;
    const toneLGain = Math.cos(toneAngle);
    const toneRGain = Math.sin(toneAngle);
    const bgAngle = (this.bgPan + 1) * QUARTER_PI;
    const bgLGain = Math.cos(bgAngle);
    const bgRGain = Math.sin(bgAngle);

    // 5. Hann window + OLA accumulate with per-ear time shifts + panning
    const wp = this.writePos;
    const hann = this.hann;
    const rL = this.ringL;
    const rR = this.ringR;
    const tS = this.timeSig;
    const tB = this.timeBack;
    const N = FFT_SIZE;

    for (let i = 0; i < N; i++) {
      const olaIdx = (wp + i) % RING_SIZE;
      const w = hann[i];

      // Unshifted time-domain samples (real part of interleaved IFFT)
      const sigI = tS[i * 2];
      const backI = tB[i * 2];

      // Circular-shifted indices for right ear
      const sigShiftIdx = ((i - tsSigSamp) % N + N) % N;
      const backShiftIdx = ((i - tsBackSamp) % N + N) % N;
      const sigShifted = tS[sigShiftIdx * 2];
      const backShifted = tB[backShiftIdx * 2];

      // Left ear: unshifted sig/back, panned
      // Right ear: circShifted sig/back, panned
      // Both Hann-windowed for OLA, with denormal protection
      rL[olaIdx] = DPProcessor._flushDenormal(
        rL[olaIdx] + (sigI * toneLGain + backI * bgLGain) * w
      );
      rR[olaIdx] = DPProcessor._flushDenormal(
        rR[olaIdx] + (sigShifted * toneRGain + backShifted * bgRGain) * w
      );
    }
  }

  // ------------------------------------------------------------------
  // AudioWorklet process callback
  // ------------------------------------------------------------------

  process(inputs, outputs) {
    const outL = outputs[0][0];
    const outR = outputs[0][1];

    if (!this.running) {
      outL.fill(0);
      outR.fill(0);
      return true;
    }

    // Smooth parameters per quantum
    const masksNeedRebuild = this._smoothParams();
    if (masksNeedRebuild) this._buildMasks();

    const rp = this.readPos;
    const rL = this.ringL;
    const rR = this.ringR;
    const alphaAmp = this.ampSmoothCoeff;
    let amp = this.amplitude;
    const ampTarget = this.amplitudeTarget;

    // Read from ring buffer with per-sample amplitude smoothing + soft limiter
    for (let i = 0; i < QUANTUM; i++) {
      // Per-sample amplitude ramp (click-free gain changes)
      amp += alphaAmp * (ampTarget - amp);

      const idx = (rp + i) % RING_SIZE;
      outL[i] = DPProcessor._softLimit(rL[idx] * amp);
      outR[i] = DPProcessor._softLimit(rR[idx] * amp);
      rL[idx] = 0;
      rR[idx] = 0;
    }
    this.amplitude = amp;
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
