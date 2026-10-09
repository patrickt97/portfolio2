import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Brush, Evaluator, SUBTRACTION } from "three-bvh-csg";
import { createLiquid } from "./liquid.js";

const CARD_ASPECT = 828 / 1024;
const CARD_HEIGHT = 1.6;
const CARD_WIDTH = CARD_HEIGHT * CARD_ASPECT;
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = Math.round(TEXTURE_WIDTH / CARD_ASPECT);
const STORAGE_KEY = "homev3-card-tweaks";
const LIGHT_STORAGE_KEY = "homev3-light-tweaks";
const CARD_WIDTH_SHARE = 0.315;
const COMPACT_CARD_WIDTH_SHARE = 0.58;
const CARD_SPACING_SHARE = 1.09;
const COMPACT_SPACING_SHARE = 1.02;

const projects = [
  { title: "BRISTLE", image: "assets/Bristle.png", pattern: "sweep" },
  { title: "ACHIEVEMENTS", image: "assets/Achievements.png", pattern: "waterfall" },
  { title: "BETSLIP", image: "assets/Betslip.png", pattern: "wave" },
  { title: "REPLAY", image: "assets/Replay.png", pattern: "random" },
];

const defaults = {
  cardSize: 120,
  margin: 4,
  borderRadius: 4,
  edgeRadius: 4,
  thickness: 12,
  tiltX: 3,
  tiltY: -11,
  titleSize: 2.4,
  titleSpacing: 24,
  bgTransparency: 0.23,
  blur: 0.74,
  glassiness: 0.21,
};

