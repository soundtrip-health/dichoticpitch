import * as THREE from 'three';
import spiralVert from './shaders/spiral.vert?raw';
import spiralFrag from './shaders/spiral.frag?raw';

/**
 * SpiralSystem — renders one spiral pattern as THREE.Points.
 *
 * Supports four modes (Archimedean spiral variants + circle),
 * with audio-reactive displacement and per-particle color perturbation.
 */
export class SpiralSystem {
  constructor({ count, scene }) {
    this.count = count;
    this.scene = scene;

    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);

    this.geometry = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.positions, 3);
    this.colAttr = new THREE.BufferAttribute(this.colors, 3);
    this.geometry.setAttribute('position', this.posAttr);
    this.geometry.setAttribute('aColor', this.colAttr);

    this.material = new THREE.ShaderMaterial({
      vertexShader: spiralVert,
      fragmentShader: spiralFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPointSize: { value: 3.0 },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  /**
   * Recompute all particle positions and colors for the current frame.
   * @param {object} p        - visualization parameters (VIZ_DEFAULTS shape)
   * @param {Float32Array} af - float time-domain audio data
   * @param {Uint8Array} ab   - byte time-domain audio data
   * @param {THREE.Vector3} c - emitter center position
   */
  update(p, af, ab, c) {
    const pos = this.positions;
    const col = this.colors;
    const n = this.count;
    const cx = c.x, cy = c.y, cz = c.z;
    const { intensity, colorR, colorG, colorB, colorEmphasis, mode } = p;
    const afLen = af.length;

    for (let j = 0; j < n; j++) {
      const fi = j % afLen;
      // Audio displacement: product of float and byte time-domain, scaled by intensity
      const audioDisp = af[fi] * ab[fi] * intensity;

      let x, y, z;

      switch (mode) {
        case 'spiral': {
          const t = (p.spiralAngle / 100) * j;
          x = (p.spiralA + p.spiralB * t) * Math.sin(t);
          y = (p.spiralA + p.spiralB * t) * Math.cos(t);
          z = audioDisp;
          break;
        }
        case 'wavySpiral': {
          const t = (p.wavyAngle / 100) * j;
          const inv = j / (p.wavyAngle / 100);
          x = (p.wavyA + p.wavyB * t) * Math.sin(t) + Math.sin(inv);
          y = (p.wavyA + p.wavyB * t) * Math.cos(t) + Math.cos(inv);
          z = audioDisp;
          break;
        }
        case 'flower': {
          const t = (p.flowerAngle / 100) * j;
          const inv = j / (p.flowerAngle / 100);
          x = (p.flowerA + p.flowerB * t) * Math.cos(t) + Math.sin(inv) * 17;
          y = (p.flowerA + p.flowerB * t) * Math.sin(t) + Math.cos(inv) * 17;
          z = audioDisp;
          break;
        }
        case 'circle': {
          const r = p.circleRadius;
          x = Math.sin(j) * r;
          y = audioDisp;
          z = Math.cos(j) * r;
          break;
        }
        default:
          x = y = z = 0;
      }

      const i3 = j * 3;
      pos[i3]     = x + cx;
      pos[i3 + 1] = y + cy;
      pos[i3 + 2] = z + cz;

      // Per-particle color: base RGB ± audio-driven perturbation on the emphasis channel
      const av = af[fi];
      switch (colorEmphasis) {
        case 'red':
          col[i3]     = colorR + av;
          col[i3 + 1] = colorG - av;
          col[i3 + 2] = colorB - av;
          break;
        case 'green':
          col[i3]     = colorR - av;
          col[i3 + 1] = colorG + av;
          col[i3 + 2] = colorB - av;
          break;
        case 'blue':
          col[i3]     = colorR - av;
          col[i3 + 1] = colorG - av;
          col[i3 + 2] = colorB + av;
          break;
      }
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
  }

  setPointSize(size) {
    this.material.uniforms.uPointSize.value = size;
  }

  destroy() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
