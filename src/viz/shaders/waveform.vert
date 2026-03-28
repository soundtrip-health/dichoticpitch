uniform sampler2D uDiffData;
uniform float uAmplitude;

varying vec2 vUv;
varying float vDisplacement;

void main() {
  vUv = uv;

  // Sample the interaural difference at this vertex's angular position
  float diff = texture2D(uDiffData, vec2(uv.x, 0.5)).r;
  // Remap from [0,1] (byte-normalized around 128) to [-1,1]
  float signedDiff = (diff - 0.5) * 2.0;
  vDisplacement = signedDiff;

  // Displace outward along the normal (radial direction for a ring)
  vec3 displaced = position + normal * signedDiff * uAmplitude;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