const controls = [
  { key: "cardSize", label: "Card size", min: 50, max: 150, step: 1, format: (v) => `${v}%` },
  { key: "margin", label: "Margin", min: 0, max: 20, step: 0.5, format: (v) => `${v}%` },
  { key: "borderRadius", label: "Border radius", min: 0, max: 30, step: 0.5, format: (v) => `${v}%` },
  { key: "edgeRadius", label: "Radius", min: 0, max: 40, step: 1, format: (v) => `${v}` },
  { key: "thickness", label: "Thickness", min: 2, max: 150, step: 1, format: (v) => `${v}` },
  { key: "tiltX", label: "X axis tilt", min: -45, max: 45, step: 1, format: (v) => `${v}°` },
  { key: "tiltY", label: "Y axis tilt", min: -45, max: 45, step: 1, format: (v) => `${v}°` },
  { key: "titleSize", label: "Title size", min: 2, max: 12, step: 0.1, format: (v) => `${v.toFixed(1)}` },
  { key: "titleSpacing", label: "Title spacing", min: -10, max: 30, step: 0.5, format: (v) => `${v}%` },
  { key: "bgTransparency", label: "BG transparency", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  { key: "blur", label: "Material blur", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
  { key: "glassiness", label: "Glassiness", min: 0, max: 1, step: 0.01, format: (v) => v.toFixed(2) },
];

const direction = { min: -10, max: 10, step: 0.1, format: (v) => v.toFixed(1) };
const intensity = { min: 0, max: 8, step: 0.05, format: (v) => v.toFixed(2) };

const lightGroups = [
  {
    heading: "Key",
    controls: [
      { key: "keyIntensity", label: "Intensity", ...intensity },
      { key: "keyX", label: "X", ...direction },
      { key: "keyY", label: "Y", ...direction },
      { key: "keyZ", label: "Z", ...direction },
      { key: "keyColor", label: "Color", type: "color", format: (v) => v },
    ],
  },
  {
    heading: "Rim",
    controls: [
      { key: "rimIntensity", label: "Intensity", ...intensity },
      { key: "rimX", label: "X", ...direction },
      { key: "rimY", label: "Y", ...direction },
      { key: "rimZ", label: "Z", ...direction },
      { key: "rimColor", label: "Color", type: "color", format: (v) => v },
    ],
  },
  {
    heading: "Stamp",
    controls: [
      { key: "stampIntensity", label: "Intensity", ...intensity },
      { key: "stampX", label: "X", ...direction },
      { key: "stampY", label: "Y", ...direction },
      { key: "stampZ", label: "Z", ...direction },
      { key: "stampColor", label: "Color", type: "color", format: (v) => v },
    ],
  },
];

const lightControls = lightGroups.flatMap((group) => group.controls);

const lightDefaults = {
  keyIntensity: 5.3,
  keyX: -3.1,
  keyY: 0.9,
  keyZ: 1.8,
  keyColor: "#fff7e0",
  rimIntensity: 4.75,
  rimX: 1,
  rimY: -0.7,
  rimZ: -2.7,
  rimColor: "#0b2b2d",
  stampIntensity: 2.95,
  stampX: -1.4,
  stampY: 5.9,
  stampZ: -3.2,
  stampColor: "#ffffff",
};

const tweaksPanel = document.getElementById("card-tweaks");
const tweaksEnabled = Boolean(tweaksPanel) && !tweaksPanel.hidden;
const lightPanel = document.getElementById("light-tweaks");
const lightTweaksEnabled = Boolean(lightPanel) && !lightPanel.hidden;

function loadSettings() {
  const loaded = { ...defaults };
  if (!tweaksEnabled) return loaded;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    for (const control of controls) {
      const value = Number(saved[control.key]);
      if (Number.isFinite(value)) {
        loaded[control.key] = THREE.MathUtils.clamp(value, control.min, control.max);
      }
    }
  } catch {}
  return loaded;
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

function loadLightSettings() {
  const loaded = { ...lightDefaults };
  if (!lightTweaksEnabled) return loaded;
  try {
    const saved = JSON.parse(localStorage.getItem(LIGHT_STORAGE_KEY) ?? "{}");
    for (const control of lightControls) {
      const value = saved[control.key];
      if (control.type === "color") {
        if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) loaded[control.key] = value.toLowerCase();
      } else {
        const number = Number(value);
        if (Number.isFinite(number)) loaded[control.key] = THREE.MathUtils.clamp(number, control.min, control.max);
      }
    }
  } catch {}
  return loaded;
}

function saveLightSettings() {
  try {
    localStorage.setItem(LIGHT_STORAGE_KEY, JSON.stringify(lightSettings));
  } catch {}
}

const settings = loadSettings();
const lightSettings = loadLightSettings();

const cardScale = () => settings.cardSize / 100;
let spacingShare = CARD_SPACING_SHARE;
const spacing = () => CARD_WIDTH * spacingShare * cardScale();

const view = document.getElementById("card-view");
const renderer = new THREE.WebGLRenderer({
  canvas: view,
  alpha: true,
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
scene.add(camera);

const BACKDROP_DISTANCE = 20;
const liquid = createLiquid(renderer);
const backdropMaterial = new THREE.ShaderMaterial({
  uniforms: {
    liquidMap: { value: liquid.texture },
    grainResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D liquidMap;
    uniform vec2 grainResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }

    vec3 srgbToLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
    }

    void main() {
      vec3 color = texture2D(liquidMap, vUv).rgb;
      vec2 grainUv = vUv * grainResolution;
      float grain = valueNoise(grainUv / 2.2) * 0.6 + hash(floor(grainUv / 1.1)) * 0.4;
      color *= 1.0 + (grain - 0.5) * 0.5;
      color = srgbToLinear(max(color, 0.0));
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }
  `,
  depthWrite: false,
});
const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), backdropMaterial);
backdrop.position.z = -BACKDROP_DISTANCE;
backdrop.renderOrder = -1;
camera.add(backdrop);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const lights = {
  key: new THREE.DirectionalLight(),
  rim: new THREE.DirectionalLight(),
  stamp: new THREE.DirectionalLight(),
};

function applyLight(prefix) {
  const light = lights[prefix];
  const x = lightSettings[`${prefix}X`];
  const y = lightSettings[`${prefix}Y`];
  const z = lightSettings[`${prefix}Z`];
  light.color.set(lightSettings[`${prefix}Color`]);
  light.intensity = lightSettings[`${prefix}Intensity`];
  if (x === 0 && y === 0 && z === 0) light.position.set(0, 1, 0);
  else light.position.set(x, y, z);
}

for (const prefix of Object.keys(lights)) {
  applyLight(prefix);
  scene.add(lights[prefix]);
}

const track = new THREE.Group();
scene.add(track);

function roundedShape(width, height, radius) {
  const r = Math.max(0.0001, Math.min(radius, width / 2, height / 2));
  const x = -width / 2;
  const y = -height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + height - r);
  shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  shape.lineTo(x + r, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function sampleEdgeColors(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 2;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 4, 4, 1, 1, 0, 0, 1, 1);
  ctx.drawImage(image, 4, image.height - 5, 1, 1, 0, 1, 1, 1);
  const [r1, g1, b1, , r2, g2, b2] = ctx.getImageData(0, 0, 1, 2).data;
  return [`rgb(${r1}, ${g1}, ${b1})`, `rgb(${r2}, ${g2}, ${b2})`];
}

function makeBackgroundTexture([top, bottom]) {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, top);
  gradient.addColorStop(1, bottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function parseSvgSubpaths(d) {
  const tokens = d.match(/[MLHVZ]|-?\d*\.?\d+/gi);
  const subpaths = [];
  let i = 0;
  let x = 0;
  let y = 0;
  let start = null;
  let current = null;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const command = tokens[i++];
    if (command === "M") {
      x = num();
      y = num();
      current = [[x, y]];
      start = [x, y];
    } else if (command === "L") {
      x = num();
      y = num();
      current.push([x, y]);
    } else if (command === "H") {
      x = num();
      current.push([x, y]);
    } else if (command === "V") {
      y = num();
      current.push([x, y]);
    } else if (command === "Z") {
      if (start && (x !== start[0] || y !== start[1])) current.push(start);
      if (current && current.length >= 3) subpaths.push(current);
      current = null;
      start = null;
    }
  }
  return subpaths;
}

const [images, iconSubpaths] = await Promise.all([
  Promise.all(projects.map((project) => loadImage(project.image))),
  fetch("assets/TanIcon.svg")
    .then((response) => response.text())
    .then((svg) => parseSvgSubpaths(svg.match(/\sd="([^"]+)"/)[1])),
  document.fonts.load("400 64px Geist"),
]);

const DOT_COLUMNS = 6;
const DOT_ROWS = 4;
const DOT_SIZE_PX = 8;
const DOT_GAP_PX = 4;
const DOT_RADIUS_PX = 1;
// Width of the default card, in CSS pixels, on a height-constrained 1080px-tall view.
// The grid is a fraction of the card so it scales with card size, focus, and viewport.
const DOT_REFERENCE_CARD_WIDTH_PX =
  (CARD_WIDTH * (defaults.cardSize / 100) * 0.51 * 1080) / CARD_HEIGHT;
const DOT_WAVE_SECONDS = 1.6;
const DOT_MIN_OPACITY = 0.2;
const DOT_MAX_OPACITY = 0.6;
const dotGeometry = new THREE.ShapeGeometry(roundedShape(1, 1, DOT_RADIUS_PX / DOT_SIZE_PX), 8);
let worldPerPixel = 0.003;

const pulse = (phase) => 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);

const dotPatterns = {
  sweep(dot, elapsed) {
    return pulse(elapsed / DOT_WAVE_SECONDS - dot.column / DOT_COLUMNS);
  },
  waterfall(dot, elapsed) {
    const phase = elapsed / DOT_WAVE_SECONDS - dot.row / DOT_ROWS - dot.column * 0.12;
    const local = phase - Math.floor(phase);
    return Math.max(0, 1 - local * 3);
  },
  wave(dot, elapsed) {
    const crest =
      (0.5 + 0.5 * Math.sin(elapsed * 2.4 - dot.column * 0.9)) * (DOT_ROWS - 1);
    return Math.max(0, 1 - Math.abs(dot.row - crest) / 1.2);
  },
  random(dot, elapsed) {
    if (elapsed >= dot.nextChange) {
      dot.from = dot.current;
      dot.to = Math.random() < 0.35 ? Math.random() : 0;
      dot.changedAt = elapsed;
      dot.nextChange = elapsed + 0.25 + Math.random() * 0.9;
    }
    const t = Math.min((elapsed - dot.changedAt) / 0.25, 1);
    dot.current = THREE.MathUtils.lerp(dot.from, dot.to, t);
    return dot.current;
  },
};

const contentGeometry = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
const BACK_ICON_SHARE = 0.08;
const ICON_VIEWBOX = 320;
const csg = new Evaluator();
csg.useGroups = false;
let bodyGeometry = new THREE.BufferGeometry();
let indentGeometry = new THREE.BufferGeometry();

function createCard(project, image, index) {
  const pivot = new THREE.Group();
  pivot.position.x = index * spacing();
  const card = new THREE.Group();
  pivot.add(card);

  const contentCanvas = document.createElement("canvas");
  contentCanvas.width = TEXTURE_WIDTH;
  contentCanvas.height = TEXTURE_HEIGHT;
  const contentTexture = new THREE.CanvasTexture(contentCanvas);
  contentTexture.colorSpace = THREE.SRGBColorSpace;
  contentTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    map: makeBackgroundTexture(sampleEdgeColors(image)),
    ior: 1.25,
    thickness: 0.05,
  });
  const contentMaterial = new THREE.MeshPhysicalMaterial({
    map: contentTexture,
    transparent: true,
    depthWrite: false,
  });

  const indentMaterial = new THREE.MeshPhysicalMaterial({
    map: bodyMaterial.map,
    ior: 1.25,
    roughness: 0.32,
    metalness: 0.08,
    clearcoat: 0.35,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.renderOrder = 1;
  card.add(body);

  const indent = new THREE.Mesh(indentGeometry, indentMaterial);
  indent.renderOrder = 2;
  card.add(indent);

  const content = new THREE.Mesh(contentGeometry, contentMaterial);
  content.renderOrder = 2;
  card.add(content);

  const dots = new THREE.Group();
  for (let column = 0; column < DOT_COLUMNS; column++) {
    for (let row = 0; row < DOT_ROWS; row++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: DOT_MIN_OPACITY,
        depthWrite: false,
        toneMapped: false,
      });
      const dot = new THREE.Mesh(dotGeometry, material);
      dot.userData = { column, row, current: 0, from: 0, to: 0, changedAt: 0, nextChange: Math.random() };
      dot.renderOrder = 3;
      dots.add(dot);
    }
  }
  card.add(dots);

  body.userData.cardIndex = index;
  content.userData.cardIndex = index;
  track.add(pivot);

  return {
    project,
    image,
    pivot,
    card,
    body,
    content,
    indent,
    dots,
    contentCanvas,
    contentTexture,
    bodyMaterial,
    contentMaterial,
    indentMaterial,
    tilt: new THREE.Vector2(0, 0),
    spin: { x: 0, y: 0, vx: 0, vy: 0 },
  };
}

const cards = projects.map((project, index) => createCard(project, images[index], index));
const hitTargets = cards.flatMap((entry) => [entry.body, entry.content]);

function drawContent(entry) {
  const { contentCanvas, contentTexture, image, project } = entry;
  const ctx = contentCanvas.getContext("2d");
  const width = TEXTURE_WIDTH;
  const height = TEXTURE_HEIGHT;
  ctx.clearRect(0, 0, width, height);

  const margin = (settings.margin / 100) * width;
  const fontSize = (settings.titleSize / 100) * width;
  ctx.font = `400 ${fontSize}px Geist`;
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  drawSpacedText(ctx, project.title, margin, margin, (settings.titleSpacing / 100) * fontSize);

  const imageSize = Math.max(0, width - margin * 2);
  const imageY = height - margin - imageSize;
  const cropSize = image.height;
  ctx.save();
  roundedRectPath(ctx, margin, imageY, imageSize, imageSize, width * 0.012);
  ctx.clip();
  ctx.drawImage(
    image,
    (image.width - cropSize) / 2,
    0,
    cropSize,
    cropSize,
    margin,
    imageY,
    imageSize,
    imageSize
  );
  ctx.restore();
  contentTexture.needsUpdate = true;
}

function drawSpacedText(ctx, text, x, y, spacing) {
  if ("letterSpacing" in ctx) {
    ctx.letterSpacing = `${spacing}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = "0px";
    return;
  }
  let cursor = x;
  for (const character of text) {
    ctx.fillText(character, cursor, y);
    cursor += ctx.measureText(character).width + spacing;
  }
}

function drawAllContent() {
  for (const entry of cards) drawContent(entry);
}

function placeDots() {
  const size = CARD_WIDTH * (DOT_SIZE_PX / DOT_REFERENCE_CARD_WIDTH_PX);
  const gap = CARD_WIDTH * (DOT_GAP_PX / DOT_REFERENCE_CARD_WIDTH_PX);
  const margin = (settings.margin / 100) * CARD_WIDTH;
  const gridWidth = DOT_COLUMNS * size + (DOT_COLUMNS - 1) * gap;
  for (const { dots } of cards) {
    for (const dot of dots.children) {
      const { column, row } = dot.userData;
      dot.scale.setScalar(size);
      dot.position.set(column * (size + gap) + size / 2, -(row * (size + gap) + size / 2), 0);
    }
    dots.position.x = CARD_WIDTH / 2 - margin - gridWidth;
    dots.position.y = CARD_HEIGHT / 2 - margin;
  }
}

function animateDots(elapsed) {
  for (const { dots, project } of cards) {
    const pattern = dotPatterns[project.pattern] ?? dotPatterns.sweep;
    for (const dot of dots.children) {
      const strength = THREE.MathUtils.clamp(pattern(dot.userData, elapsed), 0, 1);
      dot.material.opacity = THREE.MathUtils.lerp(DOT_MIN_OPACITY, DOT_MAX_OPACITY, strength);
    }
  }
}

function iconShapes() {
  const size = CARD_WIDTH * BACK_ICON_SHARE;
  const scale = size / ICON_VIEWBOX;
  const margin = (settings.margin / 100) * CARD_WIDTH;
  const inset = margin + CARD_WIDTH * 0.04;
  const centerY = -CARD_HEIGHT / 2 + inset + size / 2;
  const shapes = [];

  for (const subpath of iconSubpaths) {
    const points = subpath.map(
      ([x, y]) => new THREE.Vector2((ICON_VIEWBOX / 2 - x) * scale, (ICON_VIEWBOX / 2 - y) * scale + centerY)
    );
    if (points.length > 1 && points[0].distanceToSquared(points[points.length - 1]) < 1e-10) points.pop();
    if (points.length < 3) continue;
    if (THREE.ShapeUtils.isClockWise(points)) points.reverse();
    shapes.push(new THREE.Shape(points));
  }
  return shapes;
}

function mergeIconExtrusions(options, z) {
  const pieces = iconShapes().map((shape) => {
    const geometry = new THREE.ExtrudeGeometry(shape, options);
    geometry.translate(0, 0, z);
    return geometry;
  });
  const merged = mergeGeometries(pieces);
  for (const piece of pieces) piece.dispose();
  merged.computeVertexNormals();
  return merged;
}

function iconCutter(depth, bevel) {
  const pocket = Math.min(Math.max(depth * 0.55, 0.006), depth * 0.7);
  const overlap = Math.max(bevel * 0.35, 0.002);
  return mergeIconExtrusions(
    {
      depth: pocket + overlap,
      bevelEnabled: false,
    },
    -depth / 2 - bevel - overlap
  );
}

function iconLiner(depth, bevel) {
  const pocket = Math.max(depth * 0.9, 0.01);
  return mergeIconExtrusions(
    {
      depth: pocket,
      bevelEnabled: false,
    },
    -depth / 2 - bevel * 0.15
  );
}

function indentBack(geometry, depth, bevel) {
  const cutterGeometry = iconCutter(depth, bevel);
  const base = new Brush(geometry);
  const cutter = new Brush(cutterGeometry);
  base.updateMatrixWorld();
  cutter.updateMatrixWorld();
  const result = csg.evaluate(base, cutter, SUBTRACTION);
  cutterGeometry.dispose();
  if (result.geometry !== geometry) geometry.dispose();
  return result.geometry;
}

function buildBody() {
  const depth = settings.thickness / 1000;
  const bevel = Math.min(settings.edgeRadius / 1000, CARD_WIDTH / 4);
  const radius = (settings.borderRadius / 100) * CARD_WIDTH;
  const shape = roundedShape(
    CARD_WIDTH - bevel * 2,
    CARD_HEIGHT - bevel * 2,
    Math.max(radius - bevel, 0)
  );
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 24,
  });
  geometry.translate(0, 0, -depth / 2);
  const indented = indentBack(geometry, depth, bevel);
  const liner = iconLiner(depth, bevel);
  const mapCardUv = (geometry) => {
    const position = geometry.attributes.position;
    if (!geometry.attributes.uv) {
      geometry.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(position.count * 2), 2));
    }
    const uv = geometry.attributes.uv;
    for (let i = 0; i < position.count; i++) {
      uv.setXY(i, position.getX(i) / CARD_WIDTH + 0.5, position.getY(i) / CARD_HEIGHT + 0.5);
    }
    uv.needsUpdate = true;
  };
  mapCardUv(indented);
  mapCardUv(liner);

  bodyGeometry.dispose();
  indentGeometry.dispose();
  bodyGeometry = indented;
  indentGeometry = liner;
  const contentZ = depth / 2 + bevel + 0.0008;
  for (const { body, content, indent, dots } of cards) {
    body.geometry = indented;
    indent.geometry = liner;
    content.position.z = contentZ;
    dots.position.z = contentZ + 0.0005;
  }
}

