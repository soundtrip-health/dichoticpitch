import * as THREE from 'three';
import { createSpectrumPlane } from './geometries.js';
import spectrumVert from './shaders/spectrum.vert?raw';
import spectrumFrag from './shaders/spectrum.frag?raw';
import { SAMPLE_RATE, FFT_SIZE } from '../utils/constants.js';

// NoteUtils for main thread — mirrors worklet's note-utils.js
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
function noteBandwidth(freq) {
  return freq / 20;
}

/**
 * VizManager — Three.js scene with dual L/R spectrum bar displays.
 * Active note bands are highlighted in a distinct glow color.
 */
export class VizManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {import('../audio/AudioEngine.js').AudioEngine} audioEngine
   */
  constructor(canvas, audioEngine) {
    this.audioEngine = audioEngine;
    this.freqBinCount = audioEngine.analyserL.frequencyBinCount;

    // Byte arrays for frequency data
    this.freqDataL = new Uint8Array(this.freqBinCount);
    this.freqDataR = new Uint8Array(this.freqBinCount);

    // Three.js setup
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();

    // Orthographic camera: maps [-1,1] x [-1,1] to viewport
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.z = 1;

    // DataTextures for frequency data (1D: width = freqBinCount, height = 1)
    this.texL = this._createDataTexture();
    this.texR = this._createDataTexture();

    // Shared uniform arrays for active note bands
    this.noteBandArray = new Float32Array(16); // 8 notes max × 2 (lo, hi)
    this.noteBandCount = { value: 0 };

    // Build spectrum meshes
    this.meshL = this._createSpectrumMesh(this.texL, {
      baseColor: new THREE.Color(0.3, 0.5, 0.9),
      bandColor: new THREE.Color(0.4, 0.85, 1.0),
      flip: 1.0,
      yOffset: 0.25,
    });
    this.meshR = this._createSpectrumMesh(this.texR, {
      baseColor: new THREE.Color(0.9, 0.4, 0.5),
      bandColor: new THREE.Color(1.0, 0.6, 0.4),
      flip: -1.0,
      yOffset: -0.25,
    });

    this.scene.add(this.meshL);
    this.scene.add(this.meshR);

    // Divider line between L and R
    const dividerGeo = new THREE.PlaneGeometry(2.0, 0.002);
    const dividerMat = new THREE.MeshBasicMaterial({ color: 0x334455, transparent: true, opacity: 0.5 });
    this.divider = new THREE.Mesh(dividerGeo, dividerMat);
    this.divider.position.z = 0.01;
    this.scene.add(this.divider);

    // Labels (using sprite text)
    this._addLabel('L', -0.92, 0.7, 0.3, 0.5, 0.9);
    this._addLabel('R', -0.92, -0.7, 0.9, 0.4, 0.5);

    // Clock for shader time uniform
    this.clock = new THREE.Clock();

    // Handle resize
    this._onResize = () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  /** Create a 1×freqBinCount DataTexture for frequency data */
  _createDataTexture() {
    const data = new Uint8Array(this.freqBinCount);
    const tex = new THREE.DataTexture(data, this.freqBinCount, 1, THREE.RedFormat);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Create a spectrum bar mesh.
   * @param {THREE.DataTexture} freqTex
   * @param {{ baseColor: THREE.Color, bandColor: THREE.Color, flip: number, yOffset: number }} opts
   */
  _createSpectrumMesh(freqTex, opts) {
    const geo = createSpectrumPlane(2.0, 0.9);
    const mat = new THREE.ShaderMaterial({
      vertexShader: spectrumVert,
      fragmentShader: spectrumFrag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uFreqData: { value: freqTex },
        uNoteBands: { value: this.noteBandArray },
        uNoteBandCount: this.noteBandCount,
        uTime: { value: 0 },
        uFlip: { value: opts.flip },
        uBaseColor: { value: opts.baseColor },
        uBandColor: { value: opts.bandColor },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = opts.yOffset;
    return mesh;
  }

  /** Add a small text label sprite */
  _addLabel(text, x, y, r, g, b) {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r * 255 | 0}, ${g * 255 | 0}, ${b * 255 | 0})`;
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 32, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.6 });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, 0.02);
    sprite.scale.set(0.08, 0.08, 1);
    this.scene.add(sprite);
  }

  /** Update active note band uniforms from audioEngine.activeNotes */
  _updateNoteBands() {
    const notes = this.audioEngine.activeNotes;
    let count = 0;
    const nyquist = SAMPLE_RATE / 2;

    for (const midi of notes) {
      if (count >= 8) break;
      const freq = midiToFreq(midi);
      const bw = noteBandwidth(freq);
      // Normalize to [0, 1] where 1 = Nyquist
      // But our spectrum display maps x to bin index / freqBinCount
      // which corresponds to freq / Nyquist
      const lo = Math.max(0, (freq - bw / 2) / nyquist);
      const hi = Math.min(1, (freq + bw / 2) / nyquist);
      this.noteBandArray[count * 2] = lo;
      this.noteBandArray[count * 2 + 1] = hi;
      count++;
    }
    this.noteBandCount.value = count;
  }

  /** Called each frame from the rAF loop */
  update() {
    // Grab frequency data from analysers
    this.audioEngine.analyserL.getByteFrequencyData(this.freqDataL);
    this.audioEngine.analyserR.getByteFrequencyData(this.freqDataR);

    // Update DataTextures
    this.texL.image.data.set(this.freqDataL);
    this.texL.needsUpdate = true;
    this.texR.image.data.set(this.freqDataR);
    this.texR.needsUpdate = true;

    // Update note band uniforms
    this._updateNoteBands();

    // Update time
    const t = this.clock.getElapsedTime();
    this.meshL.material.uniforms.uTime.value = t;
    this.meshR.material.uniforms.uTime.value = t;

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
  }
}
