import * as THREE from 'three';
import { SpiralSystem } from './SpiralSystem.js';
import { VIZ_DEFAULTS } from '../utils/constants.js';
import { bus } from '../utils/event-bus.js';

/**
 * VizManager — dual spiral visualization for dichotic pitch.
 *
 * Two spiral patterns (signal and background) are rendered as particle systems.
 * When no notes are playing they overlap at the background position; on noteOn
 * the signal spiral smoothly emerges to its ITD-mapped spatial position.
 *
 * Each spiral is driven by its channel's time-domain audio data (L for signal,
 * R for background), matching the Archimedean spiral patterns from
 * soniaboller/audible-visuals with four modes: spiral, wavy spiral, flower, circle.
 */
export class VizManager {
  constructor(canvas, audioEngine) {
    this.audioEngine = audioEngine;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    // Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(VIZ_DEFAULTS.fov, aspect, 0.1, 1000);
    this.camera.position.set(0, 0, 150);
    this.camera.lookAt(0, 0, 0);

    this.clock = new THREE.Clock();
    this.prevTime = 0;

    // Mutable copy of visualization parameters
    this.vizParams = { ...VIZ_DEFAULTS };

    // Two spiral systems: signal (left channel) and background (right channel)
    const count = this.vizParams.particleCount;
    this.sigSpiral = new SpiralSystem({ count, scene: this.scene });
    this.bgSpiral  = new SpiralSystem({ count, scene: this.scene });

    // Audio analysis buffers (frequencyBinCount = fftSize / 2 = 1024)
    const bufLen = 1024;
    this.timeFloatL = new Float32Array(bufLen);
    this.timeByteL  = new Uint8Array(bufLen);
    this.timeFloatR = new Float32Array(bufLen);
    this.timeByteR  = new Uint8Array(bufLen);

    // Spatial emergence state
    this.bgCenter        = new THREE.Vector3(0, 0, 0);
    this.sigCurrentCenter = new THREE.Vector3(0, 0, 0);
    this.sigTargetCenter  = new THREE.Vector3(0, 0, 0);
    this.emergence = 0; // 0 = superimposed, 1 = fully separated

    this._tsSigMs  = 0.6;
    this._tsBackMs = 0.0;
    bus.on('viz:tsSigMs',  (v) => { this._tsSigMs = v; });
    bus.on('viz:tsBackMs', (v) => { this._tsBackMs = v; });

    // Animation oscillation direction
    this._animDir = 1;

    // Receive individual viz param changes from ParamPanel
    bus.on('viz:param', ({ key, value }) => {
      this.vizParams[key] = value;
      if (key === 'pointSize') {
        this.sigSpiral.setPointSize(value);
        this.bgSpiral.setPointSize(value);
      }
    });

    // Resize
    this._onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', this._onResize);
  }

  /** Map interaural time shift (ms) → x scene coordinate. */
  _itdToX(tMs) {
    // ±0.6 ms maps to roughly ±18 scene units (half the spiral diameter)
    return -tMs * 30;
  }

  /** Smooth emergence / collapse of signal spiral position. */
  _updatePositions(dt) {
    this.bgCenter.x = this._itdToX(this._tsBackMs);
    this.sigTargetCenter.x = this._itdToX(this._tsSigMs);

    const hasNotes = this.audioEngine.vizNoteCount > 0;
    const tau = (hasNotes
      ? this.vizParams.emergenceRiseMs
      : this.vizParams.emergenceFallMs) / 1000;
    const alpha = 1 - Math.exp(-dt / tau);
    const target = hasNotes ? 1 : 0;
    this.emergence += alpha * (target - this.emergence);

    this.sigCurrentCenter.lerpVectors(
      this.bgCenter, this.sigTargetCenter, this.emergence);
  }

  /** Subtle parameter oscillation (matching audible-visuals rates). */
  _updateAnimation() {
    if (!this.vizParams.animate) return;
    const p = this.vizParams;

    switch (p.mode) {
      case 'spiral':
        p.spiralAngle += this._animDir * 0.0008;
        if (p.spiralAngle > 13) this._animDir = -1;
        if (p.spiralAngle < 9)  this._animDir = 1;
        break;
      case 'wavySpiral':
        p.wavyAngle += this._animDir * 0.000004;
        if (p.wavyAngle > 2.48) this._animDir = -1;
        if (p.wavyAngle < 2.43) this._animDir = 1;
        break;
      case 'flower':
        p.flowerAngle += this._animDir * 0.0000004;
        if (p.flowerAngle > 2.87) this._animDir = -1;
        if (p.flowerAngle < 2.85) this._animDir = 1;
        break;
      case 'circle':
        p.circleRadius += this._animDir * 0.05;
        if (p.circleRadius > 65) this._animDir = -1;
        if (p.circleRadius < 35) this._animDir = 1;
        break;
    }
  }

  /** Called each frame from the rAF loop. */
  update() {
    const t = this.clock.getElapsedTime();
    const dt = Math.min(t - this.prevTime, 0.1);
    this.prevTime = t;

    // Fetch time-domain audio from per-channel analysers
    const aL = this.audioEngine.analyserL;
    const aR = this.audioEngine.analyserR;
    if (aL && aR) {
      aL.getFloatTimeDomainData(this.timeFloatL);
      aL.getByteTimeDomainData(this.timeByteL);
      aR.getFloatTimeDomainData(this.timeFloatR);
      aR.getByteTimeDomainData(this.timeByteR);
    }

    // Spatial positions
    this._updatePositions(dt);

    // Parameter animation
    this._updateAnimation();

    // Camera
    this.camera.fov = this.vizParams.fov;
    if (this.vizParams.mode === 'circle') {
      this.camera.position.set(0, 100, 150);
    } else {
      this.camera.position.set(0, 0, 150);
    }
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    // Update both spirals
    this.sigSpiral.update(
      this.vizParams, this.timeFloatL, this.timeByteL, this.sigCurrentCenter);
    this.bgSpiral.update(
      this.vizParams, this.timeFloatR, this.timeByteR, this.bgCenter);

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.sigSpiral.destroy();
    this.bgSpiral.destroy();
    this.renderer.dispose();
  }
}