function applyMaterials() {
  const glass = settings.glassiness;
  const transparency = settings.bgTransparency;
  const surfaceRoughness = THREE.MathUtils.lerp(0.4, 0.04, glass) * (1 - transparency);

  for (const { bodyMaterial, contentMaterial, indentMaterial } of cards) {
    bodyMaterial.transmission = transparency;
    bodyMaterial.roughness = THREE.MathUtils.lerp(surfaceRoughness, 1, settings.blur);
    bodyMaterial.metalness = THREE.MathUtils.lerp(0.1, 0.02, glass);
    bodyMaterial.clearcoat = THREE.MathUtils.lerp(0.6, 1, glass);
    bodyMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.25, 0, glass);
    bodyMaterial.envMapIntensity = THREE.MathUtils.lerp(1, 4, glass);
    bodyMaterial.iridescence = glass * 0.3;
    bodyMaterial.needsUpdate = true;

    indentMaterial.map = bodyMaterial.map;
    indentMaterial.color.setScalar(0.58);
    indentMaterial.transmission = 0;
    indentMaterial.roughness = THREE.MathUtils.lerp(0.22, 0.4, settings.blur);
    indentMaterial.metalness = THREE.MathUtils.lerp(0.12, 0.04, glass);
    indentMaterial.clearcoat = THREE.MathUtils.lerp(0.35, 0.7, glass);
    indentMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.3, 0.08, glass);
    indentMaterial.envMapIntensity = THREE.MathUtils.lerp(1.2, 2.4, glass);
    indentMaterial.needsUpdate = true;

    contentMaterial.roughness = THREE.MathUtils.lerp(0.42, 0.06, glass);
    contentMaterial.clearcoat = THREE.MathUtils.lerp(0.6, 1, glass);
    contentMaterial.clearcoatRoughness = THREE.MathUtils.lerp(0.25, 0, glass);
    contentMaterial.envMapIntensity = THREE.MathUtils.lerp(1, 3, glass);
    contentMaterial.needsUpdate = true;
  }
}

