import * as THREE from 'three';

/**
 * Colormap texture generator for particle visualization.
 * Each colormap is a function mapping t ∈ [0,1] → [r,g,b] ∈ [0,1].
 * Generates a 256×1 RGBA DataTexture for GPU lookup.
 */

// Viridis polynomial approximation (Mattz, CC0)
// Attempt to match matplotlib viridis with compact polynomial fits.
function viridis(t) {
  const c0 = [0.2777, 0.0054, 0.3340];
  const c1 = [0.1050, 1.4046, 1.3860];
  const c2 = [-0.3308, 0.2148, 3.0264];
  const c3 = [-4.6342, -5.7991, -5.5530];
  const c4 = [6.2282, 14.1799, 2.5326];
  const c5 = [4.7763, -13.7451, 12.8885];
  const c6 = [-5.4354, 4.6459, -16.6864];

  const r = c0[0] + t*(c1[0] + t*(c2[0] + t*(c3[0] + t*(c4[0] + t*(c5[0] + t*c6[0])))));
  const g = c0[1] + t*(c1[1] + t*(c2[1] + t*(c3[1] + t*(c4[1] + t*(c5[1] + t*c6[1])))));
  const b = c0[2] + t*(c1[2] + t*(c2[2] + t*(c3[2] + t*(c4[2] + t*(c5[2] + t*c6[2])))));
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

// Inferno polynomial approximation
function inferno(t) {
  const c0 = [0.0002, 0.0016, 0.0139];
  const c1 = [0.1260, 0.0417, 0.8743];
  const c2 = [3.4319, -0.0939, -2.8201];
  const c3 = [-11.8608, 8.0875, 2.0030];
  const c4 = [17.3481, -15.0101, 4.4310];
  const c5 = [-7.5575, 10.3763, -10.2515];
  const c6 = [-1.6767, -3.3280, 5.7594];

  const r = c0[0] + t*(c1[0] + t*(c2[0] + t*(c3[0] + t*(c4[0] + t*(c5[0] + t*c6[0])))));
  const g = c0[1] + t*(c1[1] + t*(c2[1] + t*(c3[1] + t*(c4[1] + t*(c5[1] + t*c6[1])))));
  const b = c0[2] + t*(c1[2] + t*(c2[2] + t*(c3[2] + t*(c4[2] + t*(c5[2] + t*c6[2])))));
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

// Plasma polynomial approximation
function plasma(t) {
  const c0 = [0.0500, 0.0300, 0.5280];
  const c1 = [1.6590, 0.2587, 0.5985];
  const c2 = [-0.6528, -1.4267, -3.2789];
  const c3 = [-5.1891, 8.1599, 10.8015];
  const c4 = [13.0518, -15.0521, -12.8669];
  const c5 = [-10.7373, 11.4030, 4.2994];
  const c6 = [1.4168, -2.3901, 1.0100];

  const r = c0[0] + t*(c1[0] + t*(c2[0] + t*(c3[0] + t*(c4[0] + t*(c5[0] + t*c6[0])))));
  const g = c0[1] + t*(c1[1] + t*(c2[1] + t*(c3[1] + t*(c4[1] + t*(c5[1] + t*c6[1])))));
  const b = c0[2] + t*(c1[2] + t*(c2[2] + t*(c3[2] + t*(c4[2] + t*(c5[2] + t*c6[2])))));
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

// Magma polynomial approximation
function magma(t) {
  const c0 = [0.0015, 0.0005, 0.0139];
  const c1 = [0.1094, 0.0656, 0.8665];
  const c2 = [3.1073, -0.2440, -3.1864];
  const c3 = [-8.5836, 5.0600, 7.2572];
  const c4 = [7.3255, -3.3277, -6.4579];
  const c5 = [1.7758, -3.5124, -0.1576];
  const c6 = [-3.3523, 2.0297, 2.6024];

  const r = c0[0] + t*(c1[0] + t*(c2[0] + t*(c3[0] + t*(c4[0] + t*(c5[0] + t*c6[0])))));
  const g = c0[1] + t*(c1[1] + t*(c2[1] + t*(c3[1] + t*(c4[1] + t*(c5[1] + t*c6[1])))));
  const b = c0[2] + t*(c1[2] + t*(c2[2] + t*(c3[2] + t*(c4[2] + t*(c5[2] + t*c6[2])))));
  return [Math.max(0, Math.min(1, r)), Math.max(0, Math.min(1, g)), Math.max(0, Math.min(1, b))];
}

const COLORMAPS = { viridis, inferno, plasma, magma };
export const COLORMAP_NAMES = Object.keys(COLORMAPS);

/**
 * Create a 256×1 RGBA DataTexture for the named colormap.
 * @param {string} name - One of COLORMAP_NAMES
 * @returns {THREE.DataTexture}
 */
export function createColormapTexture(name) {
  const fn = COLORMAPS[name] || COLORMAPS.viridis;
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    const [r, g, b] = fn(t);
    data[i * 4]     = (r * 255) | 0;
    data[i * 4 + 1] = (g * 255) | 0;
    data[i * 4 + 2] = (b * 255) | 0;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
