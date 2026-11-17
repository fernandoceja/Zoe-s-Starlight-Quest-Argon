// ============================================================================
// Zoe's Starlight Quest — Living World: Swaying Trees, Grass, Songbirds,
// Butterflies, Dusk Fireflies, Chimney Smoke & Starlight Particles
// Purely visual & instanced for 60 fps mobile performance.
// ============================================================================

import * as THREE from 'three';
import {
  INNER_LAND_ANGLES, LAND_DIST, OUTER_DIST, CASTLE_POS,
  NEW_LAND_SLOTS, slotPos, pathSegments, distToSegment,
} from './worldmap.js';
import { groundHeightAt, riverInfoAt, WATERFALL_POS } from './world_terrain.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildWorldLife({
  scene, textures, landCenters, landPads, colliders, addCollider, calmMotion, initialTier = 'high',
}) {
  const rng = mulberry32(0x9a57e11);
  const root = new THREE.Group();
  scene.add(root);

  const windUniform = { value: 0 };

  // Precompute path segments & land centers for clean open-meadow placement
  const allSegs = [
    ...Object.values(INNER_LAND_ANGLES).map((a) => ({
      from: { x: Math.cos(a) * 8.2, z: Math.sin(a) * 8.2 },
      to: { x: Math.cos(a) * LAND_DIST, z: Math.sin(a) * LAND_DIST },
    })),
    ...pathSegments(),
  ];
  const centerList = Object.values(landCenters);
  const padList = Object.values(landPads);
  const slotList = NEW_LAND_SLOTS.map((s) => slotPos(s));

  const isSpotClear = (x, z, pad, maxR = 66) => {
    const r = Math.hypot(x, z);
    if (r < 11.2 + pad || r > maxR) return false;
    if (Math.hypot(x - CASTLE_POS.x, z - CASTLE_POS.z) < 9.4 + pad) return false;
    if (Math.hypot(x - WATERFALL_POS.x, z - WATERFALL_POS.z) < 7.2 + pad) return false;
    const rv = riverInfoAt(x, z);
    if (rv.dist < rv.width + 2.2 + pad) return false;
    for (let i = 0; i < allSegs.length; i++) {
      if (distToSegment(x, z, allSegs[i].from, allSegs[i].to) < 3.1 + pad) return false;
    }
    for (let i = 0; i < centerList.length; i++) {
      if (Math.hypot(x - centerList[i].x, z - centerList[i].z) < 11.8 + pad) return false;
    }
    for (let i = 0; i < slotList.length; i++) {
      if (Math.hypot(x - slotList[i].x, z - slotList[i].z) < 11.4 + pad) return false;
    }
    for (let i = 0; i < padList.length; i++) {
      if (Math.hypot(x - padList[i].x, z - padList[i].z) < 3.0 + pad) return false;
    }
    for (let i = 0; i < colliders.length; i++) {
      if (Math.hypot(x - colliders[i].x, z - colliders[i].z) < colliders[i].r + pad) return false;
    }
    return true;
  };

  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // ---- 1. Fluffy Swaying Low-Poly Trees (Instanced trunks + multi-puff crowns) ----
  const treeSpots = [];
  for (let tries = 0; tries < 950 && treeSpots.length < 56; tries++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(15 * 15 + rng() * (68 * 68 - 15 * 15));
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!isSpotClear(x, z, 1.5, 68)) continue;
    if (treeSpots.some((t) => Math.hypot(t.x - x, t.z - z) < 4.2)) continue;
    treeSpots.push({ x, z, y: groundHeightAt(x, z), s: 0.85 + rng() * 0.45, yaw: rng() * Math.PI * 2, variant: treeSpots.length });
  }

  if (treeSpots.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.36, 2.3, 7);
    trunkGeo.translate(0, 1.15, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xa57a5b, roughness: 0.86, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
    trunks.castShadow = true;
    trunks.receiveShadow = true;

    const puffGeo = new THREE.IcosahedronGeometry(1.15, 1);
    const puffMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      flatShading: true,
    });
    puffMat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = windUniform;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vec4 instPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          instPos = instanceMatrix * instPos;
        #endif
        float hMask = clamp((position.y + 1.0) * 0.5, 0.0, 1.0);
        transformed.x += sin(uTime * 1.45 + instPos.x * 0.19 + instPos.z * 0.14) * 0.11 * hMask;
        transformed.z += cos(uTime * 1.2 + instPos.z * 0.17 - instPos.x * 0.12) * 0.08 * hMask;
        `
      );
    };

    const PUFFS_PER_TREE = 3;
    const puffs = new THREE.InstancedMesh(puffGeo, puffMat, treeSpots.length * PUFFS_PER_TREE);
    puffs.castShadow = true;
    puffs.receiveShadow = true;

    const treePalette = [0x8ee09c, 0xa8eba4, 0x7dd2a4, 0xc3eea0, 0xfac8df, 0xd4c3fa];
    const frostCenter = landCenters.frostfall;

    treeSpots.forEach((tr, i) => {
      dummy.position.set(tr.x, tr.y - 0.08, tr.z);
      dummy.rotation.set(0, tr.yaw, 0);
      dummy.scale.setScalar(tr.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      // Register soft trunk collider only inside playable boundary
      if (Math.hypot(tr.x, tr.z) < 58.5) {
        addCollider(tr.x, tr.z, 0.65 * tr.s, 1.45 * tr.s);
      }

      const nearFrost = frostCenter && Math.hypot(tr.x - frostCenter.x, tr.z - frostCenter.z) < 18.5;
      const baseHex = nearFrost ? (i % 2 ? 0xdff4ff : 0xc6e8fa) : treePalette[i % treePalette.length];

      const puffOffsets = [
        [0, 2.75, 0, 1.05],
        [-0.58, 2.28, 0.35, 0.78],
        [0.56, 2.34, -0.32, 0.82],
      ];
      puffOffsets.forEach(([ox, oy, oz, ps], k) => {
        const rx = ox * Math.cos(tr.yaw) - oz * Math.sin(tr.yaw);
        const rz = ox * Math.sin(tr.yaw) + oz * Math.cos(tr.yaw);
        dummy.position.set(tr.x + rx * tr.s, tr.y + oy * tr.s, tr.z + rz * tr.s);
        dummy.rotation.set(k * 0.4, tr.yaw + k * 1.1, 0);
        dummy.scale.set(tr.s * ps, tr.s * ps * 0.86, tr.s * ps);
        dummy.updateMatrix();
        const idx = i * PUFFS_PER_TREE + k;
        puffs.setMatrixAt(idx, dummy.matrix);
        col.setHex(baseHex);
        if (k === 1) col.offsetHSL(0.015, 0, 0.03);
        else if (k === 2) col.offsetHSL(-0.015, 0, -0.02);
        puffs.setColorAt(idx, col);
      });
    });

    trunks.instanceMatrix.needsUpdate = true;
    puffs.instanceMatrix.needsUpdate = true;
    if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
    root.add(trunks, puffs);
  }

  // ---- 2. Swaying Meadow Grass (GPU Wind InstancedMesh with Tier Count) ----
  const GRASS_MAX = 1200;
  const grassGeo = new THREE.ConeGeometry(0.11, 0.56, 4);
  grassGeo.translate(0, 0.28, 0);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, flatShading: true });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vec4 wPos = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wPos = instanceMatrix * wPos;
      #endif
      float tip = clamp(position.y / 0.56, 0.0, 1.0);
      transformed.x += sin(uTime * 2.1 + wPos.x * 0.35 + wPos.z * 0.25) * 0.14 * tip * tip;
      transformed.z += cos(uTime * 1.7 + wPos.z * 0.3 - wPos.x * 0.2) * 0.09 * tip * tip;
      `
    );
  };
  const grassMesh = new THREE.InstancedMesh(grassGeo, grassMat, GRASS_MAX);
  grassMesh.receiveShadow = true;

  const grassCols = [0x90d984, 0xa8e694, 0x80cb7e, 0xbbed9e];
  let grassPlaced = 0;
  for (let tries = 0; tries < 2200 && grassPlaced < GRASS_MAX; tries += 3) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(11 * 11 + rng() * (60 * 60 - 11 * 11));
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    if (!isSpotClear(cx, cz, 0.35, 62)) continue;
    for (let j = 0; j < 3 && grassPlaced < GRASS_MAX; j++) {
      const gx = cx + (rng() - 0.5) * 0.75;
      const gz = cz + (rng() - 0.5) * 0.75;
      const gy = groundHeightAt(gx, gz);
      if (gy < -0.1) continue;
      const s = 0.75 + rng() * 0.65;
      dummy.position.set(gx, gy - 0.03, gz);
      dummy.rotation.set((rng() - 0.5) * 0.2, rng() * Math.PI, (rng() - 0.5) * 0.2);
      dummy.scale.set(0.95, s, 0.95);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(grassPlaced, dummy.matrix);
      grassMesh.setColorAt(grassPlaced, col.setHex(grassCols[grassPlaced % grassCols.length]));
      grassPlaced++;
    }
  }
  grassMesh.instanceMatrix.needsUpdate = true;
  if (grassMesh.instanceColor) grassMesh.instanceColor.needsUpdate = true;
  root.add(grassMesh);

  function setTier(tier) {
    const cap = tier === 'lite' ? 320 : tier === 'balanced' ? 700 : GRASS_MAX;
    grassMesh.count = Math.min(grassPlaced, cap);
  }
  setTier(initialTier);

  // ---- 3. Pastel Songbirds Gliding High Over Kingdom ----
  const birds = [];
  const birdBodyGeo = new THREE.SphereGeometry(0.16, 8, 6);
  birdBodyGeo.scale(1.4, 0.85, 0.85);
  const birdHeadGeo = new THREE.SphereGeometry(0.1, 7, 5);
  const birdWingGeo = new THREE.PlaneGeometry(0.32, 0.16);
  birdWingGeo.rotateX(-Math.PI / 2);
  birdWingGeo.translate(0, 0, 0.14);
  const birdTailGeo = new THREE.ConeGeometry(0.08, 0.22, 4);
  birdTailGeo.rotateZ(Math.PI / 2);

  const birdPalettes = [0xffb4d2, 0x9fdcff, 0xffe48f, 0xd8c2ff, 0xa8ecd0, 0xffc79e, 0xf8b5ec];
  const birdRoutes = [
    { cx: -6, cz: -6, rx: 14, rz: 10, y: 10.2, spd: 0.26 },
    { cx: 8, cz: -10, rx: 15, rz: 9, y: 9.4, spd: 0.22 },
    { cx: 0, cz: 8, rx: 18, rz: 12, y: 8.6, spd: 0.24 },
    { cx: -16, cz: -14, rx: 11, rz: 9, y: 11.4, spd: 0.28 },
    { cx: 24, cz: 4, rx: 14, rz: 12, y: 10.0, spd: 0.21 },
    { cx: -22, cz: 12, rx: 14, rz: 11, y: 9.8, spd: 0.23 },
    { cx: 12, cz: 26, rx: 16, rz: 12, y: 9.2, spd: 0.25 },
  ];
  birdRoutes.forEach((rt, i) => {
    const bg = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: birdPalettes[i % birdPalettes.length], roughness: 0.65, side: THREE.DoubleSide });
    const body = new THREE.Mesh(birdBodyGeo, mat);
    const head = new THREE.Mesh(birdHeadGeo, mat);
    head.position.set(0.2, 0.08, 0);
    const tail = new THREE.Mesh(birdTailGeo, mat);
    tail.position.set(-0.24, 0.03, 0);
    const wL = new THREE.Group();
    const wR = new THREE.Group();
    const mL = new THREE.Mesh(birdWingGeo, mat);
    const mR = new THREE.Mesh(birdWingGeo, mat);
    mR.scale.z = -1;
    wL.add(mL);
    wR.add(mR);
    bg.add(body, head, tail, wL, wR);
    bg.scale.setScalar(1.35);
    root.add(bg);
    birds.push({ group: bg, wL, wR, rt, phase: i * 1.9 });
  });

  // ---- 4. Expanded Butterflies (preserves butterflyAssets for Wardrobe buddy) ----
  const butterflies = [];
  const wingMats = [0xffb3d1, 0xcdb4f6, 0xfff09a, 0x9de6e2].map((hex) => new THREE.MeshBasicMaterial({
    map: textures.wingTex, color: hex, transparent: true, side: THREE.DoubleSide, depthWrite: false,
  }));
  const wingGeo = new THREE.PlaneGeometry(0.35, 0.3);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.175, 0, 0);
  const butterflyAssets = { wingGeo, wingMat: wingMats[2] };

  const mc = landCenters.meadow;
  const routes = [
    [6, 25, 3.5, 2.5], [-6, 28, 3, 3], [1, 31, 4, 2], [6, 6, 3.5, 3], [-5, 5, 3, 3.5],
    [-9.5, -2.5, 3.2, 2.8], [16, -8, 3.6, 2.4], [-18, -14, 3.0, 2.5], [38, -14, 4.0, 3.0], [-42, 16, 4.0, 3.0],
  ];
  routes.forEach((r, i) => {
    const group = new THREE.Group();
    const mat = wingMats[i % wingMats.length];
    const wl = new THREE.Group();
    const wr = new THREE.Group();
    const ml = new THREE.Mesh(wingGeo, mat);
    const mr = new THREE.Mesh(wingGeo, mat);
    ml.scale.x = -1;
    ml.raycast = mr.raycast = () => {};
    wl.add(ml);
    wr.add(mr);
    group.add(wl, wr);
    group.scale.setScalar(2.0);
    butterflies.push({
      group, wl, wr, r,
      ph: i * 1.7,
      fx: 0.17 + (i % 5) * 0.02,
      fz: 0.13 + (i % 4) * 0.023,
      fy: 0.4 + (i % 3) * 0.08,
      px: mc.x - 4 + (i % 5) * 2,
      py: groundHeightAt(mc.x - 4 + (i % 5) * 2, mc.z + 2) + 1.15,
      pz: mc.z + 2,
      pyaw: i * 1.3,
    });
    root.add(group);
  });

  // ---- 5. Dusk Fireflies (fade warmly brighter during dusk waves) ----
  const FIREFLY_N = 56;
  const flyGeo = new THREE.BufferGeometry();
  const flyPos = new Float32Array(FIREFLY_N * 3);
  const flyCol = new Float32Array(FIREFLY_N * 3);
  const flySeeds = [];
  for (let i = 0; i < FIREFLY_N; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 11 + rng() * 44;
    const fx = Math.cos(a) * rad;
    const fz = Math.sin(a) * rad;
    const gy = Math.max(0, groundHeightAt(fx, fz));
    flySeeds.push({ x: fx, y: gy + 0.8 + rng() * 2.2, z: fz, ph: rng() * 6.28, sp: 0.7 + rng() * 0.8 });
  }
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  flyGeo.setAttribute('color', new THREE.BufferAttribute(flyCol, 3));
  const flyPoints = new THREE.Points(flyGeo, new THREE.PointsMaterial({
    map: textures.softDot,
    size: 0.62,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  flyPoints.frustumCulled = false;
  root.add(flyPoints);

  // ---- 6. Floating Golden Starlight Motes ----
  const MOTE_N = 68;
  const moteGeo = new THREE.BufferGeometry();
  const motePos = new Float32Array(MOTE_N * 3);
  const moteCol = new Float32Array(MOTE_N * 3);
  const moteSeeds = [];
  for (let i = 0; i < MOTE_N; i++) {
    const a = rng() * Math.PI * 2;
    const rad = 4 + rng() * 48;
    const mx = Math.cos(a) * rad;
    const mz = Math.sin(a) * rad;
    const gy = Math.max(0, groundHeightAt(mx, mz));
    moteSeeds.push({ x: mx, y: gy + 0.7 + rng() * 4.5, z: mz, ph: rng() * 6.28 });
  }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('color', new THREE.BufferAttribute(moteCol, 3));
  const motePoints = new THREE.Points(moteGeo, new THREE.PointsMaterial({
    map: textures.softDot,
    size: 0.44,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  motePoints.frustumCulled = false;
  root.add(motePoints);

  // ---- 7. Chimney Smoke Puffs ----
  const chimneys = [];
  const PUFFS_PER_CHIMNEY = 5;
  const MAX_CHIMNEYS = 10;
  const smokeGeo = new THREE.IcosahedronGeometry(0.24, 1);
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xfff8fc,
    roughness: 0.92,
    transparent: true,
    opacity: 0.68,
    flatShading: true,
  });
  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, MAX_CHIMNEYS * PUFFS_PER_CHIMNEY);
  smokeMesh.count = 0;
  smokeMesh.frustumCulled = false;
  root.add(smokeMesh);

  function addChimney(x, y, z) {
    if (chimneys.length >= MAX_CHIMNEYS) return;
    chimneys.push({ x, y, z, ph: chimneys.length * 0.73 });
    smokeMesh.count = chimneys.length * PUFFS_PER_CHIMNEY;
  }

  function update(dt, t, isCalm, duskFactor) {
    void dt;
    windUniform.value = isCalm ? 0 : t;

    // Songbirds
    for (let i = 0; i < birds.length; i++) {
      const b = birds[i];
      const u = (isCalm ? 0 : t * b.rt.spd) + b.phase;
      const nx = b.rt.cx + Math.cos(u) * b.rt.rx;
      const nz = b.rt.cz + Math.sin(u) * b.rt.rz;
      const ny = b.rt.y + Math.sin(u * 2.0) * 0.65;
      const vx = -Math.sin(u) * b.rt.rx;
      const vz = Math.cos(u) * b.rt.rz;
      b.group.position.set(nx, ny, nz);
      b.group.rotation.y = Math.atan2(-vz, vx);
      const flap = isCalm ? 0.15 : Math.sin(t * 7.8 + b.phase) * 0.55;
      b.wL.rotation.x = flap;
      b.wR.rotation.x = -flap;
    }

    // Butterflies
    for (let i = 0; i < butterflies.length; i++) {
      const b = butterflies[i];
      const r = b.r;
      let a;
      if (isCalm) {
        b.group.position.set(b.px, b.py, b.pz);
        b.group.rotation.y = b.pyaw;
        a = 0.55 + Math.sin(t * 1.2 + b.ph) * 0.15;
      } else {
        const u = t * b.fx + b.ph;
        const w = t * b.fz + b.ph * 1.3;
        const bx = r[0] + Math.sin(u) * r[2];
        const bz = r[1] + Math.sin(w) * r[3];
        const gy = Math.max(0, groundHeightAt(bx, bz));
        b.group.position.set(bx, gy + 1.55 + Math.sin(t * b.fy + b.ph) * 0.45, bz);
        b.group.rotation.y = Math.atan2(Math.cos(u) * r[2] * b.fx, Math.cos(w) * r[3] * b.fz);
        a = 0.35 + Math.sin(t * 9 + b.ph) * 0.8;
      }
      b.wl.rotation.z = a;
      b.wr.rotation.z = -a;
    }

    // Fireflies (soft glow during afternoon, radiant pastel lanterns during dusk wave)
    const duskBoost = 0.22 + duskFactor * 0.92;
    for (let i = 0; i < FIREFLY_N; i++) {
      const s = flySeeds[i];
      const phase = isCalm ? 0 : t * s.sp + s.ph;
      flyPos[i * 3] = s.x + Math.sin(phase) * 0.85;
      flyPos[i * 3 + 1] = s.y + Math.sin(phase * 1.4) * 0.35;
      flyPos[i * 3 + 2] = s.z + Math.cos(phase * 0.9) * 0.85;
      const tw = isCalm ? 0.5 : (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6 + s.ph * 3)));
      const bri = tw * duskBoost;
      flyCol[i * 3] = bri * 1.0;
      flyCol[i * 3 + 1] = bri * 0.94;
      flyCol[i * 3 + 2] = bri * 0.45;
    }
    flyGeo.attributes.position.needsUpdate = true;
    flyGeo.attributes.color.needsUpdate = true;

    // Starlight Motes
    for (let i = 0; i < MOTE_N; i++) {
      const s = moteSeeds[i];
      const drift = isCalm ? 0 : t;
      motePos[i * 3] = s.x + Math.sin(drift * 0.35 + s.ph) * 0.9;
      motePos[i * 3 + 1] = s.y + Math.sin(drift * 0.55 + s.ph * 2) * 0.45;
      motePos[i * 3 + 2] = s.z + Math.cos(drift * 0.3 + s.ph) * 0.9;
      const bri = (isCalm ? 0.45 : (0.4 + 0.5 * Math.sin(t * 1.8 + s.ph))) * (0.65 + duskFactor * 0.35);
      moteCol[i * 3] = bri;
      moteCol[i * 3 + 1] = bri * 0.93;
      moteCol[i * 3 + 2] = bri * (i % 3 === 0 ? 1.0 : 0.72);
    }
    moteGeo.attributes.position.needsUpdate = true;
    moteGeo.attributes.color.needsUpdate = true;

    // Chimney Smoke Puffs
    if (chimneys.length) {
      let idx = 0;
      for (let c = 0; c < chimneys.length; c++) {
        const ch = chimneys[c];
        for (let p = 0; p < PUFFS_PER_CHIMNEY; p++, idx++) {
          const u = isCalm ? (p / PUFFS_PER_CHIMNEY) : ((t * 0.26 + ch.ph + p / PUFFS_PER_CHIMNEY) % 1);
          const py = ch.y + u * 2.9;
          const px = ch.x + Math.sin(u * 4.5 + p) * 0.22 + u * 0.65;
          const pz = ch.z + Math.cos(u * 3.8 + p) * 0.18 - u * 0.35;
          const sc = Math.sin(u * Math.PI) * (0.55 + u * 1.15);
          dummy.position.set(px, py, pz);
          dummy.rotation.set(u * 1.5, u * 2.1, 0);
          dummy.scale.setScalar(Math.max(0.001, sc));
          dummy.updateMatrix();
          smokeMesh.setMatrixAt(idx, dummy.matrix);
        }
      }
      smokeMesh.instanceMatrix.needsUpdate = true;
    }
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
    wingMats.forEach((m) => m.dispose());
  }

  return {
    butterflyAssets,
    addChimney,
    setTier,
    update,
    dispose,
  };
}