function apply(key) {
  if (key === "borderRadius" || key === "edgeRadius" || key === "thickness") buildBody();
  if (key === "margin" || key === "titleSize" || key === "titleSpacing") drawAllContent();
  if (key === "margin") {
    placeDots();
    buildBody();
  }
  if (key === "bgTransparency" || key === "blur" || key === "glassiness") applyMaterials();
}

function appendControl(panel, control, store, onChange) {
  const row = document.createElement("div");
  row.className = "tweak";

  const id = `tweak-${control.key}`;
  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = control.label;

  const isColor = control.type === "color";
  const input = document.createElement("input");
  input.id = id;
  input.type = isColor ? "color" : "range";
  if (!isColor) {
    input.min = control.min;
    input.max = control.max;
    input.step = control.step;
  }
  input.value = store[control.key];

  const output = document.createElement("output");
  output.htmlFor = id;
  output.textContent = control.format(store[control.key]);

  input.addEventListener("input", () => {
    store[control.key] = isColor ? input.value : Number(input.value);
    output.textContent = control.format(store[control.key]);
    onChange(control.key);
  });

  row.append(label, input, output);
  panel.append(row);
}

function buildPanel() {
  if (!tweaksEnabled) return;
  for (const control of controls) {
    appendControl(tweaksPanel, control, settings, (key) => {
      apply(key);
      saveSettings();
    });
  }
}

