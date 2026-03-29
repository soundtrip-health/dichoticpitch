// Per-particle attributes
attribute vec3 aVelocity;
attribute float aFreqBin;   // [0,1] normalized frequency for colormap
attribute float aEnergy;    // spectral power [0,1]
attribute float aLife;      // remaining life [0,1]

// Uniforms
uniform float uTime;
uniform float uBaseSize;

// Varyings to fragment
varying float vFreqBin;
varying float vLife;
varying float vEnergy;

void main() {
  vFreqBin = aFreqBin;
  vLife = aLife;
  vEnergy = aEnergy;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // Point size: scales with energy, fades as life decreases
  // sqrt(life) for slower visual fade-out
  float size = uBaseSize * (0.3 + 0.7 * aEnergy) * sqrt(aLife);
  // Perspective size attenuation
  gl_PointSize = size * (300.0 / -mvPosition.z);
}
