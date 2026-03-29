attribute vec3 aColor;
varying vec3 vColor;
uniform float uPointSize;

void main() {
  vColor = aColor;
  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPos;
  gl_PointSize = uPointSize * (300.0 / -mvPos.z);
}