function lightPrefix(key) {
  if (key.startsWith("stamp")) return "stamp";
  if (key.startsWith("rim")) return "rim";
  return "key";
}

function buildLightPanel() {
  if (!lightTweaksEnabled) return;
  for (const group of lightGroups) {
    const heading = document.createElement("h2");
    heading.className = "panel-heading";
    heading.textContent = group.heading;
    lightPanel.append(heading);
    for (const control of group.controls) {
      appendControl(lightPanel, control, lightSettings, (key) => {
        applyLight(lightPrefix(key));
        saveLightSettings();
      });
    }
  }
}

buildBody();
drawAllContent();
placeDots();
applyMaterials();
buildPanel();
buildLightPanel();

function fit() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  renderer.setSize(width, height, false);
  camera.aspect = aspect;
  const compact = 1 - THREE.MathUtils.smoothstep(width, 640, 1100);
  const widthShare = THREE.MathUtils.lerp(CARD_WIDTH_SHARE, COMPACT_CARD_WIDTH_SHARE, compact);
  spacingShare = THREE.MathUtils.lerp(CARD_SPACING_SHARE, COMPACT_SPACING_SHARE, compact);
  const visibleHeight = Math.max(CARD_HEIGHT / 0.51, CARD_WIDTH / (widthShare * aspect));
  const distance = visibleHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  camera.position.set(0, 0, distance);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  const backdropHeight = 2 * BACKDROP_DISTANCE * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  backdrop.scale.set(backdropHeight * aspect, backdropHeight, 1);
  liquid.setSize(width, height);
  backdropMaterial.uniforms.grainResolution.value.set(width, height);
  worldPerPixel = visibleHeight / height;
  placeDots();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const CARD_ZONE_MARGIN_PX = 32;
