import * as THREE from 'three';
import particleVert from './shaders/particle.vert?raw';
import particleFrag from './shaders/particle.frag?raw';

const TWO_PI = Math.PI * 2;

/**
 * ParticleSystem — manages a single emitter's particle pool.
 * Renders as THREE.Points with custom shaders and additive blending.
 */
export class ParticleSystem {
  /**
   * @param {object} opts
   * @param {number} opts.count        - max particles
   * @param {THREE.Scene} opts.scene
   * @param {THREE.DataTexture} opts.colormapTex
   * @param {number} opts.lifetime     - particle lifetime in seconds
   * @param {number} opts.baseSpeed    - base emission speed
   * @param {number} opts.energyBoost  - extra speed from energy
   * @param {number} opts.baseSize     - base point size
   */
  constructor({ count, scene, colormapTex, lifetime = 2.0, baseSpeed = 0.3, energyBoost = 0.7, baseSize = 0.08 }) {
    this.count = count;
    this.scene = scene;
    this.lifetime = lifetime;
    this.baseSpeed = baseSpeed;
    this.energyBoost = energyBoost;

    // CPU-side particle state
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.freqBins = new Float32Array(count);
    this.energies = new Float32Array(count);
    this.lives = new Float32Array(count);    // 0 = dead, >0 = alive

    // Free list (ring buffer): all particles start dead
    this.freeList = new Uint16Array(count);
    this.freeHead = 0;
    this.freeTail = count;
    for (let i = 0; i < count; i++) this.freeList[i] = i;

    // Geometry with buffer attributes
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('aVelocity', new THREE.BufferAttribute(this.velocities, 3));
    this.geometry.setAttribute('aFreqBin', new THREE.BufferAttribute(this.freqBins, 1));
    this.geometry.setAttribute('aEnergy', new THREE.BufferAttribute(this.energies, 1));
    this.geometry.setAttribute('aLife', new THREE.BufferAttribute(this.lives, 1));

    // Shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBaseSize: { value: baseSize },
        uColormap: { value: colormapTex },
      },
    });

    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
    scene.add(this.points);

    // CDF workspace for importance sampling
    this._cdf = new Float32Array(128);
  }

  /**
   * Allocate a free particle index, or -1 if pool is exhausted.
   */
  _alloc() {
    if (this.freeHead === this.freeTail) return -1;
    const idx = this.freeList[this.freeHead % this.count];
    this.freeHead++;
    return idx;
  }

  /**
   * Return a particle index to the free pool.
   */
  _free(idx) {
    this.freeList[this.freeTail % this.count] = idx;
    this.freeTail++;
  }

  /**
   * Emit new particles based on the current spectrum.
   * @param {Float32Array} spectrum - VIZ_BINS normalized magnitudes [0,1]
   * @param {THREE.Vector3} emitterPos - current emitter position
   * @param {number} dt - delta time (seconds)
   * @param {number} maxBin - highest active bin (for colormap normalization)
   */
  emit(spectrum, emitterPos, dt, maxBin) {
    // Compute total energy and build CDF for importance sampling
    const cdf = this._cdf;
    let total = 0;
    for (let i = 0; i < spectrum.length; i++) {
      total += spectrum[i];
      cdf[i] = total;
    }
    if (total < 1e-6) return; // silence

    // How many particles to spawn this frame
    // Scale by energy so louder = more particles, capped at 2% of pool per frame
    const spawnRate = this.count / this.lifetime; // particles/sec to sustain pool
    const energyScale = Math.min(total / (spectrum.length * 0.3), 2.0);
    const spawnCount = Math.min(
      Math.ceil(spawnRate * dt * energyScale),
      Math.floor(this.count * 0.03)
    );

    const invTotal = 1 / total;
    const px = emitterPos.x, py = emitterPos.y, pz = emitterPos.z;

    for (let s = 0; s < spawnCount; s++) {
      const idx = this._alloc();
      if (idx < 0) break;

      // Importance-sample a frequency bin from the spectrum CDF
      const r = Math.random() * total;
      let bin = 0;
      // Binary search
      let lo = 0, hi = spectrum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      bin = lo;

      const energy = spectrum[bin];

      // Random direction on unit sphere
      const theta = Math.random() * TWO_PI;
      const cosP = 2 * Math.random() - 1;
      const sinP = Math.sqrt(1 - cosP * cosP);
      const speed = this.baseSpeed + energy * this.energyBoost;
      const vx = sinP * Math.cos(theta) * speed;
      const vy = sinP * Math.sin(theta) * speed;
      const vz = cosP * speed;

      const i3 = idx * 3;
      this.positions[i3] = px;
      this.positions[i3 + 1] = py;
      this.positions[i3 + 2] = pz;
      this.velocities[i3] = vx;
      this.velocities[i3 + 1] = vy;
      this.velocities[i3 + 2] = vz;
      this.freqBins[idx] = maxBin > 0 ? Math.min(bin / maxBin, 1.0) : 0;
      this.energies[idx] = energy;
      this.lives[idx] = 1.0;
    }
  }

  /**
   * Update all live particles: move, age, recycle dead ones.
   * @param {number} dt - delta time (seconds)
   */
  update(dt) {
    const lifeDecay = dt / this.lifetime;
    const pos = this.positions;
    const vel = this.velocities;
    const lives = this.lives;

    for (let i = 0; i < this.count; i++) {
      if (lives[i] <= 0) continue;

      lives[i] -= lifeDecay;
      if (lives[i] <= 0) {
        lives[i] = 0;
        // Move dead particle offscreen to avoid rendering artifacts
        const i3 = i * 3;
        pos[i3] = 0;
        pos[i3 + 1] = 0;
        pos[i3 + 2] = -100;
        this._free(i);
        continue;
      }

      // Move particle
      const i3 = i * 3;
      pos[i3] += vel[i3] * dt;
      pos[i3 + 1] += vel[i3 + 1] * dt;
      pos[i3 + 2] += vel[i3 + 2] * dt;
    }

    // Mark buffers for GPU upload
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aFreqBin.needsUpdate = true;
    this.geometry.attributes.aEnergy.needsUpdate = true;
  }

  /**
   * Replace the colormap texture.
   * @param {THREE.DataTexture} tex
   */
  setColormap(tex) {
    this.material.uniforms.uColormap.value = tex;
  }

  /**
   * Clean up GPU resources.
   */
  destroy() {
    this.scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
  }
}
