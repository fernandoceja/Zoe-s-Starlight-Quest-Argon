// ============================================================================
// Zoe's Starlight Quest — Rolling Pastel Terrain, River, Waterfall, Bridges & Paths
// Pure heightfield queries (groundHeightAt / walkHeightAt) + sculpted vertex-colored
// terrain mesh, winding river shader, cascading waterfall, 2 arched footbridges,
// textured cobblestone paths, flower borders, and starry hub plaza.
// ============================================================================

import * as THREE from 'three';
import {
  INNER_LAND_ANGLES, LAND_DIST, OUTER_DIST, PATH_WIDTH, CASTLE_POS,
  NEW_LAND_SLOTS, slotPos, pathSegments, distToSegment,
} from './worldmap.js';

const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// All 10 land centers + distinct pastel ground tint for seamless world blending
export const LAND_BIOMES = (() => {
  const out = [];
  const innerColors = {
    library:   0xcab3f2, // rich lavender parchment meadow
    frostfall: 0xcce8fa, // glacier-cyan snow
    meadow:    0xbde278, // honey-gold sunlit grass
    village:   0xf4cfa2, // warm peach-cream lawn
  };
  for (const [id, angle] of Object.entries(INNER_LAND_ANGLES)) {
    out.push({ id, x: Math.cos(angle) * LAND_DIST, z: Math.sin(angle) * LAND_DIST, r: 11.4, color: innerColors[id] });
  }
  const outerColors = {
    ese: 0x86cc5e, // Sunny Fjord Harbor (clover summer green)
    sse: 0xedd3a2, // Seashell Cove (warm apricot sand)
    ssw: 0x82c970, // Wayfinder Isle (tropical emerald)
    wsw: 0x7e9b4a, // Firefly Bayou (mossy olive-sage)
    ene: 0x8eb868, // Rosewood Glen (soft sage-rose glade)
    nne: 0x3b6091, // Moonlit Palace Garden (twilight indigo-teal)
  };
  for (const s of NEW_LAND_SLOTS) {
    const p = slotPos(s);
    out.push({ id: s.slot, x: p.x, z: p.z, r: 11.4, color: outerColors[s.slot] || 0x9ad482 });
  }
  return out;
})();

// Winding river curve from the NW waterfall plunge pool across the north/east valley
const RIVER_CONTROL = [
  new THREE.Vector3(-22.4, 0, -15.4), // plunge pool base
  new THREE.Vector3(-18.2, 0, -17.0),
  new THREE.Vector3(-12.5, 0, -17.2), // behind castle hill
  new THREE.Vector3(-5.2, 0, -15.4),
  new THREE.Vector3(0.0, 0, -14.2),   // Bridge #1 (Library path)
  new THREE.Vector3(5.8, 0, -13.0),
  new THREE.Vector3(10.6, 0, -10.6),  // Bridge #2 (NE Trunk)
  new THREE.Vector3(18.5, 0, -11.4),
  new THREE.Vector3(28.5, 0, -13.4),  // sweeps north of Frostfall Peaks
  new THREE.Vector3(38.5, 0, -7.2),   // winds between Frostfall, Glen, Harbor
  new THREE.Vector3(52.0, 0, -2.0),
  new THREE.Vector3(78.0, 0, 2.5),
  new THREE.Vector3(120.0, 0, 8.0),
];
const RIVER_CURVE = new THREE.CatmullRomCurve3(RIVER_CONTROL, false, 'catmullrom', 0.45);
const RIVER_SAMPLES = 160;
const RIVER_PTS = [];
for (let i = 0; i <= RIVER_SAMPLES; i++) {
  const u = i / RIVER_SAMPLES;
  const p = RIVER_CURVE.getPoint(u);
  const t = RIVER_CURVE.getTangent(u);
  RIVER_PTS.push({ x: p.x, z: p.z, tx: t.x, tz: t.z, u });
}

export const WATERFALL_POS = { x: -23.4, z: -15.8 };

export const BRIDGES = [
  { id: 'library', x: 0.0, z: -14.2, yaw: 0, len: 5.8, width: 4.3, arch: 0.92 },
  { id: 'ne_trunk', x: 10.6, z: -10.6, yaw: -Math.PI / 4, len: 5.8, width: 4.1, arch: 0.92 },
];