const SPIN_PER_PX = 0.008;
const fullTurn = Math.PI * 2;
const zoneBox = new THREE.Box3();
const zoneCorner = new THREE.Vector3();
let current = 0;
let dragMode = null;
let dragCard = null;
let pressedCard = null;
let dragMoved = false;
let dragStartX = 0;
let dragOffset = 0;
let dragVelocity = 0;
let lastDrag = { x: 0, y: 0, time: 0 };
let sway = 0;

function setPointer(event) {
  pointer.set(
    (event.clientX / window.innerWidth) * 2 - 1,
    -(event.clientY / window.innerHeight) * 2 + 1
  );
}

function cardUnderPointer() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(hitTargets, false)[0];
  return hit ? hit.object.userData.cardIndex : null;
}

function screenRect(entry) {
  zoneBox.setFromObject(entry.body);
  const rect = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
  for (let i = 0; i < 8; i++) {
    zoneCorner
      .set(i & 1 ? zoneBox.max.x : zoneBox.min.x, i & 2 ? zoneBox.max.y : zoneBox.min.y, i & 4 ? zoneBox.max.z : zoneBox.min.z)
      .project(camera);
    const x = ((zoneCorner.x + 1) / 2) * window.innerWidth;
    const y = ((1 - zoneCorner.y) / 2) * window.innerHeight;
    rect.left = Math.min(rect.left, x);
    rect.right = Math.max(rect.right, x);
    rect.top = Math.min(rect.top, y);
    rect.bottom = Math.max(rect.bottom, y);
  }
  return rect;
}

