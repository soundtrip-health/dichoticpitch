uniform float uTime;
uniform float uActivity;   // 0 = silent, 1 = notes playing
uniform vec3 uColorQuiet;  // dim ring color when no notes
uniform vec3 uColorActive; // bright color when notes play

varying vec2 vUv;
varying float vDisplacement;

void main() {
  float absDiff = abs(vDisplacement);

  // Color: blend from quiet to active based on activity + displacement
  float colorMix = uActivity * 0.6 + absDiff * 0.4;
  vec3 color = mix(uColorQuiet, uColorActive, clamp(colorMix, 0.0, 1.0));

  // Brightness peaks with displacement magnitude
  float brightness = 0.3 + 0.7 * absDiff;

  // Soft pulse when active
  float pulse = 1.0 + uActivity * 0.08 * sin(uTime * 2.5);

  // Edge softness: fade at tube edges using vUv.y (0 at edges, 0.5 at center)
  float edgeDist = abs(vUv.y - 0.5) * 2.0;
  float edgeFade = 1.0 - smoothstep(0.6, 1.0, edgeDist);

  // Base alpha: dim when quiet, brighter when active
  float alpha = mix(0.2, 0.7, uActivity) * brightness * pulse * edgeFade;

  gl_FragColor = vec4(color * brightness * pulse, alpha);
}