export function bridgeDeckInfo(x, z) {
  for (let i = 0; i < BRIDGES.length; i++) {
    const b = BRIDGES[i];
    const cy = Math.cos(-b.yaw), sy = Math.sin(-b.yaw);
    const dx = x - b.x, dz = z - b.z;
    // local coords: along = distance along bridge span, across = lateral offset
    const along = dx * (-sy) + dz * cy;
    const across = dx * cy + dz * sy;
    const halfL = b.len * 0.5;
    const halfW = b.width * 0.5;
    if (Math.abs(along) <= halfL + 0.35 && Math.abs(across) <= halfW + 0.25) {
      const u = Math.max(-1, Math.min(1, along / halfL));
      const archFactor = Math.cos(u * Math.PI * 0.5);
      const y = Math.max(0, archFactor * archFactor * b.arch);
      const blend = 1 - smoothstep(halfW - 0.3, halfW + 0.25, Math.abs(across));
      return { onBridge: true, y: y * blend, bridge: b };
    }
  }
  return { onBridge: false, y: 0, bridge: null };
}

export function riverInfoAt(x, z) {
  let minD2 = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < RIVER_PTS.length; i++) {
    const p = RIVER_PTS[i];
    const dx = x - p.x, dz = z - p.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < minD2) {
      minD2 = d2;
      bestIdx = i;
    }
  }
  const p = RIVER_PTS[bestIdx];
  const dist = Math.sqrt(minD2);
  const width = 2.0 + Math.sin(p.u * Math.PI * 6) * 0.25 + smoothstep(0.65, 1.0, p.u) * 1.1;
  return { dist, width, u: p.u, pt: p };
}

// Precompute path segments for fast terrain flattening
const INNER_SEGS = Object.values(INNER_LAND_ANGLES).map((a) => ({
  from: { x: Math.cos(a) * 8.2, z: Math.sin(a) * 8.2 },
  to: { x: Math.cos(a) * LAND_DIST, z: Math.sin(a) * LAND_DIST },
}));
const OUTER_SEGS = pathSegments();
const ALL_PATH_SEGS = [...INNER_SEGS, ...OUTER_SEGS];

function minPathDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < ALL_PATH_SEGS.length; i++) {
    const sg = ALL_PATH_SEGS[i];
    const sd = distToSegment(x, z, sg.from, sg.to);
    if (sd < d) d = sd;
  }
  return d;
}

export function groundHeightAt(x, z) {
  // 1. Flat walkable mask: Plaza + 10 Lands + Paths
  let flatMask = 0;
  const rCenter = Math.hypot(x, z);
  flatMask = Math.max(flatMask, 1 - smoothstep(9.0, 13.5, rCenter));

  for (let i = 0; i < LAND_BIOMES.length; i++) {
    const b = LAND_BIOMES[i];
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < 18.5) {
      flatMask = Math.max(flatMask, 1 - smoothstep(13.4, 18.2, d));
    }
  }

  const pDist = minPathDist(x, z);
  if (pDist < 5.2) {
    flatMask = Math.max(flatMask, 1 - smoothstep(2.6, 5.2, pDist));
  }

  // 2. Sculpted rolling pastel hills in open space & outer vista
  const n1 = Math.sin(x * 0.068 + 0.4) * Math.cos(z * 0.062 - 0.3);
  const n2 = Math.sin((x + z) * 0.042 - 1.1) * 0.65;
  const n3 = Math.cos(x * 0.11 - z * 0.09) * 0.32;
  const rawHill = Math.max(0, 1.35 + (n1 + n2 + n3) * 1.35);
  const midMask = smoothstep(15.0, 38.0, rCenter);
  const rimRise = smoothstep(56.0, 96.0, rCenter) * (4.6 + Math.sin(Math.atan2(z, x) * 5.0) * 1.4);
  let h = (rawHill * (0.28 + 0.72 * midMask) + rimRise) * (1 - flatMask);

  // 3. Sculpted Castle Hill at CASTLE_POS (-11.5, -8.5)
  const dxC = x - CASTLE_POS.x, dzC = z - CASTLE_POS.z;
  const dC = Math.hypot(dxC, dzC);
  if (dC < 10.6) {
    // Gentle front ramp toward SE (+x, +z toward plaza)
    const hillMask = 1 - smoothstep(5.4, 9.8, dC);
    const castleY = 2.05 * hillMask;
    h = Math.max(h * (1 - hillMask * 0.8), castleY);
  }

  // 4. Waterfall Cliff Bluff behind plunge pool
  const dxW = x - (WATERFALL_POS.x - 1.8), dzW = z - (WATERFALL_POS.z - 1.8);
  const dW = Math.hypot(dxW * 0.85, dzW * 1.05);
  if (dW < 9.2) {
    const cliff = (1 - smoothstep(2.8, 8.6, dW)) * 6.4;
    h = Math.max(h, cliff);
  }

  // 5. Carve smooth river channel & plunge pool basin
  const poolDist = Math.hypot(x - (-21.8), z - (-14.8));
  const rv = riverInfoAt(x, z);
  const effRiverDist = Math.min(rv.dist, poolDist * 0.75);
  const riverCarve = 1 - smoothstep(rv.width * 0.72, rv.width + 1.85, effRiverDist);
  if (riverCarve > 0.001) {
    const bedY = -0.88;
    h = h * (1 - riverCarve) + bedY * riverCarve;
  }

  return h;
}