function inFocusedZone(clientX, clientY) {
  if (cardUnderPointer() === current) return true;
  const rect = screenRect(cards[current]);
  const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
  const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
  return Math.hypot(dx, dy) <= CARD_ZONE_MARGIN_PX;
}

function goTo(index) {
  current = THREE.MathUtils.clamp(index, 0, cards.length - 1);
}

view.addEventListener("pointerdown", (event) => {
  setPointer(event);
  const spinFocused = inFocusedZone(event.clientX, event.clientY);
  dragMode = spinFocused ? "spin" : "carousel";
  dragCard = spinFocused ? cards[current] : null;
  pressedCard = spinFocused ? null : cardUnderPointer();
  dragMoved = false;
  dragStartX = event.clientX;
  dragOffset = 0;
  dragVelocity = 0;
  if (dragCard) {
    dragCard.spin.vx = 0;
    dragCard.spin.vy = 0;
  }
  lastDrag = { x: event.clientX, y: event.clientY, time: performance.now() };
  view.setPointerCapture(event.pointerId);
});

window.addEventListener("pointermove", (event) => {
  setPointer(event);
  if (!dragMode) return;
  const now = performance.now();
  const stepX = event.clientX - lastDrag.x;
  const stepY = event.clientY - lastDrag.y;
  let dx = event.clientX - dragStartX;
  if (Math.abs(dx) > 6 || Math.abs(stepY) > 6) dragMoved = true;

  if (dragMode === "spin") {
    const { spin } = dragCard;
    spin.y += stepX * SPIN_PER_PX;
    spin.x = THREE.MathUtils.clamp(spin.x + stepY * SPIN_PER_PX, -1.1, 1.1);
    spin.vy = stepX * SPIN_PER_PX;
    spin.vx = stepY * SPIN_PER_PX;
  } else {
    const pastStart = current === 0 && dx > 0;
    const pastEnd = current === cards.length - 1 && dx < 0;
    if (pastStart || pastEnd) dx *= 0.3;
    dragOffset = dx * worldPerPixel;
    const dt = Math.max(now - lastDrag.time, 1);
    dragVelocity = THREE.MathUtils.lerp(dragVelocity, stepX / dt, 0.4);
  }
  lastDrag = { x: event.clientX, y: event.clientY, time: now };
});

function endDrag(event) {
  if (!dragMode) return;
  const mode = dragMode;
  const entry = dragCard;
  dragMode = null;
  dragCard = null;
  if (view.hasPointerCapture(event.pointerId)) view.releasePointerCapture(event.pointerId);

  if (mode === "spin") {
    if (performance.now() - lastDrag.time > 80) {
      entry.spin.vx = 0;
      entry.spin.vy = 0;
    }
    return;
  }

  if (!dragMoved) {
    if (pressedCard !== null) goTo(pressedCard);
    dragOffset = 0;
    return;
  }

  const distancePx = event.clientX - dragStartX;
  const spacingPx = spacing() / worldPerPixel;
  const recentVelocity = performance.now() - lastDrag.time < 80 ? dragVelocity : 0;
  let steps = -Math.round(distancePx / spacingPx);
  if (steps === 0 && Math.abs(distancePx) > spacingPx * 0.15) steps = -Math.sign(distancePx);
  if (steps === 0 && Math.abs(recentVelocity) > 0.4) steps = -Math.sign(recentVelocity);
  goTo(current + steps);
  dragOffset = 0;
}

view.addEventListener("pointerup", endDrag);
view.addEventListener("pointercancel", endDrag);
document.addEventListener("pointerleave", () => pointer.set(0, 0));

let wheelAccumulated = 0;
let wheelLocked = false;
let wheelTimer = 0;

