import * as THREE from "three";

const RESOLUTION_SCALE = 0.4;

// Simplex noise by Ian McEwan and Stefan Gustavson (Ashima Arts), MIT license.
const simplexNoise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 10.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }
`;

const liquidFragment = /* glsl */ `
  uniform float time;
  uniform float aspect;
  uniform vec2 pointer;
  uniform float stir;
  uniform float reveal;
  varying vec2 vUv;

  ${simplexNoise}

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rotate = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++) {
      value += amplitude * snoise(p);
      p = rotate * p * 1.9;
      amplitude *= 0.38;
    }
    return value;
  }

  float field(vec2 p, float t) {
    vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t * 0.8));
    vec2 r = vec2(
      fbm(p + 0.8 * q + vec2(1.7, 9.2) + t * 0.6),
      fbm(p + 0.8 * q + vec2(8.3, 2.8) - t * 0.5)
    );
    return fbm(p + 0.9 * r);
  }

  void main() {
    vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

    p *= 1.0 + (1.0 - reveal) * 0.5;

    vec2 toPointer = p - pointer;
    float influence = exp(-dot(toPointer, toPointer) * 7.0) * stir;
    p += vec2(-toPointer.y, toPointer.x) * influence * 0.9;

    float angle = -0.22;
    p = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * p;
    vec2 streaks = p * vec2(0.45, 1.25);
    float t = time * 0.035;

    float h = field(streaks, t);
    float e = 0.02;
    float hx = field(streaks + vec2(e, 0.0), t);
    float hy = field(streaks + vec2(0.0, e), t);
    vec3 normal = normalize(vec3((h - hx) / e, (h - hy) / e, 4.5));

    vec3 light = normalize(vec3(0.55, 0.5, 0.65));
    float diffuse = dot(normal, light) * 0.5 + 0.5;
    vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
    float sheen = pow(max(dot(normal, halfway), 0.0), 5.0);

    float body = smoothstep(-0.6, 0.75, h);
    float region = smoothstep(-0.6, 0.6, snoise(p * vec2(0.6, 0.9) + vec2(t * 0.6, 3.1)));
    float shade = body * (0.45 + 0.5 * diffuse) * (0.35 + 0.75 * region) + sheen * 0.12 * region;

    vec3 dark = vec3(0.047, 0.07, 0.09);
    vec3 mid = vec3(0.1, 0.13, 0.16);
    vec3 high = vec3(0.25, 0.305, 0.34);
    vec3 color = mix(dark, mid, smoothstep(0.08, 0.55, shade));
    color = mix(color, high, smoothstep(0.5, 1.1, shade));

    vec3 plain = vec3(0.063, 0.086, 0.11);
    color = mix(plain, color, smoothstep(0.0, 1.0, reveal));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export function createLiquid(renderer) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
  });

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      aspect: { value: 1 },
      pointer: { value: new THREE.Vector2(0, 0) },
      stir: { value: 0 },
      reveal: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: liquidFragment,
    depthTest: false,
    depthWrite: false,
  });

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  const pointer = new THREE.Vector2(0, 0);
  const lastPointer = new THREE.Vector2(0, 0);
  let stir = 0;

  return {
    texture: target.texture,

    setSize(width, height) {
      target.setSize(
        Math.max(1, Math.round(width * RESOLUTION_SCALE)),
        Math.max(1, Math.round(height * RESOLUTION_SCALE))
      );
      material.uniforms.aspect.value = width / height;
    },

    render(elapsed, pointerNdc, reveal = 1) {
      material.uniforms.reveal.value = reveal;
      const aspect = material.uniforms.aspect.value;
      const goal = new THREE.Vector2((pointerNdc.x * aspect) / 2, pointerNdc.y / 2);
      const speed = goal.distanceTo(lastPointer);
      lastPointer.copy(goal);
      pointer.lerp(goal, 0.06);
      stir += (Math.min(speed * 40, 1) - stir) * (speed > 0.0005 ? 0.08 : 0.015);

      material.uniforms.time.value = elapsed;
      material.uniforms.pointer.value.copy(pointer);
      material.uniforms.stir.value = stir;

      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.setRenderTarget(previous);
    },
  };
}
