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

/**
 * Create a ring (torus-like tube) geometry for the interaural difference display.
 * Vertices arranged around a circle with normals pointing radially outward.
 * UV.x maps to angle [0,1], UV.y maps across the tube width [0,1].
 * @param {number} radius    - ring center radius
 * @param {number} tubeWidth - half-width of the tube
 * @param {number} segments  - number of segments around the ring
 * @returns {THREE.BufferGeometry}
 */
export function createRingGeometry(radius, tubeWidth, segments = 256) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  // Two rows of vertices: inner edge and outer edge of the tube
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = t * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // Normal points radially outward
    const nx = cos;
    const ny = sin;

    // Inner edge
    positions.push((radius - tubeWidth) * cos, (radius - tubeWidth) * sin, 0);
    normals.push(nx, ny, 0);
    uvs.push(t, 0);

    // Outer edge
    positions.push((radius + tubeWidth) * cos, (radius + tubeWidth) * sin, 0);
    normals.push(nx, ny, 0);
    uvs.push(t, 1);
  }

  // Triangles connecting inner/outer edges
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, b, c, c, b, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}
