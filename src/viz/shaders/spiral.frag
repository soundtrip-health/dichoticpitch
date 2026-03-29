varying vec3 vColor;

void main() {
  float r = length(gl_PointCoord - 0.5);
  if (r > 0.5) discard;
  float alpha = smoothstep(0.5, 0.0, r) * 0.85;
  gl_FragColor = vec4(vColor, alpha);
}
