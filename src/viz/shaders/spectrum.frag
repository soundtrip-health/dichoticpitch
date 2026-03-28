uniform sampler2D uFreqData;
uniform float uNoteBands[16];   // pairs of [low, high] normalized freq (up to 8 notes)
uniform int uNoteBandCount;
uniform float uTime;
uniform float uFlip;            // 1.0 = normal (L), -1.0 = mirrored (R)
uniform vec3 uBaseColor;
uniform vec3 uBandColor;

varying vec2 vUv;

void main() {
  // Sample frequency data — x maps to frequency bin
  float freq = texture2D(uFreqData, vec2(vUv.x, 0.5)).r;

  // Bar height: flip vertically for R channel
  float y = uFlip > 0.0 ? vUv.y : 1.0 - vUv.y;
  float barHeight = freq;

  // Slight gap between bars: quantize x into bins
  float bins = 128.0;
  float binX = floor(vUv.x * bins) / bins;
  float binCenter = binX + 0.5 / bins;
  float binEdge = abs(vUv.x - binCenter) * bins;
  float barMask = smoothstep(0.48, 0.42, binEdge);

  // Active band detection
  bool inBand = false;
  for (int i = 0; i < 8; i++) {
    if (i >= uNoteBandCount) break;
    float lo = uNoteBands[i * 2];
    float hi = uNoteBands[i * 2 + 1];
    if (vUv.x >= lo && vUv.x <= hi) {
      inBand = true;
      break;
    }
  }

  // Color: base vs highlighted band
  vec3 color = inBand ? uBandColor : uBaseColor;

  // Glow for active bands
  float glow = inBand ? 0.15 + 0.05 * sin(uTime * 3.0) : 0.0;

  // Final: bar shape * color, with slight glow at base
  float intensity = step(y, barHeight) * barMask;
  float baseGlow = exp(-y * 4.0) * 0.08;

  vec3 finalColor = color * (intensity + glow) + uBaseColor * baseGlow;
  float alpha = intensity * 0.9 + baseGlow + glow * step(y, barHeight);

  gl_FragColor = vec4(finalColor, alpha);
}
