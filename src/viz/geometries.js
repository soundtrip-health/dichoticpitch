import * as THREE from 'three';

/**
 * Create a plane geometry for a spectrum display panel.
 * @param {number} width  - width in world units
 * @param {number} height - height in world units
 * @returns {THREE.PlaneGeometry}
 */
export function createSpectrumPlane(width, height) {
  return new THREE.PlaneGeometry(width, height);
}