export function walkHeightAt(x, z) {
  const b = bridgeDeckInfo(x, z);
  const g = groundHeightAt(x, z);
  return b.onBridge ? Math.max(g, b.y) : g;
}

function makeTerrainMesh(grassTex) {
  const SIZE = 260;
  const SEGS = 120;
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const cGrassA = new THREE.Color(0x88cf74);
  const cGrassB = new THREE.Color(0xa0dc86);
  const cHillPeak = new THREE.Color(0xb8e69a);
  const cBank = new THREE.Color(0xe6cd9e);
  const cBed = new THREE.Color(0x6fb2ba);
  const cCastleGrass = new THREE.Color(0x8ed186);
  const tmp = new THREE.Color();
  const biomeCol = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = groundHeightAt(x, z);
    pos.setY(i, y);

    // Base meadow grass variation
    const wave = 0.5 + 0.5 * Math.sin(x * 0.09 + z * 0.07);
    tmp.copy(cGrassA).lerp(cGrassB, wave);
    if (y > 1.2) tmp.lerp(cHillPeak, Math.min(0.65, (y - 1.2) / 5.5));

    // Blend distinct biome tint smoothly around each of the 10 lands
    for (let k = 0; k < LAND_BIOMES.length; k++) {
      const b = LAND_BIOMES[k];
      const d = Math.hypot(x - b.x, z - b.z);
      if (d < 17.5) {
        const w = 1 - smoothstep(b.r, 17.5, d);
        biomeCol.setHex(b.color);
        tmp.lerp(biomeCol, w * 0.94);
      }
    }

    // Castle hill blush-mint tint
    const dC = Math.hypot(x - CASTLE_POS.x, z - CASTLE_POS.z);
    if (dC < 10.5) {
      tmp.lerp(cCastleGrass, (1 - smoothstep(5.5, 10.5, dC)) * 0.55);
    }

    // Riverbank warm sand & submerged bed tint
    const rv = riverInfoAt(x, z);
    const poolD = Math.hypot(x - (-21.8), z - (-14.8));
    const ed = Math.min(rv.dist, poolD * 0.75);
    if (ed < rv.width + 1.8) {
      const bankW = 1 - smoothstep(rv.width * 0.9, rv.width + 1.8, ed);
      tmp.lerp(cBank, bankW * 0.8);
      if (ed < rv.width * 0.95) {
        tmp.lerp(cBed, (1 - smoothstep(rv.width * 0.35, rv.width * 0.95, ed)) * 0.85);
      }
    }

    // Soft mossy-lavender cliff tint near waterfall bluff
    const dW = Math.hypot(x - (WATERFALL_POS.x - 1.8), z - (WATERFALL_POS.z - 1.8));
    if (dW < 7.5 && y > 1.8) {
      biomeCol.setHex(0xb4adc9);
      tmp.lerp(biomeCol, Math.min(0.68, (y - 1.8) / 4.2));
    }

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grassTex,
    roughness: 0.88,
    metalness: 0.0,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

function makeRiverAndWaterfall(softDot) {
  const group = new THREE.Group();

  // Animated water material with flow waves + shoreline foam + golden shimmer
  const waterUniforms = { uTime: { value: 0 }, uDusk: { value: 0 } };
  const riverMat = new THREE.MeshStandardMaterial({
    color: 0x76d6e8,
    roughness: 0.14,
    metalness: 0.14,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
  });
  riverMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.uniforms.uDusk = waterUniforms.uDusk;
    shader.vertexShader = 'uniform float uTime;\nvarying vec2 vWaterUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vWaterUv = uv;
      transformed.y += sin(uv.x * 46.0 - uTime * 2.4) * 0.028 + cos(uv.y * 12.0 + uTime * 1.9) * 0.015;
      `
    );
    shader.fragmentShader = 'uniform float uTime;\nuniform float uDusk;\nvarying vec2 vWaterUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float flow = sin(vWaterUv.x * 64.0 - uTime * 3.1 + sin(vWaterUv.y * 9.0) * 1.5);
      float streak = smoothstep(0.62, 0.96, flow);
      float edgeFoam = smoothstep(0.36, 0.49, abs(vWaterUv.y - 0.5));
      vec3 duskWater = mix(diffuseColor.rgb, vec3(0.45, 0.62, 0.85), uDusk * 0.35);
      diffuseColor.rgb = mix(duskWater, vec3(0.95, 0.99, 1.0), max(streak * 0.38, edgeFoam * 0.62));
      `
    );
  };

  // Build river ribbon along RIVER_PTS
  const n = RIVER_PTS.length;
  const verts = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const indices = [];

  for (let i = 0; i < n; i++) {
    const p = RIVER_PTS[i];
    const len = Math.hypot(p.tx, p.tz) || 1;
    const nx = -p.tz / len;
    const nz = p.tx / len;
    const w = 1.95 + Math.sin(p.u * Math.PI * 6) * 0.22 + smoothstep(0.65, 1.0, p.u) * 1.05;
    const wy = -0.32;
    verts[i * 6 + 0] = p.x - nx * w;
    verts[i * 6 + 1] = wy;
    verts[i * 6 + 2] = p.z - nz * w;
    verts[i * 6 + 3] = p.x + nx * w;
    verts[i * 6 + 4] = wy;
    verts[i * 6 + 5] = p.z + nz * w;
    uvs[i * 4 + 0] = p.u * 4.0;
    uvs[i * 4 + 1] = 0;
    uvs[i * 4 + 2] = p.u * 4.0;
    uvs[i * 4 + 3] = 1;
    if (i < n - 1) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  rGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  rGeo.setIndex(indices);
  rGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(rGeo, riverMat);
  riverMesh.receiveShadow = true;
  group.add(riverMesh);

  // Plunge pool disc at waterfall base
  const poolMesh = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), riverMat);
  poolMesh.rotation.x = -Math.PI / 2;
  poolMesh.position.set(-21.8, -0.31, -14.8);
  poolMesh.receiveShadow = true;
  group.add(poolMesh);

  // Waterfall cliff boulders (chunky pastel-slate/lavender-warm rocks)
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xbcb2cf, roughness: 0.88, flatShading: true });
  const rockSpecs = [
    [-25.0, 2.2, -17.0, 2.4, 2.9, 2.2, 0.2],
    [-26.2, 1.5, -14.6, 1.8, 2.2, 1.7, 1.1],
    [-22.6, 1.4, -18.8, 1.9, 2.1, 1.8, 2.3],
    [-23.6, 4.4, -17.6, 1.7, 1.6, 1.6, 0.7],
    [-25.4, 3.8, -16.2, 1.4, 1.8, 1.4, 1.8],
    [-19.8, 0.2, -13.2, 0.9, 0.65, 0.85, 0.5],
    [-23.6, 0.1, -12.0, 1.1, 0.75, 0.95, 2.1],
  ];
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpecs.length);
  const dmy = new THREE.Object3D();
  rockSpecs.forEach(([x, y, z, sx, sy, sz, rot], i) => {
    dmy.position.set(x, y, z);
    dmy.rotation.set(rot * 0.2, rot, 0);
    dmy.scale.set(sx, sy, sz);
    dmy.updateMatrix();
    rocks.setMatrixAt(i, dmy.matrix);
  });
  rocks.instanceMatrix.needsUpdate = true;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // Cascading Waterfall Sheet (angled curved curtain from top of cliff into plunge pool)
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0xa3e9f7,
    emissive: 0x5cc4e8,
    emissiveIntensity: 0.22,
    roughness: 0.16,
    metalness: 0.1,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  fallMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = waterUniforms.uTime;
    shader.vertexShader = 'varying vec2 vFallUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFallUv = uv;');
    shader.fragmentShader = 'uniform float uTime;\nvarying vec2 vFallUv;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      float foam = sin(vFallUv.y * 22.0 + uTime * 7.5 + sin(vFallUv.x * 16.0) * 1.4);
      float foamBand = smoothstep(0.45, 0.95, foam);
      float topCrest = smoothstep(0.82, 1.0, vFallUv.y);
      float splashEdge = smoothstep(0.18, 0.0, vFallUv.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.99, 1.0), max(foamBand * 0.5, max(topCrest, splashEdge) * 0.85));
      `
    );
  };
  const fallGeo = new THREE.PlaneGeometry(2.9, 5.4, 6, 12);
  const fPos = fallGeo.attributes.position;
  for (let i = 0; i < fPos.count; i++) {
    const py = fPos.getY(i); // -2.7..2.7
    const t = (py + 2.7) / 5.4;
    // Curve gently forward at top crest and flare slightly at bottom
    fPos.setZ(i, Math.sin(t * Math.PI) * 0.55 - (1 - t) * 0.3);
  }
  fallGeo.computeVertexNormals();
  const waterfallMesh = new THREE.Mesh(fallGeo, fallMat);
  waterfallMesh.position.set(-22.8, 2.2, -15.6);
  waterfallMesh.rotation.set(-0.24, Math.PI * 0.28, 0);
  group.add(waterfallMesh);

  // Expanding splash foam ring + rising animated waterfall mist puffs
  const foamRingGeo = new THREE.RingGeometry(0.9, 1.85, 24);
  foamRingGeo.rotateX(-Math.PI / 2);
  const foamRingMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const foamRing = new THREE.Mesh(foamRingGeo, foamRingMat);
  foamRing.position.set(-21.8, -0.25, -14.8);
  group.add(foamRing);

  // Mist puffs + water ripple dots along river
  const MIST_N = 18;
  const mistGeo = new THREE.BufferGeometry();
  const mistPos = new Float32Array(MIST_N * 3);
  const mistCol = new Float32Array(MIST_N * 3);
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  mistGeo.setAttribute('color', new THREE.BufferAttribute(mistCol, 3));
  const mistPoints = new THREE.Points(mistGeo, new THREE.PointsMaterial({
    map: softDot,
    size: 1.55,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  mistPoints.frustumCulled = false;
  group.add(mistPoints);

  // Animated water ripple rings along key river bends
  const RIPPLE_N = 6;
  const rippleGeo = new THREE.RingGeometry(0.35, 0.52, 20);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const ripples = new THREE.InstancedMesh(rippleGeo, rippleMat, RIPPLE_N);
  const rippleAnchors = [
    [-19.8, -17.6], [-8.0, -16.0], [3.5, -13.6], [15.0, -11.0], [26.0, -13.0], [36.0, -8.5],
  ];
  group.add(ripples);

  function update(t, calmMotion, duskFactor) {
    waterUniforms.uTime.value = calmMotion ? 0 : t;
    waterUniforms.uDusk.value = duskFactor;

    const ringPhase = calmMotion ? 0.3 : (t * 0.85) % 1;
    foamRing.scale.setScalar(0.85 + ringPhase * 0.7);
    foamRingMat.opacity = (1 - ringPhase) * 0.65;

    for (let i = 0; i < MIST_N; i++) {
      const p = calmMotion ? (i / MIST_N) : ((t * 0.55 + i / MIST_N) % 1);
      const a = i * 2.1;
      mistPos[i * 3] = -21.8 + Math.cos(a) * (0.45 + p * 1.45);
      mistPos[i * 3 + 1] = -0.1 + p * 1.9;
      mistPos[i * 3 + 2] = -14.8 + Math.sin(a) * (0.45 + p * 1.45);
      const fade = Math.sin(p * Math.PI) * 0.72;
      mistCol[i * 3] = fade * 0.88;
      mistCol[i * 3 + 1] = fade * 0.96;
      mistCol[i * 3 + 2] = fade;
    }
    mistGeo.attributes.position.needsUpdate = true;
    mistGeo.attributes.color.needsUpdate = true;

    for (let i = 0; i < RIPPLE_N; i++) {
      const rp = calmMotion ? 0.4 : ((t * 0.45 + i * 0.21) % 1);
      const [rx, rz] = rippleAnchors[i];
      dmy.position.set(rx, -0.28, rz);
      dmy.rotation.set(0, 0, 0);
      dmy.scale.setScalar(0.65 + rp * 1.6);
      dmy.updateMatrix();
      ripples.setMatrixAt(i, dmy.matrix);
    }
    ripples.instanceMatrix.needsUpdate = true;
    rippleMat.opacity = calmMotion ? 0.35 : 0.46;
  }

  return { group, update };
}

function makeFootbridges(softDot, addCollider) {
  const group = new THREE.Group();
  const lanternHalos = [];
  const lampGlassMat = new THREE.MeshStandardMaterial({
    color: 0xffeeb5,
    emissive: 0xffcf6e,
    emissiveIntensity: 1.35,
    roughness: 0.3,
  });

  const woodA = new THREE.MeshStandardMaterial({ color: 0xd9a87c, roughness: 0.78, flatShading: true });
  const woodB = new THREE.MeshStandardMaterial({ color: 0xc79266, roughness: 0.8, flatShading: true });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xefe3d5, roughness: 0.84, flatShading: true });
  const railMat = new THREE.MeshStandardMaterial({ color: 0xf9eee2, roughness: 0.75, flatShading: true });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xf4cb64, roughness: 0.35, metalness: 0.55 });

  const plankGeo = new THREE.BoxGeometry(3.8, 0.14, 0.38);
  const postGeo = new THREE.CylinderGeometry(0.09, 0.11, 1.05, 8);
  const capGeo = new THREE.SphereGeometry(0.13, 8, 6);
  const bulbGeo = new THREE.SphereGeometry(0.18, 10, 8);
  const pierGeo = new THREE.BoxGeometry(4.4, 1.1, 1.0);

  BRIDGES.forEach((b) => {
    const bg = new THREE.Group();
    bg.position.set(b.x, 0, b.z);
    bg.rotation.y = b.yaw;

    // Stone end piers anchoring bridge into banks
    for (const sz of [-1, 1]) {
      const pier = new THREE.Mesh(pierGeo, stoneMat);
      pier.position.set(0, -0.3, sz * (b.len * 0.5 + 0.1));
      pier.castShadow = pier.receiveShadow = true;
      bg.add(pier);
    }

    // Arched wooden planks
    const PLANKS = 14;
    for (let i = 0; i < PLANKS; i++) {
      const u = ((i + 0.5) / PLANKS) * 2 - 1; // -1..1
      const z = u * (b.len * 0.5);
      const y = Math.pow(Math.cos(u * Math.PI * 0.5), 2) * b.arch;
      const slope = -Math.sin(u * Math.PI) * 0.24;
      const plank = new THREE.Mesh(plankGeo, i % 2 ? woodA : woodB);
      plank.position.set(0, y - 0.05, z);
      plank.rotation.x = slope;
      plank.scale.x = b.width / 3.9;
      plank.castShadow = plank.receiveShadow = true;
      bg.add(plank);
    }

    // Side rails + glowing post lanterns at bridge corners
    const rx = b.width * 0.48;
    for (const sx of [-1, 1]) {
      for (let i = 0; i <= 4; i++) {
        const u = (i / 4) * 2 - 1;
        const z = u * (b.len * 0.46);
        const y = Math.pow(Math.cos(u * Math.PI * 0.5), 2) * b.arch;
        const post = new THREE.Mesh(postGeo, railMat);
        post.position.set(sx * rx, y + 0.48, z);
        post.castShadow = true;
        bg.add(post);

        if (i === 0 || i === 4) {
          const bulb = new THREE.Mesh(bulbGeo, lampGlassMat);
          bulb.position.set(sx * rx, y + 1.1, z);
          bg.add(bulb);
          const cap = new THREE.Mesh(capGeo, goldMat);
          cap.position.set(sx * rx, y + 1.28, z);
          cap.scale.set(1.1, 0.55, 1.1);
          bg.add(cap);

          const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: softDot, color: 0xffdf99, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending,
          }));
          halo.position.set(sx * rx, y + 1.1, z);
          halo.scale.setScalar(1.35);
          halo.raycast = () => {};
          bg.add(halo);
          lanternHalos.push(halo);
        } else {
          const finial = new THREE.Mesh(capGeo, goldMat);
          finial.position.set(sx * rx, y + 1.04, z);
          bg.add(finial);
        }

        // Collider along bridge side rails so Zoe stays comfortably on the deck
        const worldX = b.x + (sx * rx) * Math.cos(b.yaw) + z * Math.sin(b.yaw);
        const worldZ = b.z - (sx * rx) * Math.sin(b.yaw) + z * Math.cos(b.yaw);
        addCollider(worldX, worldZ, 0.35);
      }

      // Segmented arched handrail bar
      for (let i = 0; i < 4; i++) {
        const u0 = (i / 4) * 2 - 1, u1 = ((i + 1) / 4) * 2 - 1;
        const z0 = u0 * (b.len * 0.46), z1 = u1 * (b.len * 0.46);
        const y0 = Math.pow(Math.cos(u0 * Math.PI * 0.5), 2) * b.arch + 0.88;
        const y1 = Math.pow(Math.cos(u1 * Math.PI * 0.5), 2) * b.arch + 0.88;
        const segLen = Math.hypot(z1 - z0, y1 - y0);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, segLen + 0.06), woodB);
        rail.position.set(sx * rx, (y0 + y1) * 0.5, (z0 + z1) * 0.5);
        rail.rotation.x = -Math.atan2(y1 - y0, z1 - z0);
        rail.castShadow = true;
        bg.add(rail);
      }
    }

    group.add(bg);
  });

  return {
    group,
    updateDusk(duskFactor) {
      lampGlassMat.emissiveIntensity = 1.2 + duskFactor * 1.4;
      const op = 0.36 + duskFactor * 0.36;
      for (let i = 0; i < lanternHalos.length; i++) lanternHalos[i].material.opacity = op;
    },
  };
}

function makePathsAndBorders(cobbleTex, softDot) {
  const group = new THREE.Group();
  const pathMat = new THREE.MeshStandardMaterial({
    map: cobbleTex,
    color: 0xfff5e4,
    roughness: 0.84,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // Helper to build a ground-hugging subdivided ribbon between a and b, dipping/skipping bridge spans cleanly
  const buildRibbon = (ax, az, bx, bz, width, skipBridges = true) => {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(8, Math.ceil(len / 1.1));
    const nx = -dz / (len || 1), nz = dx / (len || 1);
    const verts = [];
    const uvs = [];
    const idx = [];
    let vCount = 0;

    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const cx = ax + dx * u;
      const cz = az + dz * u;
      const b = skipBridges ? bridgeDeckInfo(cx, cz) : { onBridge: false };
      const y = b.onBridge ? -0.35 : groundHeightAt(cx, cz) + 0.032;
      verts.push(cx - nx * width * 0.5, y, cz - nz * width * 0.5);
      verts.push(cx + nx * width * 0.5, y, cz + nz * width * 0.5);
      uvs.push(0, u * (len / 10));
      uvs.push(1, u * (len / 10));
      if (i > 0) {
        const p0 = vCount - 2, p1 = vCount - 1, p2 = vCount, p3 = vCount + 1;
        idx.push(p0, p2, p1, p1, p2, p3);
      }
      vCount += 2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, pathMat);
    m.receiveShadow = true;
    return m;
  };

  // Inner 4 paths
  Object.values(INNER_LAND_ANGLES).forEach((ang) => {
    const ux = Math.cos(ang), uz = Math.sin(ang);
    group.add(buildRibbon(ux * 8.4, uz * 8.4, ux * 24.8, uz * 24.8, 4.3, true));
  });

  // Outer trunks & branches
  OUTER_SEGS.forEach((sg) => {
    group.add(buildRibbon(sg.from.x, sg.from.z, sg.to.x, sg.to.z, PATH_WIDTH, true));
  });

  // Rounded cobblestone curb stones + colorful pastel flower borders along paths
  const stonePoints = [];
  const flowerPoints = [];
  const sampleEdge = (ax, az, bx, bz, halfW, stepDist) => {
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len, nz = dx / len;
    const count = Math.floor(len / stepDist);
    for (let i = 1; i < count; i++) {
      const u = i / count;
      const cx = ax + dx * u, cz = az + dz * u;
      if (bridgeDeckInfo(cx, cz).onBridge) continue;
      if (riverInfoAt(cx, cz).dist < 3.0) continue;
      for (const side of [-1, 1]) {
        const sx = cx + nx * side * (halfW + 0.28);
        const sz = cz + nz * side * (halfW + 0.28);
        const gy = groundHeightAt(sx, sz);
        if (gy < -0.15) continue;
        stonePoints.push({ x: sx, y: gy, z: sz, yaw: (i * 1.1 + side) % 6.28, s: 0.85 + ((i * 7) % 4) * 0.08 });
        if (i % 2 === 0) {
          const fx = cx + nx * side * (halfW + 0.72);
          const fz = cz + nz * side * (halfW + 0.72);
          const fy = groundHeightAt(fx, fz);
          if (fy >= -0.1 && Math.hypot(fx, fz) > 10.2) {
            flowerPoints.push({ x: fx, y: fy, z: fz, idx: flowerPoints.length });
          }
        }
      }
    }
  };

  Object.values(INNER_LAND_ANGLES).forEach((ang) => {
    const ux = Math.cos(ang), uz = Math.sin(ang);
    sampleEdge(ux * 9.0, uz * 9.0, ux * 17.5, uz * 17.5, 2.2, 1.5);
  });
  OUTER_SEGS.forEach((sg) => {
    // Only decorate outer trunk/branch sections outside inner land discs
    sampleEdge(sg.from.x, sg.from.z, sg.to.x, sg.to.z, PATH_WIDTH * 0.5, 2.3);
  });

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  if (stonePoints.length) {
    const cobbleGeo = new THREE.DodecahedronGeometry(0.28, 0);
    cobbleGeo.scale(1.15, 0.36, 0.95);
    const cobbleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, flatShading: true });
    const stones = new THREE.InstancedMesh(cobbleGeo, cobbleMat, stonePoints.length);
    const stoneHex = [0xfff3e0, 0xf2e2cd, 0xe8d5c3, 0xfbf4e8];
    stonePoints.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.06, p.z);
      dummy.rotation.set(0, p.yaw, 0);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      stones.setMatrixAt(i, dummy.matrix);
      stones.setColorAt(i, col.setHex(stoneHex[i % stoneHex.length]));
    });
    stones.instanceMatrix.needsUpdate = true;
    if (stones.instanceColor) stones.instanceColor.needsUpdate = true;
    stones.receiveShadow = true;
    group.add(stones);
  }

  if (flowerPoints.length) {
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.045, 0.38, 5);
    const petalGeo = new THREE.SphereGeometry(0.16, 7, 5);
    petalGeo.scale(1, 0.45, 1);
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x5ab86e, roughness: 0.82 });
    const petalMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65, flatShading: true });
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, flowerPoints.length);
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, flowerPoints.length);
    const fCols = [0xff9ec6, 0xffe27a, 0xd8bfff, 0xffb38a, 0xfff7e6, 0x9fe4ff];
    flowerPoints.forEach((f, i) => {
      const s = 0.82 + (i % 4) * 0.11;
      dummy.position.set(f.x, f.y + 0.19 * s, f.z);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);

      dummy.position.set(f.x, f.y + 0.4 * s, f.z);
      dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, col.setHex(fCols[i % fCols.length]));
    });
    stems.instanceMatrix.needsUpdate = true;
    petals.instanceMatrix.needsUpdate = true;
    if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    group.add(stems, petals);
  }

  // Plaza corner lantern posts for warm evening framing
  const postMat = new THREE.MeshStandardMaterial({ color: 0xdfd3ea, roughness: 0.72, flatShading: true });
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff0b8, emissive: 0xffcf6e, emissiveIntensity: 1.35, roughness: 0.3,
  });
  const plazaHalos = [];
  [0.72, 2.38, 3.92, 5.45].forEach((ang) => {
    const lx = Math.cos(ang) * 9.3, lz = Math.sin(ang) * 9.3;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 2.2, 8), postMat);
    post.position.set(lx, 1.1, lz);
    post.castShadow = true;
    group.add(post);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), lampMat);
    globe.position.set(lx, 2.32, lz);
    group.add(globe);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot, color: 0xffe2a0, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.position.set(lx, 2.32, lz);
    halo.scale.setScalar(1.55);
    halo.raycast = () => {};
    group.add(halo);
    plazaHalos.push(halo);
  });

  return {
    group,
    updateDusk(duskFactor) {
      lampMat.emissiveIntensity = 1.2 + duskFactor * 1.4;
      const op = 0.35 + duskFactor * 0.35;
      for (let i = 0; i < plazaHalos.length; i++) plazaHalos[i].material.opacity = op;
    },
  };
}

export function buildTerrainAndWater({ scene, textures, addCollider }) {
  const terrainMesh = makeTerrainMesh(textures.grassTex);
  scene.add(terrainMesh);

  const riverSystem = makeRiverAndWaterfall(textures.softDot);
  scene.add(riverSystem.group);

  const bridgeSystem = makeFootbridges(textures.softDot, addCollider);
  scene.add(bridgeSystem.group);

  const pathSystem = makePathsAndBorders(textures.cobbleTex, textures.softDot);
  scene.add(pathSystem.group);

  // Add subtle waterfall cliff collider so Zoe cannot walk inside boulders
  addCollider(WATERFALL_POS.x - 1.5, WATERFALL_POS.z - 1.5, 4.2);

  return {
    groundHeightAt,
    walkHeightAt,
    riverInfoAt,
    bridgeDeckInfo,
    update(t, calmMotion, duskFactor) {
      riverSystem.update(t, calmMotion, duskFactor);
      bridgeSystem.updateDusk(duskFactor);
      pathSystem.updateDusk(duskFactor);
    },
  };
}