view.addEventListener(
  "wheel",
  (event) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    event.preventDefault();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => {
      wheelLocked = false;
      wheelAccumulated = 0;
    }, 180);
    if (wheelLocked) return;
    wheelAccumulated += event.deltaX;
    if (Math.abs(wheelAccumulated) > 40) {
      goTo(current + Math.sign(wheelAccumulated));
      wheelLocked = true;
    }
  },
  { passive: false }
);

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) return;
  if (event.key === "ArrowRight") goTo(current + 1);
  if (event.key === "ArrowLeft") goTo(current - 1);
});

const clock = new THREE.Clock();

const INTRO = {
  liquidStart: 0.3,
  liquidDuration: 2.0,
  cardsStart: 0.3,
  cardStagger: 0.5,
  cardDuration: 1.2,
  cardDrop: 3.2,
};
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let introStart = null;

const progress = (time, start, duration) => THREE.MathUtils.clamp((time - start) / duration, 0, 1);
const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const cardForward = new THREE.Vector3();
const cardWorld = new THREE.Vector3();
const toCamera = new THREE.Vector3();

function animate() {
  const elapsed = clock.getElapsedTime();
  if (introStart === null) {
    introStart = elapsed;
    document.body.classList.add("intro-play");
  }
  const introTime = reduceMotion ? Infinity : elapsed - introStart;

  const previousX = track.position.x;
  const targetX = -current * spacing() + dragOffset;
  track.position.x += (targetX - track.position.x) * (dragMode === "carousel" ? 0.35 : 0.1);
  const trackVelocity = track.position.x - previousX;
  sway += (THREE.MathUtils.clamp(trackVelocity * 6, -0.35, 0.35) - sway) * 0.15;

  const hovered = dragMode ? null : cardUnderPointer();
  view.style.cursor = dragMode
    ? "grabbing"
    : hovered === current
      ? "grab"
      : hovered !== null
        ? "pointer"
        : "ew-resize";

  cards.forEach((entry, index) => {
    const { pivot, card, indent, tilt, spin } = entry;
    pivot.position.x = index * spacing();
    const offset = (pivot.position.x + track.position.x) / spacing();
    const focus = 1 - Math.min(Math.abs(offset), 1);
    const isActive = index === current;
    const isSpinning = dragCard === entry;

    if (!isSpinning) {
      spin.y += spin.vy;
      spin.x += spin.vx;
      spin.vy *= 0.92;
      spin.vx *= 0.92;
      if (Math.abs(spin.vy) < 0.004) {
        const rest = Math.round(spin.y / fullTurn) * fullTurn;
        spin.y += (rest - spin.y) * 0.06;
      }
      spin.x += (0 - spin.x) * 0.08;
    }

    const tiltStrength = isSpinning ? 0.3 : 1;
    const hoverX = isActive && dragMode !== "carousel" ? -pointer.y * 0.22 * tiltStrength : 0;
    const hoverY = isActive && dragMode !== "carousel" ? pointer.x * 0.3 * tiltStrength : 0;
    tilt.x += (hoverX - tilt.x) * 0.08;
    tilt.y += (hoverY - tilt.y) * 0.08;

    const facing = THREE.MathUtils.clamp(-offset, -1, 1) * 0.35;
    pivot.rotation.x = THREE.MathUtils.degToRad(settings.tiltX) + tilt.x + spin.x;
    pivot.rotation.y = THREE.MathUtils.degToRad(settings.tiltY) + tilt.y + facing + sway + spin.y;

    const lift = (hovered === index || isSpinning) && isActive ? 1.03 : 1;
    const targetScale = THREE.MathUtils.lerp(0.86, 1, focus) * lift * cardScale();
    pivot.scale.setScalar(THREE.MathUtils.lerp(pivot.scale.x, targetScale, 0.12));

    const rise = easeOutQuart(
      progress(introTime, INTRO.cardsStart + index * INTRO.cardStagger, INTRO.cardDuration)
    );
    card.position.y = Math.sin(elapsed * 1.2 + index * 0.8) * 0.025 - (1 - rise) * INTRO.cardDrop;
    card.rotation.x = (1 - rise) * 0.5;
    card.getWorldDirection(cardForward);
    card.getWorldPosition(cardWorld);
    toCamera.subVectors(camera.position, cardWorld);
    indent.visible = cardForward.dot(toCamera) < 0;
  });

  animateDots(elapsed);
  const reveal = easeInOutCubic(progress(introTime, INTRO.liquidStart, INTRO.liquidDuration));
  liquid.render(elapsed, pointer, reveal);
  renderer.render(scene, camera);
}

fit();
window.addEventListener("resize", fit);
renderer.setAnimationLoop(animate);
