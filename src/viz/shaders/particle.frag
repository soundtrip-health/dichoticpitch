uniform sampler2D uColormap;

varying float vFreqBin;
varying float vLife;
varying float vEnergy;

void main() {
  // Circular point shape
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;

  // Soft edge
  float edge = smoothstep(0.5, 0.25, r);

  // Color from colormap (frequency → color)
  vec3 color = texture2D(uColormap, vec2(vFreqBin, 0.5)).rgb;

  // Brightness boost for high-energy particles
  color *= 0.7 + 0.3 * vEnergy;

  // Alpha: fades with life, soft edge, energy-scaled
  float alpha = edge * sqrt(vLife) * (0.6 + 0.4 * vEnergy);

  gl_FragColor = vec4(color, alpha);
}
