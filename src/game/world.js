// ============================================================================
// Zoe's Starlight Quest — 3D World Module
// Stylized pastel low-poly storybook kingdom with rolling hills, winding river,
// cascading waterfall, two arched bridges, sparkly castle on a hill, ten themed
// lands, living flora/fauna, golden-hour-to-dusk sky cycle, selective bloom,
// smooth tilted follow camera, first-load castle sweep, and auto quality scaling.
// ============================================================================

import * as THREE from 'three';
import { Input } from './input.js';
import { OUTFIT } from './save.js';
import { NPC_ORDER } from './quests.js';
import { todayKey, treasureSpots, treasureLandsFor, TREASURES_PER_LAND } from './treasures.js';
import { buildCove, makeMerger } from './cove.js';
import { buildIsle } from './isle.js';
import { buildGarden } from './garden.js';
import { buildHarbor } from './harbor.js';
import { buildGlen } from './glen.js';
import { buildBayou } from './bayou.js';
import {
  INNER_LAND_ANGLES, LAND_DIST as LAND_DIST_M, WORLD_RADIUS as WORLD_RADIUS_M, CASTLE_POS,
  PATH_WIDTH, closedSlots, slotPos, pathSegments, distToSegment,
  isCoveOpen, coveGeometry, COVE,
  isIsleOpen, isleGeometry, ISLE, openLandIds,
  isGardenOpen, gardenGeometry, GARDEN,
  isHarborOpen, harborGeometry, HARBOR,
  isBayouOpen, bayouGeometry, BAYOU,
  isGlenOpen, glenGeometry, GLEN,
} from './worldmap.js';
import { detectSoftwareGl, setupEnvironment, createQualityController } from './world_env.js';
import { groundHeightAt, walkHeightAt, riverInfoAt, buildTerrainAndWater } from './world_terrain.js';
import { buildCastle } from './world_castle.js';
import { buildWorldLife } from './world_life.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GOLD = 0xebd373;
const WORLD_RADIUS = WORLD_RADIUS_M;
const PRINCESS_SCALE = 1.2;
const NPC_INTERACT_DIST = 3.5;
const PLAYER_SPEED = 7.5;

const LANDS = {
  library:   { angle: INNER_LAND_ANGLES.library,   label: 'Whispering Library' },
  frostfall: { angle: INNER_LAND_ANGLES.frostfall, label: 'Frostfall Peaks' },
  meadow:    { angle: INNER_LAND_ANGLES.meadow,    label: 'Sunflower Meadows' },
  village:   { angle: INNER_LAND_ANGLES.village,   label: 'Glass Slipper Village' },
};

const NPC_DEFS = {
  belle:      { land: 'library',   dress: 0x5b8def, accent: 0xffd76a, hair: 0x6b4226, hairStyle: 'bun',   name: 'Belle' },
  elsa:       { land: 'frostfall', dress: 0x9fd8f0, accent: 0xffffff, hair: 0xf5ecd7, hairStyle: 'braid', name: 'Elsa' },
  rapunzel:   { land: 'meadow',    dress: 0x9fe6a8, accent: 0xff9ec6, hair: 0xffd34d, hairStyle: 'long',  name: 'Rapunzel' },
  cinderella: { land: 'village',   dress: 0xa9d3f5, accent: 0xfff2b0, hair: 0xd9a05b, hairStyle: 'bun',   name: 'Cinderella' },
  ariel:      { land: 'cove',      dress: 0xff8a65, accent: 0xfff1d6, hair: 0xe8b96a, hairStyle: 'long',  skin: 0xf1c49c, name: 'Ariel' },
  moana:      { land: 'isle',      dress: 0xf2d49b, accent: 0x2b8fb3, hair: 0x3b2417, hairStyle: 'curls', skin: 0xb97a4f, name: 'Moana' },
  jasmine:    { land: 'garden',    dress: 0x2a8f94, accent: 0xdfe8f5, hair: 0x2b1b2e, hairStyle: 'bun',   skin: 0xc98f63, name: 'Jasmine', tiara: false },
  anna:       { land: 'harbor',    dress: 0xe0463c, accent: 0xffd84a, hair: 0xa8743f, hairStyle: 'wavy',  skin: 0xf6d3b5, name: 'Anna' },
  tiana:      { land: 'bayou',     dress: 0x8e44ad, accent: 0xf5b942, hair: 0x2a1a14, hairStyle: 'curls', skin: 0x8a5a3c, name: 'Tiana' },
  aurora:     { land: 'glen',      dress: 0xa3315b, accent: 0xf6e3c8, hair: 0x5a2d3a, hairStyle: 'braid', skin: 0xdba57a, name: 'Aurora', tiara: false },
};

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

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
const rand = mulberry32(0x5741a11);

function starGeometry(outer = 0.45, inner = 0.19) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

// ---------------------------------------------------------------------------
// Princess figure builder (player + NPCs share this)
// ---------------------------------------------------------------------------

const _geo = {};
function G(key, make) {
  if (!_geo[key]) _geo[key] = make();
  return _geo[key];
}
const _mat = {};
function M(key, make) {
  if (!_mat[key]) _mat[key] = make();
  return _mat[key];
}

function buildPrincess(opts, tagId) {
  const group = new THREE.Group();
  const hitMeshes = [];
  let tiaraGemMat = null;
  const skinHex = opts.skin || 0xf6cfa8;
  const skin = M(opts.skin ? 'skin' + skinHex : 'skin', () => new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.78 }));
  const dressMat = new THREE.MeshStandardMaterial({ color: opts.dress, roughness: 0.65 });
  const accentMat = new THREE.MeshStandardMaterial({ color: opts.accent, roughness: 0.58 });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hair, roughness: 0.82 });
  const goldMat = M('gold', () => new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.32, metalness: 0.45, emissive: 0x7a5a14, emissiveIntensity: 0.45 }));
  const silverMat = M('silver', () => new THREE.MeshStandardMaterial({ color: 0xe9eef5, roughness: 0.25, metalness: 0.35, emissive: 0x9aa6b8, emissiveIntensity: 0.3 }));

  const add = (mesh, x, y, z, shadow = true) => {
    mesh.position.set(x, y, z);
    if (shadow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
    mesh.userData.npcId = tagId || null;
    hitMeshes.push(mesh);
    return mesh;
  };

  add(new THREE.Mesh(G('dressCone', () => new THREE.ConeGeometry(0.55, 1.3, 12)), dressMat), 0, 0.65, 0);
  const sleeveGeo = G('sleeve', () => new THREE.SphereGeometry(0.2, 10, 8));
  add(new THREE.Mesh(sleeveGeo, dressMat), -0.52, 1.28, 0);
  add(new THREE.Mesh(sleeveGeo, dressMat), 0.52, 1.28, 0);
  add(new THREE.Mesh(G('bodice', () => new THREE.CylinderGeometry(0.24, 0.3, 0.45, 10)), accentMat), 0, 1.32, 0);

  if (opts.fancy) {
    add(new THREE.Mesh(G('overskirt', () => new THREE.ConeGeometry(0.42, 0.5, 12, 1, true)), accentMat), 0, 1.0, 0).material.side = THREE.DoubleSide;
    const trimMat = M('hemTrim', () => new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.45, emissive: 0xc8a24a, emissiveIntensity: 0.2 }));
    add(new THREE.Mesh(G('hemTrim', () => new THREE.TorusGeometry(0.55, 0.035, 6, 24)), trimMat), 0, 0.04, 0, false).rotation.x = Math.PI / 2;
    const gemMat = M('pinkGem', () => new THREE.MeshStandardMaterial({ color: 0xff7fb0, roughness: 0.3, emissive: 0xff4f90, emissiveIntensity: 0.35 }));
    add(new THREE.Mesh(G('bodiceStar', () => starGeometry(0.075, 0.032)), gemMat), 0, 1.36, 0.285, false);
  }

  const armGeo = G('arm', () => new THREE.CylinderGeometry(0.06, 0.05, 0.5, 8));
  add(new THREE.Mesh(armGeo, skin), -0.56, 1.05, 0).rotation.z = 0.25;
  add(new THREE.Mesh(armGeo, skin), 0.56, 1.05, 0).rotation.z = -0.25;
  add(new THREE.Mesh(G('head', () => new THREE.SphereGeometry(0.32, 14, 12)), skin), 0, 1.86, 0);

  const blushMat = M('blush', () => new THREE.MeshStandardMaterial({ color: 0xff9eb0, roughness: 1 }));
  const blushGeo = G('blush', () => new THREE.SphereGeometry(0.045, 8, 6));
  add(new THREE.Mesh(blushGeo, blushMat), -0.14, 1.8, 0.28, false);
  add(new THREE.Mesh(blushGeo, blushMat), 0.14, 1.8, 0.28, false);

  const eyeMat = M('eye', () => new THREE.MeshStandardMaterial({ color: 0x2a1f3d, roughness: 0.4 }));
  const glintMat = M('glint', () => new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const smileMat = M('smile', () => new THREE.MeshStandardMaterial({ color: 0xb04a6a, roughness: 0.6 }));
  const eyeGeo = G('eye', () => new THREE.SphereGeometry(0.045, 10, 8));
  const glintGeo = G('glint', () => new THREE.SphereGeometry(0.014, 6, 6));
  [-1, 1].forEach((s) => {
    add(new THREE.Mesh(eyeGeo, eyeMat), s * 0.1, 1.87, 0.29, false).scale.set(0.9, 1.2, 0.6);
    add(new THREE.Mesh(glintGeo, glintMat), s * 0.1 + 0.015, 1.895, 0.315, false);
  });
  add(new THREE.Mesh(G('smile', () => new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI)), smileMat), 0, 1.79, 0.3, false).rotation.z = Math.PI;

  if (opts.hairStyle === 'wavy') {
    const mass = add(new THREE.Mesh(G('hairMass', () => new THREE.SphereGeometry(0.4, 12, 10)), hairMat), 0, 1.78, -0.18);
    mass.scale.set(1.05, 1.7, 0.8);
    const fz = opts.fancy ? 0.05 - 0.08 : 0.05;
    const fallGeo = G('hairFall', () => new THREE.SphereGeometry(0.16, 8, 8));
    const l = add(new THREE.Mesh(fallGeo, hairMat), -0.32, 1.35, fz); l.scale.set(1, 2.2, 1);
    const r = add(new THREE.Mesh(fallGeo, hairMat), 0.32, 1.35, fz); r.scale.set(1, 2.2, 1);
    add(new THREE.Mesh(G('hairCap', () => new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat), 0, 1.88, -0.02);
  } else if (opts.hairStyle === 'long') {
    const mass = add(new THREE.Mesh(G('hairMass', () => new THREE.SphereGeometry(0.4, 12, 10)), hairMat), 0, 1.7, -0.2);
    mass.scale.set(1.0, 2.1, 0.75);
    add(new THREE.Mesh(G('hairCap', () => new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat), 0, 1.88, -0.02);
  } else if (opts.hairStyle === 'braid') {
    add(new THREE.Mesh(G('hairCap', () => new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat), 0, 1.88, -0.02);
    const braidGeo = G('braid', () => new THREE.SphereGeometry(0.11, 8, 8));
    for (let i = 0; i < 4; i++) {
      const b = add(new THREE.Mesh(braidGeo, hairMat), 0.22 - i * 0.02, 1.5 - i * 0.28, -0.32 - i * 0.03);
      b.scale.set(1, 1.4, 1);
    }
  } else if (opts.hairStyle === 'curls') {
    add(new THREE.Mesh(G('hairCap', () => new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat), 0, 1.88, -0.02);
    const curlGeo = G('curl', () => new THREE.SphereGeometry(0.16, 10, 8));
    const ring = [[-0.34, 1.98, 0], [0.34, 1.98, 0], [0, 2.1, -0.12], [-0.2, 2.06, -0.1], [0.2, 2.06, -0.1],
      [-0.4, 1.76, -0.08], [0.4, 1.76, -0.08], [-0.3, 1.58, -0.14], [0.3, 1.58, -0.14], [0, 1.82, -0.32]];
    ring.forEach(([x, y, z]) => add(new THREE.Mesh(curlGeo, hairMat), x, y, z));
  } else {
    add(new THREE.Mesh(G('hairCap', () => new THREE.SphereGeometry(0.335, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat), 0, 1.88, -0.02);
    add(new THREE.Mesh(G('bun', () => new THREE.SphereGeometry(0.18, 10, 8)), hairMat), 0, 2.22, -0.18);
  }

  if (opts.tiara !== false) {
    const tiara = add(new THREE.Mesh(G('tiara', () => new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI)), opts.tiaraColor === 'silver' ? silverMat : goldMat), 0, 2.12, 0.02, false);
    tiara.rotation.x = -0.15;
    if (opts.fancy) {
      tiara.scale.setScalar(1.4);
      tiara.rotation.x = -1.0;
      const gemMat = tiaraGemMat = M('pinkGem', () => new THREE.MeshStandardMaterial({ color: 0xff7fb0, roughness: 0.3, emissive: 0xff4f90, emissiveIntensity: 0.35 })).clone();
      const tGemGeo = G('tiaraGem', () => new THREE.SphereGeometry(0.045, 8, 6));
      [0.28, 0.5, 0.72].forEach((t) => {
        const a = Math.PI * t;
        add(new THREE.Mesh(tGemGeo, gemMat), Math.cos(a) * 0.16, Math.sin(a) * 0.16 + 0.03, 0, false);
        tiara.add(group.children[group.children.length - 1]);
      });
    }
  }
  if (opts.fancy) {
    const earMat = M('pinkGem', () => new THREE.MeshStandardMaterial({ color: 0xff7fb0, roughness: 0.3, emissive: 0xff4f90, emissiveIntensity: 0.35 }));
    const earGeo = G('earring', () => new THREE.SphereGeometry(0.03, 8, 6));
    [-1, 1].forEach((sx) => add(new THREE.Mesh(earGeo, earMat), sx * 0.3, 1.72, 0.05, false));
  }

  group.scale.setScalar(PRINCESS_SCALE);
  return { group, hitMeshes, dressMat, tiaraGemMat };
}

// ---------------------------------------------------------------------------
// createWorld
// ---------------------------------------------------------------------------

export function createWorld(container, hooks) {
  hooks = hooks || {};
  const onNearNPC = typeof hooks.onNearNPC === 'function' ? hooks.onNearNPC : () => {};
  const onInteractRequest = typeof hooks.onInteractRequest === 'function' ? hooks.onInteractRequest : () => {};
  const onPauseRequest = typeof hooks.onPauseRequest === 'function' ? hooks.onPauseRequest : () => {};
  const onWorldTap = typeof hooks.onWorldTap === 'function' ? hooks.onWorldTap : () => {};
  const onSecretTap = typeof hooks.onSecretTap === 'function' ? hooks.onSecretTap : () => {};
  const onGateTap = typeof hooks.onGateTap === 'function' ? hooks.onGateTap : () => {};
  const onTreasure = typeof hooks.onTreasure === 'function' ? hooks.onTreasure : () => {};
  const treasuresGot = typeof hooks.treasuresGot === 'function' ? hooks.treasuresGot : () => [];

  const isHandheld = (() => {
    try {
      if (window.matchMedia && matchMedia('(pointer: coarse)').matches) return true;
      if ((navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window) return true;
    } catch (e) { /* fall through */ }
    return Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
  })();
  const isSoftwareGl = detectSoftwareGl();
  const calmMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  // --- Environment, Sky, Lighting & Selective Bloom --------------------------
  const env = setupEnvironment({ container, isHandheld, isSoftwareGl });
  const { renderer, scene, camera, skyMesh, textures } = env;
  const softDot = textures.softDot;
  const renderScene = env.renderFrame;

  let worldPaused = false;

  // --- Colliders & Shared Helpers -------------------------------------------
  const colliders = [];
  const addCollider = (x, z, r, shadowR) => colliders.push({ x, z, r, shadowR });

  const pastel = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.84, flatShading: true });
  const goldMat = M('gold', () => new THREE.MeshStandardMaterial({ color: GOLD, roughness: 0.32, metalness: 0.45, emissive: 0x7a5a14, emissiveIntensity: 0.45 }));

  // --- Rolling Terrain, Winding River, Waterfall, Bridges & Cobble Paths ----
  const terrain = buildTerrainAndWater({ scene, textures, addCollider });

  // --- Hub Plaza ------------------------------------------------------------
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(8.5, 44), new THREE.MeshStandardMaterial({
    color: 0xfcefdc, roughness: 0.84, map: textures.cobbleTex, flatShading: true,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.025;
  plaza.receiveShadow = true;
  scene.add(plaza);

  const ring = new THREE.Mesh(new THREE.RingGeometry(8.5, 9.15, 48), goldMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.036;
  ring.receiveShadow = true;
  scene.add(ring);

  const plazaStar = new THREE.Mesh(
    starGeometry(3.2, 1.4),
    new THREE.MeshStandardMaterial({ color: 0xf7e3a1, roughness: 0.72, flatShading: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  plazaStar.rotation.x = -Math.PI / 2;
  plazaStar.position.y = 0.038;
  plazaStar.receiveShadow = true;
  scene.add(plazaStar);

  // --- Sparkly Princess Castle on Castle Hill -------------------------------
  const castleSys = buildCastle({ scene, starGeometry, softDot });
  const castleCrown = castleSys.castleCrown;
  addCollider(CASTLE_POS.x, CASTLE_POS.z, 5.2);

  // --- Lands & Pads ---------------------------------------------------------
  const LAND_DIST = LAND_DIST_M;
  const PAD_DIST = 18.5;
  const landCenters = {};
  const landPads = {};

  Object.entries(LANDS).forEach(([id, land]) => {
    const cx = Math.cos(land.angle) * LAND_DIST;
    const cz = Math.sin(land.angle) * LAND_DIST;
    landCenters[id] = new THREE.Vector3(cx, 0, cz);
    const px = Math.cos(land.angle) * PAD_DIST;
    const pz = Math.sin(land.angle) * PAD_DIST;
    landPads[id] = new THREE.Vector3(px, 0, pz);
  });

  const coveOpen = isCoveOpen();
  if (coveOpen) {
    const cg = coveGeometry();
    landCenters[COVE.land] = new THREE.Vector3(cg.center.x, 0, cg.center.z);
    landPads[COVE.land] = new THREE.Vector3(cg.pad.x, 0, cg.pad.z);
  }
  const isleOpen = isIsleOpen();
  const openLands = openLandIds();
  if (isleOpen) {
    const ig = isleGeometry();
    landCenters[ISLE.land] = new THREE.Vector3(ig.center.x, 0, ig.center.z);
    landPads[ISLE.land] = new THREE.Vector3(ig.pad.x, 0, ig.pad.z);
  }
  const gardenOpen = isGardenOpen();
  if (gardenOpen) {
    const gg = gardenGeometry();
    landCenters[GARDEN.land] = new THREE.Vector3(gg.center.x, 0, gg.center.z);
    landPads[GARDEN.land] = new THREE.Vector3(gg.pad.x, 0, gg.pad.z);
  }
  const harborOpen = isHarborOpen();
  if (harborOpen) {
    const hg = harborGeometry();
    landCenters[HARBOR.land] = new THREE.Vector3(hg.center.x, 0, hg.center.z);
    landPads[HARBOR.land] = new THREE.Vector3(hg.pad.x, 0, hg.pad.z);
  }
  const bayouOpen = isBayouOpen();
  if (bayouOpen) {
    const bg = bayouGeometry();
    landCenters[BAYOU.land] = new THREE.Vector3(bg.center.x, 0, bg.center.z);
    landPads[BAYOU.land] = new THREE.Vector3(bg.pad.x, 0, bg.pad.z);
  }
  const glenOpen = isGlenOpen();
  if (glenOpen) {
    const gg = glenGeometry();
    landCenters[GLEN.land] = new THREE.Vector3(gg.center.x, 0, gg.center.z);
    landPads[GLEN.land] = new THREE.Vector3(gg.pad.x, 0, gg.pad.z);
  }

  // Track emissive window/lantern materials & pond shimmer for dusk response
  const duskWindows = [];
  let snowPoints = null;
  let iceCrystals = null;
  let meadowSway = null;
  let pondTwinkle = null;
  let frostFlakes = null;

  // ---- (1) Whispering Library: pastel book-trees, cozy pavilion rug & warm lanterns ----
  {
    const c = landCenters.library;
    const trunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 3.2, 8);
    const trunkMat = pastel(0x8e6043);
    const bookGeo = new THREE.BoxGeometry(0.92, 1.22, 0.28);
    const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.68, flatShading: true });
    const N = 14;
    const LAMPS = 3, STACK_BOOKS = [3, 2, 3];
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N + LAMPS);
    const books = new THREE.InstancedMesh(bookGeo, bookMat, N * 2 + 8);
    const canopies = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.55, 1), pastel(0xffffff), N * 2);
    trunks.castShadow = trunks.receiveShadow = true;
    canopies.castShadow = canopies.receiveShadow = true;
    books.castShadow = true;

    const dummy = new THREE.Object3D();
    const palette = [0xff6b8a, 0x60a5fa, 0xffd34d, 0x6ee7a8, 0xb982f4, 0xff9e57];
    const canopyCols = [0xa685e2, 0x68c4ae, 0x7cb5f2, 0xe38fc4];
    const col = new THREE.Color();

    const treeCoords = [];
    for (let i = 0; i < N; i++) {
      let a = (i / N) * Math.PI * 2 + 0.3;
      const diffS = Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2));
      if (Math.abs(diffS) < 0.72) {
        a = Math.PI / 2 + (diffS >= 0 ? 0.85 : -0.85) + (i % 2) * 0.22;
      }
      const rr = 5.6 + (i % 3) * 2.1;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      treeCoords.push({ a, rr, x, z });
      const ty = groundHeightAt(x, z);
      dummy.position.set(x, ty + 1.6, z);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      addCollider(x, z, 0.7, 1.5);

      // Fluffy double-puff storybook canopy
      dummy.position.set(x, ty + 3.9, z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(1.05, 0.92, 1.05);
      dummy.updateMatrix();
      canopies.setMatrixAt(i * 2, dummy.matrix);
      canopies.setColorAt(i * 2, col.setHex(canopyCols[i % canopyCols.length]));

      dummy.position.set(x + Math.cos(i) * 0.55, ty + 4.45, z + Math.sin(i) * 0.55);
      dummy.scale.set(0.68, 0.65, 0.68);
      dummy.updateMatrix();
      canopies.setMatrixAt(i * 2 + 1, dummy.matrix);
      canopies.setColorAt(i * 2 + 1, col.setHex(canopyCols[(i + 1) % canopyCols.length]));

      for (let b = 0; b < 2; b++) {
        const ba = i * 1.3 + b * Math.PI;
        dummy.position.set(x + Math.cos(ba) * 1.35, ty + 3.55 + b * 0.5, z + Math.sin(ba) * 1.35);
        dummy.rotation.set(0.35, ba, b ? -0.4 : 0.4);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        books.setMatrixAt(i * 2 + b, dummy.matrix);
        books.setColorAt(i * 2 + b, col.setHex(palette[(i + b * 3) % palette.length]));
      }
    }

    let bi = N * 2;
    [1, 5, 9].forEach((ti, s) => {
      const tc = treeCoords[ti];
      const sx = c.x + Math.cos(tc.a + 0.28) * (tc.rr + 0.4), sz = c.z + Math.sin(tc.a + 0.28) * (tc.rr + 0.4);
      const sy = groundHeightAt(sx, sz);
      for (let b = 0; b < STACK_BOOKS[s]; b++, bi++) {
        dummy.position.set(sx, sy + 0.14 + b * 0.28, sz);
        dummy.rotation.set(Math.PI / 2, 0, tc.a + b * 0.5);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        books.setMatrixAt(bi, dummy.matrix);
        books.setColorAt(bi, col.setHex(palette[(s * 2 + b) % palette.length]));
      }
    });

    const globeMat = new THREE.MeshStandardMaterial({
      color: 0xffebb8, emissive: 0xffcf6e, emissiveIntensity: 1.5, roughness: 0.35,
    });
    duskWindows.push(globeMat);
    const globes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.32, 10, 8), globeMat, LAMPS);
    [-0.2, 3.4, 4.8].forEach((a, l) => {
      const lx = c.x + Math.cos(a) * 2.9, lz = c.z + Math.sin(a) * 2.9;
      dummy.position.set(lx, 0.96, lz); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.3, 0.6, 0.3); dummy.updateMatrix();
      trunks.setMatrixAt(N + l, dummy.matrix);
      dummy.position.set(lx, 2.1, lz); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      globes.setMatrixAt(l, dummy.matrix);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: softDot, color: 0xffe29c, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      halo.position.set(lx, 2.1, lz);
      halo.scale.setScalar(1.45);
      halo.raycast = () => {};
      scene.add(halo);
      addCollider(lx, lz, 0.3);
    });

    trunks.instanceMatrix.needsUpdate = true;
    books.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    globes.instanceMatrix.needsUpdate = true;
    if (books.instanceColor) books.instanceColor.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    scene.add(trunks, books, canopies, globes);

    // Cozy reading nook rug + scalloped border + gold-trimmed storybook stand
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 28), pastel(0xffd9e8));
    rug.rotation.x = -Math.PI / 2; rug.position.set(c.x, 0.03, c.z);
    rug.receiveShadow = true;
    const rugRim = new THREE.Mesh(new THREE.RingGeometry(2.05, 2.24, 28), goldMat);
    rugRim.rotation.x = -Math.PI / 2; rugRim.position.set(c.x, 0.035, c.z);
    const lectern = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.35, 0.72, 8), pastel(0x9a6a4b));
    lectern.position.set(c.x, 0.36, c.z);
    lectern.castShadow = true;
    const openBook = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.65), pastel(0xfff5e4));
    openBook.position.set(c.x, 0.78, c.z);
    openBook.rotation.x = 0.22;
    openBook.castShadow = true;
    scene.add(rug, rugRim, lectern, openBook);
    addCollider(c.x, c.z, 0.45);
  }

  // ---- (2) Frostfall Peaks: clearcoat glacier spires, frosted snow mounds & crystals ----
  {
    const c = landCenters.frostfall;
    const coneGeo = new THREE.ConeGeometry(2.25, 6.2, 8);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xaedcf8,
      roughness: 0.28,
      metalness: 0.14,
      flatShading: true,
    });
    const capGeo = new THREE.ConeGeometry(1.15, 2.3, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.68, flatShading: true });
    const N = 10;
    let placed = 0;
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, N);
    const caps = new THREE.InstancedMesh(capGeo, capMat, N);
    cones.castShadow = cones.receiveShadow = true;
    caps.castShadow = caps.receiveShadow = true;

    const moundGeo = new THREE.SphereGeometry(1.45, 12, 8);
    const moundMat = new THREE.MeshStandardMaterial({ color: 0xf2f9ff, roughness: 0.8, flatShading: true });
    const mounds = new THREE.InstancedMesh(moundGeo, moundMat, 8);
    mounds.receiveShadow = true;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + 0.15;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 1.2) continue;
      const rr = 4.2 + (i % 3) * 2.0;
      const x = c.x + Math.cos(a) * rr, z = c.z + Math.sin(a) * rr;
      const gy = groundHeightAt(x, z);
      const h = 4.6 + (i % 4);
      dummy.position.set(x, gy + h / 2, z); dummy.scale.set(1, h / 6, 1);
      dummy.rotation.set(0, a, 0); dummy.updateMatrix();
      cones.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, gy + h * 0.92 + 0.5, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      caps.setMatrixAt(placed, dummy.matrix);
      placed++;
      addCollider(x, z, 1.8, 2.75);
    }
    cones.count = caps.count = placed;

    let moundN = 0;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.6;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 1.2) continue;
      const x = c.x + Math.cos(a) * 7.6, z = c.z + Math.sin(a) * 7.6;
      const gy = groundHeightAt(x, z);
      dummy.position.set(x, gy - 0.45, z); dummy.scale.set(1.65, 0.72, 1.65);
      dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      mounds.setMatrixAt(moundN++, dummy.matrix);
    }
    mounds.count = moundN;
    cones.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
    mounds.instanceMatrix.needsUpdate = true;
    scene.add(cones, caps, mounds);

    // Floating faceted crystal spires with subtle aurora bloom
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xb7ecff,
      roughness: 0.18,
      metalness: 0.18,
      emissive: 0x5cc5ff,
      emissiveIntensity: 1.25,
      flatShading: true,
    });
    duskWindows.push(crystalMat);
    const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.46), crystalMat, 10);
    crystals.castShadow = true;
    const crystalBase = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + 1.45 + (i * (Math.PI * 2 - 2.9)) / 9;
      const r = 10.4 + (i % 2) * 0.8;
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      crystalBase.push({ x, z, y: groundHeightAt(x, z) + 0.95 + (i % 3) * 0.25, phase: i * 1.7 });
    }
    const setCrystals = (t) => {
      for (let i = 0; i < 10; i++) {
        const b = crystalBase[i];
        dummy.position.set(b.x, b.y + Math.sin(t * 0.8 + b.phase) * 0.14, b.z);
        dummy.rotation.set(0, t * 0.4 + b.phase, 0);
        dummy.scale.set(1, 1.55, 1); dummy.updateMatrix();
        crystals.setMatrixAt(i, dummy.matrix);
      }
      crystals.instanceMatrix.needsUpdate = true;
    };
    setCrystals(0);
    crystals.userData.set = setCrystals;
    iceCrystals = crystals;
    scene.add(crystals);

    // Falling snow particles
    const COUNT = 260;
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = c.x + (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = c.z + (Math.random() - 0.5) * 24;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    snowPoints = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.24, transparent: true, opacity: 0.88, map: softDot, depthWrite: false,
    }));
    snowPoints.userData.center = c;
    scene.add(snowPoints);
    void frostFlakes;
  }

  // ---- (3) Sunflower Meadows: lush swaying flowers, garden fence & shimmering pond ----
  {
    const c = landCenters.meadow;
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6);
    const stemMat = pastel(0x4caf6d);
    const petalGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.08, 10);
    const petalMat = new THREE.MeshStandardMaterial({ roughness: 0.65, flatShading: true });
    const centerGeo = new THREE.SphereGeometry(0.14, 8, 6);
    const centerMat = pastel(0x8a5a3b);
    const N = 42;
    const stems = new THREE.InstancedMesh(stemGeo, stemMat, N);
    const petals = new THREE.InstancedMesh(petalGeo, petalMat, N);
    const centers = new THREE.InstancedMesh(centerGeo, centerMat, N);
    stems.castShadow = petals.castShadow = true;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const flowerColors = [0xffd34d, 0xff9ec6, 0xff8a7a, 0xfff3a0];
    const fx = new Float32Array(N), fz = new Float32Array(N), fs = new Float32Array(N), fph = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let x = c.x, z = c.z;
      for (let tries = 0; tries < 25; tries++) {
        const a = rand() * Math.PI * 2;
        const rr = 2.6 + rand() * 6.4;
        x = c.x + Math.cos(a) * rr;
        z = c.z + Math.sin(a) * rr;
        if (Math.hypot(x - (c.x + 5.5), z - (c.z - 4.5)) >= 3.65) break;
      }
      const s = 0.82 + rand() * 0.65;
      fx[i] = x; fz[i] = z; fs[i] = s; fph[i] = i * 2.399;
      dummy.rotation.set(0, 0, 0); dummy.scale.set(s, s, s);
      dummy.position.set(x, 0.55 * s, z); dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 1.12 * s, z); dummy.updateMatrix();
      petals.setMatrixAt(i, dummy.matrix);
      petals.setColorAt(i, col.setHex(flowerColors[i % flowerColors.length]));
      dummy.position.set(x, 1.18 * s, z); dummy.updateMatrix();
      centers.setMatrixAt(i, dummy.matrix);
    }
    stems.instanceMatrix.needsUpdate = true;
    petals.instanceMatrix.needsUpdate = true;
    centers.instanceMatrix.needsUpdate = true;
    if (petals.instanceColor) petals.instanceColor.needsUpdate = true;
    scene.add(stems, petals, centers);

    const swayOff = new THREE.Vector3();
    const swayEuler = new THREE.Euler();
    const swayParts = [[stems, 0.55], [petals, 1.12], [centers, 1.18]];
    meadowSway = {
      userData: {
        set(t) {
          for (let i = 0; i < N; i++) {
            const s = fs[i];
            swayEuler.set(Math.sin(t * 1.3 + fph[i]) * 0.08, 0, Math.sin(t * 1.1 + fph[i] * 1.7) * 0.08);
            dummy.rotation.copy(swayEuler); dummy.scale.set(s, s, s);
            for (let k = 0; k < 3; k++) {
              swayOff.set(0, swayParts[k][1] * s, 0).applyEuler(swayEuler);
              dummy.position.set(fx[i] + swayOff.x, swayOff.y, fz[i] + swayOff.z);
              dummy.updateMatrix();
              swayParts[k][0].setMatrixAt(i, dummy.matrix);
            }
          }
          stems.instanceMatrix.needsUpdate = true;
          petals.instanceMatrix.needsUpdate = true;
          centers.instanceMatrix.needsUpdate = true;
        },
      },
    };

    // Cream garden fence arc
    const postGeo = new THREE.BoxGeometry(0.18, 1.1, 0.18);
    const postMat = pastel(0xfff6e8);
    const railGeo = new THREE.BoxGeometry(2.1, 0.14, 0.1);
    const POSTS = 14;
    const posts = new THREE.InstancedMesh(postGeo, postMat, POSTS);
    const rails = new THREE.InstancedMesh(railGeo, postMat, POSTS);
    posts.castShadow = rails.castShadow = true;
    for (let i = 0; i < POSTS; i++) {
      const a = Math.PI * 0.15 + (i / (POSTS - 1)) * Math.PI * 1.2;
      const x = c.x + Math.cos(a) * 8.6, z = c.z + Math.sin(a) * 8.6;
      dummy.position.set(x, 0.55, z); dummy.rotation.set(0, -a + Math.PI / 2, 0); dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      posts.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.72, z); dummy.updateMatrix();
      rails.setMatrixAt(i, dummy.matrix);
      if (i % 3 === 0) addCollider(x, z, 0.3);
    }
    posts.instanceMatrix.needsUpdate = true;
    rails.instanceMatrix.needsUpdate = true;
    scene.add(posts, rails);

    // Clearcoat shimmering meadow pond + lily pads + lotus + twinkles
    const pond = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 28),
      new THREE.MeshStandardMaterial({ color: 0x72cef2, roughness: 0.14, metalness: 0.15 })
    );
    pond.rotation.x = -Math.PI / 2; pond.position.set(c.x + 5.5, 0.035, c.z - 4.5);
    pond.receiveShadow = true;
    scene.add(pond);
    const pondRim = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.15, 28), pastel(0xf1e6d2));
    pondRim.rotation.x = -Math.PI / 2; pondRim.position.set(c.x + 5.5, 0.03, c.z - 4.5);
    pondRim.receiveShadow = true;
    scene.add(pondRim);

    {
      const px = c.x + 5.5, pz = c.z - 4.5;
      const padMat = new THREE.MeshStandardMaterial({
        color: 0x7cc98a, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      });
      const pads = new THREE.InstancedMesh(new THREE.CircleGeometry(0.45, 12, 0.3, 5.7), padMat, 3);
      const padSpots = [[-0.9, 0.5, 0.4], [0.8, -0.9, 2.1], [0.9, 1.1, 4.0]];
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      padSpots.forEach(([dx, dz, yaw], i) => {
        e.set(-Math.PI / 2, 0, yaw); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(px + dx, 0.06, pz + dz), q, new THREE.Vector3(1, 1, 1));
        pads.setMatrixAt(i, m4);
      });
      pads.instanceMatrix.needsUpdate = true;
      scene.add(pads);

      const lx = px + padSpots[0][0], lz = pz + padSpots[0][1];
      const lotus = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 8, 6), pastel(0xffffff), 7);
      const lc = new THREE.Color(), lp = new THREE.Vector3(), ls = new THREE.Vector3();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        e.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); q.setFromEuler(e);
        m4.compose(lp.set(lx + Math.cos(a) * 0.09, 0.15, lz + Math.sin(a) * 0.09), q, ls.set(0.55, 1.2, 0.35));
        lotus.setMatrixAt(i, m4); lotus.setColorAt(i, lc.setHex(0xffb3d1));
      }
      q.identity();
      m4.compose(lp.set(lx, 0.15, lz), q, ls.setScalar(0.5));
      lotus.setMatrixAt(6, m4); lotus.setColorAt(6, lc.setHex(0xfff6d6));
      lotus.instanceMatrix.needsUpdate = true;
      if (lotus.instanceColor) lotus.instanceColor.needsUpdate = true;
      scene.add(lotus);

      const tSpots = [[-1.6, -0.6], [-0.3, -1.7], [1.5, -0.2], [0.2, 0.4], [-0.5, 1.7], [1.7, 1.0]];
      const tPos = new Float32Array(tSpots.length * 3);
      tSpots.forEach(([dx, dz], i) => { tPos[i * 3] = px + dx; tPos[i * 3 + 1] = 0.09; tPos[i * 3 + 2] = pz + dz; });
      const tGeo = new THREE.BufferGeometry();
      tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
      tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tSpots.length * 3), 3));
      const tMat = new THREE.PointsMaterial({
        size: 0.48, vertexColors: true, transparent: true, map: softDot,
        blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
      });
      const twinkles = new THREE.Points(tGeo, tMat);
      twinkles.frustumCulled = false;
      scene.add(twinkles);
      pondTwinkle = (t) => {
        const colArr = tGeo.attributes.color.array;
        for (let i = 0; i < tSpots.length; i++) {
          const k = calmMotion ? 0.45 : 0.12 + 0.52 * (0.5 + 0.5 * Math.sin(t * 1.25 + i * 1.9));
          colArr[i * 3] = k; colArr[i * 3 + 1] = k * 0.92; colArr[i * 3 + 2] = k * 0.65;
        }
        tGeo.attributes.color.needsUpdate = true;
      };
    }
    addCollider(c.x + 5.5, c.z - 4.5, 2.9);
  }

  // ---- (4) Glass Slipper Village: cozy cottages + chimneys + Midnight Clock Tower ----
  const pendingChimneys = [];
  {
    const c = landCenters.village;
    const wallColors = [0xffd9e8, 0xd9ecff, 0xfff3c9, 0xe6ffd9];
    const roofColors = [0xff9ec6, 0x8fbdf5, 0xffc46b, 0x8fd9a8];
    const houseSpots = [
      { dx: -5, dz: -3.5, rot: 0.4 }, { dx: 4.5, dz: -4, rot: -0.5 },
      { dx: -4.5, dz: 4.5, rot: 0.9 }, { dx: 5, dz: 4, rot: -1.1 },
    ];
    const boxMats = [], bloomMats = [], doormats = [];
    const bloomCols = [0xffb3d1, 0xffffff, 0xffe27a];
    const loc = new THREE.Object3D(), wm = new THREE.Matrix4();
    const winGlowM = new THREE.MeshStandardMaterial({
      color: 0xfff5cb, roughness: 0.28, emissive: 0xffcf70, emissiveIntensity: 1.5,
    });
    duskWindows.push(winGlowM);
    const chimMat = pastel(0xd7c4d0);

    houseSpots.forEach((h, i) => {
      const g = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.6, 3), pastel(wallColors[i]));
      walls.position.y = 1.3; walls.castShadow = walls.receiveShadow = true; g.add(walls);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.95, 1.85, 4), pastel(roofColors[i]));
      roof.position.y = 3.5; roof.rotation.y = Math.PI / 4; roof.castShadow = roof.receiveShadow = true; g.add(roof);
      // Stone cottage chimney
      const chim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.3, 0.46), chimMat);
      chim.position.set(0.88, 3.85, -0.55); chim.castShadow = true; g.add(chim);

      const doorM = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), pastel(0x8a5a3b));
      doorM.position.set(0, 0.8, 1.52); g.add(doorM);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.82), winGlowM);
      win.position.set(1.05, 1.6, 1.52); g.add(win);
      const win2 = win.clone(); win2.position.x = -1.05; g.add(win2);

      const wx = c.x + h.dx, wz = c.z + h.dz;
      g.position.set(wx, 0, wz); g.rotation.y = h.rot;
      scene.add(g);
      addCollider(wx, wz, 2.6);
      g.updateMatrixWorld(true);

      // Register cottage chimney top for gentle rising smoke
      const chimTop = new THREE.Vector3(0.88, 4.55, -0.55).applyMatrix4(g.matrixWorld);
      pendingChimneys.push([chimTop.x, chimTop.y, chimTop.z]);

      [1.05, -1.05].forEach((fx) => {
        loc.rotation.set(0, 0, 0); loc.scale.set(1, 1, 1);
        loc.position.set(fx, 1.11, 1.62); loc.updateMatrix();
        boxMats.push(wm.multiplyMatrices(g.matrixWorld, loc.matrix).clone());
        for (let b = 0; b < 3; b++) {
          loc.position.set(fx + (b - 1) * 0.28, 1.22, 1.63); loc.updateMatrix();
          bloomMats.push({ m: wm.multiplyMatrices(g.matrixWorld, loc.matrix).clone(), c: bloomCols[b] });
        }
      });
      loc.position.set(0, 0.04, 2.15); loc.updateMatrix();
      doormats.push(wm.multiplyMatrices(g.matrixWorld, loc.matrix).clone());
    });

    {
      const boxes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.18, 0.22), pastel(0x9a6a45), boxMats.length + 2);
      boxMats.forEach((m, i) => boxes.setMatrixAt(i, m));
      boxes.castShadow = true;
      scene.add(boxes);

      const blooms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.7 }), bloomMats.length);
      const bc = new THREE.Color();
      bloomMats.forEach((b, i) => { blooms.setMatrixAt(i, b.m); blooms.setColorAt(i, bc.set(b.c)); });
      if (blooms.instanceColor) blooms.instanceColor.needsUpdate = true;
      scene.add(blooms);

      const matGeo = new THREE.CircleGeometry(0.55, 20); matGeo.rotateX(-Math.PI / 2);
      const matMat = pastel(0xf2c48a);
      matMat.polygonOffset = true; matMat.polygonOffsetFactor = -2; matMat.polygonOffsetUnits = -2;
      const mats = new THREE.InstancedMesh(matGeo, matMat, doormats.length);
      doormats.forEach((m, i) => mats.setMatrixAt(i, m));
      scene.add(mats);

      const pad = landPads.village;
      const lampSpots = [[pad.x - 0.6, pad.z + 2.6], [pad.x - 0.6, pad.z - 2.6]];
      const topMat = new THREE.MeshStandardMaterial({
        color: 0xffebb8, emissive: 0xffcf6e, emissiveIntensity: 1.5, roughness: 0.35,
      });
      duskWindows.push(topMat);
      const tops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), topMat, 2);
      lampSpots.forEach(([lx, lz], i) => {
        loc.position.set(lx, 1.1, lz); loc.scale.set(0.17, 12.2, 0.68); loc.updateMatrix();
        boxes.setMatrixAt(boxMats.length + i, loc.matrix);
        loc.scale.set(1, 1, 1);
        loc.position.set(lx, 2.3, lz); loc.updateMatrix(); tops.setMatrixAt(i, loc.matrix);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softDot, color: 0xffe29c, transparent: true, opacity: 0.44, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        halo.position.set(lx, 2.3, lz);
        halo.scale.setScalar(1.35);
        halo.raycast = () => {};
        scene.add(halo);
        addCollider(lx, lz, 0.3);
      });
      boxes.instanceMatrix.needsUpdate = true;
      tops.instanceMatrix.needsUpdate = true;
      scene.add(tops);
    }

    // Ornate Midnight Clock Tower
    const t = new THREE.Group();
    const towerMat = pastel(0xfff3c9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.45, 8, 2.45), towerMat);
    body.position.y = 4; body.castShadow = body.receiveShadow = true; t.add(body);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.3, 2.7), goldMat);
    trim.position.y = 8.05; t.add(trim);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.05, 2.2, 4), pastel(0xff9ec6));
    cap.position.y = 9.2; cap.rotation.y = Math.PI / 4; cap.castShadow = true; t.add(cap);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.95, 0.12, 24),
      new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.4, emissive: 0xffe6aa, emissiveIntensity: 0.35 })
    );
    face.rotation.x = Math.PI / 2; face.position.set(0, 6.6, 1.24); t.add(face);
    const rimM = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 24), goldMat);
    rimM.position.set(0, 6.6, 1.28); t.add(rimM);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.05), handMat);
    hourHand.geometry.translate(0, 0.25, 0);
    hourHand.position.set(0, 6.6, 1.34); hourHand.rotation.z = -Math.PI / 3; t.add(hourHand);
    const minHand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.05), handMat);
    minHand.geometry.translate(0, 0.4, 0);
    minHand.position.set(0, 6.6, 1.36); minHand.rotation.z = Math.PI / 6; t.add(minHand);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), goldMat);
    pin.position.set(0, 6.6, 1.38); t.add(pin);
    const tx = c.x + 0.5, tz = c.z - 6.5;
    t.position.set(tx, 0, tz); t.rotation.y = 0.3;
    scene.add(t);
    addCollider(tx, tz, 1.9);
  }

  // --- Closed star gates (shown if any slot is unopened) ---------------------
  const NEW_PATHS = pathSegments();
  const closedGates = closedSlots().map((s) => {
    const p = slotPos(s);
    return { slot: s.slot, x: p.x, z: p.z, yaw: Math.atan2(-p.x, -p.z) };
  });
  let gateVeilMat = null;
  if (closedGates.length) {
    const dummy = new THREE.Object3D();
    const n = closedGates.length;
    const gateMat = M('gateStone', () => new THREE.MeshStandardMaterial({
      color: 0xe9dcff, roughness: 0.55, emissive: 0xb9a4f0, emissiveIntensity: 0.4, flatShading: true,
    }));
    const pathMat = pastel(0xf2deb6);
    const pads = new THREE.InstancedMesh(G('gatePad', () => new THREE.CircleGeometry(4.6, 28)), pathMat, n);
    const pillars = new THREE.InstancedMesh(G('gatePillar', () => new THREE.CylinderGeometry(0.36, 0.46, 4.2, 8)), gateMat, n * 2);
    const arches = new THREE.InstancedMesh(G('gateArch', () => new THREE.TorusGeometry(2.0, 0.3, 6, 16, Math.PI)), gateMat, n);
    const stars = new THREE.InstancedMesh(
      G('gateStar', () => starGeometry(0.85, 0.36)),
      M('gateStar', () => new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0xffc63d, emissiveIntensity: 1.4, side: THREE.DoubleSide })),
      n
    );
    const veilGeo = G('gateVeil', () => {
      const sh = new THREE.Shape();
      sh.moveTo(-1.95, 0.1); sh.lineTo(1.95, 0.1); sh.lineTo(1.95, 4.2);
      sh.absarc(0, 4.2, 1.95, 0, Math.PI, false);
      sh.lineTo(-1.95, 0.1);
      return new THREE.ShapeGeometry(sh, 14);
    });
    gateVeilMat = M('gateVeil', () => new THREE.MeshBasicMaterial({
      color: 0xe4d6ff, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false,
    }));
    const veils = new THREE.InstancedMesh(veilGeo, gateVeilMat, n);
    const holder = new THREE.Object3D(), part = new THREE.Object3D();
    const put = (mesh, idx, x, y, z) => {
      part.position.set(x, y, z); part.rotation.set(0, 0, 0); part.updateMatrix();
      mesh.setMatrixAt(idx, holder.matrix.clone().multiply(part.matrix));
    };
    closedGates.forEach((g, i) => {
      const gy = groundHeightAt(g.x, g.z);
      holder.position.set(g.x, gy, g.z); holder.rotation.set(0, g.yaw, 0); holder.updateMatrix();
      put(pillars, i * 2, -2.0, 2.1, 0); put(pillars, i * 2 + 1, 2.0, 2.1, 0);
      put(arches, i, 0, 4.2, 0);
      put(stars, i, 0, 7.0, 0);
      put(veils, i, 0, 0, 0);
      addCollider(g.x, g.z, 2.5);
    });
    closedGates.forEach((g, i) => {
      dummy.position.set(g.x, groundHeightAt(g.x, g.z) + 0.026, g.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      pads.setMatrixAt(i, dummy.matrix);
    });
    for (const m of [pads, pillars, arches, stars, veils]) { m.instanceMatrix.needsUpdate = true; scene.add(m); }
  }

  // --- Flowering bushes in open hills (grounded cleanly onto hill heightfield) ---
  {
    const bushGreens = [0x86c785, 0x78bd7c];
    const flowerColors = [0xffb3d1, 0xffffff, 0xffe27a];
    const nearRingPaths = (x, z, pad) => {
      for (const sg of NEW_PATHS) if (distToSegment(x, z, sg.from, sg.to) < PATH_WIDTH / 2 + 1.2 + pad) return true;
      for (const g of closedGates) if (Math.hypot(x - g.x, z - g.z) < 6 + pad) return true;
      return false;
    };
    const openSpot = (x, z, pad, rMax = 44) => {
      const r = Math.hypot(x, z);
      if (r < 11 + pad || r > rMax) return false;
      if (nearRingPaths(x, z, pad)) return false;
      if (riverInfoAt(x, z).dist < 4.2 + pad) return false;
      for (const land of Object.values(LANDS)) {
        const dx = Math.cos(land.angle), dz = Math.sin(land.angle);
        const t = Math.max(0, Math.min(LAND_DIST, x * dx + z * dz));
        if (Math.hypot(x - dx * t, z - dz * t) < 3.2 + pad) return false;
      }
      for (const c of Object.values(landCenters)) if (Math.hypot(x - c.x, z - c.z) < 11.8 + pad) return false;
      if (Math.hypot(x - CASTLE_POS.x, z - CASTLE_POS.z) < 9.2 + pad) return false;
      for (const p of Object.values(landPads)) if (Math.hypot(x - p.x, z - p.z) < 2.8 + pad) return false;
      for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return false;
      return true;
    };
    const pickSpot = (pad) => {
      for (let tries = 0; tries < 60; tries++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(120 + rand() * 1700);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (openSpot(x, z, pad)) return { x, z };
      }
      return null;
    };
    const rand2 = mulberry32(0x0b16c0de);
    const pickOuter = (pad) => {
      for (let tries = 0; tries < 60; tries++) {
        const a = rand2() * Math.PI * 2;
        const r = Math.sqrt(1600 + rand2() * (57 * 57 - 1600));
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (openSpot(x, z, pad, 58)) return { x, z, rnd: rand2 };
      }
      return null;
    };

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const bushSpots = [];
    while (bushSpots.length < 18) {
      const p = pickSpot(0.8);
      if (!p) break;
      if (bushSpots.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < 3.2)) continue;
      bushSpots.push(p);
    }
    for (let k = 0; k < 10; k++) {
      const p = pickOuter(0.8);
      if (p && !bushSpots.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < 3.2)) bushSpots.push(p);
    }
    const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.85, 1), pastel(0xffffff), bushSpots.length);
    const blooms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshStandardMaterial({ roughness: 0.7 }), bushSpots.length * 3);
    bushes.castShadow = bushes.receiveShadow = true;

    bushSpots.forEach((b, i) => {
      const rnd = b.rnd || rand;
      const s = 0.85 + rnd() * 0.32;
      const gy = groundHeightAt(b.x, b.z);
      dummy.position.set(b.x, gy + 0.48 * s, b.z);
      dummy.rotation.set(0, rnd() * Math.PI * 2, 0);
      dummy.scale.set(s, s * 0.85, s);
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
      bushes.setColorAt(i, col.setHex(bushGreens[i % 2]));
      addCollider(b.x, b.z, 0.8);

      for (let f = 0; f < 3; f++) {
        const th = rnd() * Math.PI * 2, el = 0.5 + rnd() * 0.8;
        const R = 0.85 * s * 0.98;
        dummy.position.set(
          b.x + Math.cos(el) * Math.cos(th) * R,
          gy + 0.48 * s + Math.sin(el) * R * 0.85,
          b.z + Math.cos(el) * Math.sin(th) * R
        );
        dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        blooms.setMatrixAt(i * 3 + f, dummy.matrix);
        blooms.setColorAt(i * 3 + f, col.setHex(flowerColors[(i + f) % 3]));
      }
    });
    bushes.instanceMatrix.needsUpdate = true;
    blooms.instanceMatrix.needsUpdate = true;
    if (bushes.instanceColor) bushes.instanceColor.needsUpdate = true;
    if (blooms.instanceColor) blooms.instanceColor.needsUpdate = true;
    scene.add(bushes, blooms);
  }

  // --- NPCs -----------------------------------------------------------------
  const npcs = {};
  const addShadow = (radius) => {
    const sh = new THREE.Mesh(
      G('blobShadow', () => new THREE.CircleGeometry(1, 24)),
      M('blobShadow', () => new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.22, depthWrite: false }))
    );
    sh.rotation.x = -Math.PI / 2;
    sh.scale.setScalar(radius);
    sh.renderOrder = 1;
    scene.add(sh);
    return sh;
  };
  const SHADOW_R = 0.75 * PRINCESS_SCALE;
  const angleDelta = (a, b) => {
    const d = (b - a) % (Math.PI * 2);
    return d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d;
  };

  const npcHitMeshes = [];
  const starGeoShared = starGeometry(0.5, 0.21);

  NPC_ORDER.map((id) => [id, NPC_DEFS[id]]).forEach(([id, def], i) => {
    const padPos = landPads[def.land];
    const py = groundHeightAt(padPos.x, padPos.z);
    const { group, hitMeshes } = buildPrincess(
      { dress: def.dress, accent: def.accent, hair: def.hair, hairStyle: def.hairStyle, skin: def.skin, tiara: def.tiara !== false },
      id
    );
    group.position.set(padPos.x, py, padPos.z);
    group.rotation.y = Math.atan2(-padPos.x, -padPos.z);
    scene.add(group);
    const shadow = addShadow(SHADOW_R);
    shadow.position.set(padPos.x, py + 0.05, padPos.z);
    npcHitMeshes.push(...hitMeshes);
    addCollider(padPos.x, padPos.z, 0.8 * PRINCESS_SCALE);

    const pad = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 28),
      new THREE.MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.55 })
    );
    pad.rotation.x = -Math.PI / 2; pad.position.set(padPos.x, py + 0.04, padPos.z);
    scene.add(pad);

    const starMat = new THREE.MeshStandardMaterial({
      color: GOLD, emissive: 0xffc63d, emissiveIntensity: 1.25, side: THREE.DoubleSide, transparent: true, opacity: 0.96,
    });
    const star = new THREE.Mesh(starGeoShared, starMat);
    star.position.set(padPos.x, py + 3.1 * PRINCESS_SCALE, padPos.z);
    scene.add(star);
    star.userData.npcId = id;
    npcHitMeshes.push(star);

    npcs[id] = { id, def, group, star, starMat, pad, state: 'available', hopT: -1, baseY: py, hue: i * 0.27, baseYaw: group.rotation.y, swayPhase: i * 1.7, padGlow: 0 };
  });

  // --- Today's star ---------------------------------------------------------
  const todayStar = new THREE.Mesh(
    starGeometry(0.95, 0.4),
    new THREE.MeshStandardMaterial({ color: 0xfff3a8, emissive: 0xffd04a, emissiveIntensity: 1.5, side: THREE.DoubleSide })
  );
  todayStar.visible = false;
  todayStar.raycast = () => {};
  scene.add(todayStar);
  let todayTarget = null;
  function setTodayStar(npcId) {
    todayTarget = npcId && npcs[npcId] ? npcs[npcId] : null;
    todayStar.visible = !!todayTarget;
    if (todayTarget) {
      const g = todayTarget.group.position;
      todayStar.position.set(g.x, todayTarget.baseY + 3.1 * PRINCESS_SCALE + 1.5, g.z);
    }
  }

  // --- Player: Princess Zoe -------------------------------------------------
  const { group: player, dressMat: playerDressMat, tiaraGemMat: playerGemMat } = buildPrincess(
    { dress: 0xff9cc4, accent: 0xdcc6f7, hair: 0x6b4430, hairStyle: 'wavy', tiara: true, tiaraColor: 'silver', fancy: true },
    null
  );
  const startY = Math.max(-0.26, walkHeightAt(0, 4));
  player.position.set(0, startY, 4);
  scene.add(player);
  const playerShadow = addShadow(SHADOW_R);
  playerShadow.position.set(0, startY + 0.045, 4);
  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1.04, 28),
    new THREE.MeshBasicMaterial({
      color: 0xff77b7,
      transparent: true,
      opacity: 0.62,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  playerRing.rotation.x = -Math.PI / 2;
  playerRing.position.set(0, startY + 0.055, 4);
  playerRing.renderOrder = 2;
  playerRing.raycast = () => {};
  scene.add(playerRing);
  const playerVel = new THREE.Vector3();
  const playerPos = player.position;
  let playerAngle = 0;
  let walkPhase = 0;

  let inputEnabled = true;

  // --- Tappable scenery props (grounded onto terrain heightfield) -----------
  const tappables = [];
  const tapItems = [];
  const TAP_DUR = 0.9;
  const tapHitGeo = G('tapHit', () => new THREE.SphereGeometry(1, 8, 6));
  const tapHitMat = M('tapHit', () => { const m = new THREE.MeshBasicMaterial(); m.visible = false; return m; });
  const tapStd = (key, color, emissive) => M(key, () => new THREE.MeshStandardMaterial(
    emissive ? { color, roughness: 0.42, emissive, emissiveIntensity: 1.25, flatShading: true } : { color, roughness: 0.84, flatShading: true }));
  const tapPart = (group, geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = true;
    group.add(m); return m;
  };
  const TAP_KINDS = {
    flower(g, petalHex) {
      tapPart(g, G('tapStem', () => new THREE.CylinderGeometry(0.05, 0.07, 1, 6)), tapStd('tapStem', 0x4caf6d), 0, 0.5, 0);
      const p = tapPart(g, G('tapPetal', () => new THREE.CylinderGeometry(0.4, 0.4, 0.1, 10)), tapStd('tapPetal' + petalHex, petalHex), 0, 1.05, 0);
      p.rotation.x = 0.35;
      tapPart(g, G('tapCenter', () => new THREE.SphereGeometry(0.16, 8, 6)), tapStd('tapCenter', 0x8a5a3b), 0, 1.12, 0.05);
      return { glowY: 1.1, hitR: 0.8 };
    },
    lantern(g) {
      tapPart(g, G('tapPost', () => new THREE.CylinderGeometry(0.07, 0.09, 1, 6)), tapStd('tapPost', 0x8a7a9a), 0, 0.5, 0);
      tapPart(g, G('tapGlobe', () => new THREE.SphereGeometry(0.3, 10, 8)), tapStd('tapGlobe', 0xffe3a0, 0xffcf6e), 0, 1.2, 0);
      return { glowY: 1.2, hitR: 0.85 };
    },
    crystal(g) {
      tapPart(g, G('tapRock', () => new THREE.SphereGeometry(0.4, 7, 5)), tapStd('tapRock', 0xe8f1fa), 0, 0.12, 0, 1.3, 0.45, 1.3);
      tapPart(g, G('tapGem', () => new THREE.OctahedronGeometry(0.4)), tapStd('tapGem', 0xbfe9ff, 0x6ac8ff), 0, 0.85, 0, 0.9, 1.9, 0.9);
      return { glowY: 0.85, hitR: 0.85 };
    },
    sapling(g, leafHex) {
      tapPart(g, G('tapTrunk', () => new THREE.CylinderGeometry(0.1, 0.14, 0.7, 6)), tapStd('tapTrunk', 0x8a6a4b), 0, 0.35, 0);
      tapPart(g, G('tapLeaf', () => new THREE.ConeGeometry(0.6, 1.3, 7)), tapStd('tapLeaf' + leafHex, leafHex), 0, 1.25, 0);
      return { glowY: 1.2, hitR: 0.95 };
    },
    snowman(g) {
      const snow = tapStd('tapSnow', 0xffffff);
      tapPart(g, G('tapBall', () => new THREE.SphereGeometry(0.5, 10, 8)), snow, 0, 0.45, 0);
      tapPart(g, G('tapBall', () => new THREE.SphereGeometry(0.5, 10, 8)), snow, 0, 1.15, 0, 0.7, 0.7, 0.7);
      tapPart(g, G('tapNose', () => new THREE.ConeGeometry(0.07, 0.3, 6)), tapStd('tapNose', 0xff9b4a), 0, 1.15, 0.3).rotation.x = Math.PI / 2;
      return { glowY: 1.1, hitR: 0.95 };
    },
    pot(g, petalHex) {
      tapPart(g, G('tapPot', () => new THREE.CylinderGeometry(0.4, 0.28, 0.5, 10)), tapStd('tapPot', 0xe39a78), 0, 0.25, 0);
      const f = new THREE.Group(); f.position.y = 0.45; f.scale.setScalar(0.7); g.add(f);
      TAP_KINDS.flower(f, petalHex);
      return { glowY: 1.0, hitR: 0.8 };
    },
    star(g) {
      tapPart(g, G('tapPedestal', () => new THREE.CylinderGeometry(0.22, 0.34, 0.8, 8)), tapStd('tapPedestal', 0xffe3ee), 0, 0.4, 0);
      const s = tapPart(g, G('tapStar', () => starGeometry(0.5, 0.21)), M('tapStar', () => new THREE.MeshStandardMaterial({ color: GOLD, emissive: 0xffc63d, emissiveIntensity: 1.35, side: THREE.DoubleSide })), 0, 1.35, 0);
      s.rotation.y = 0.4;
      return { glowY: 1.35, hitR: 0.9 };
    },
    clock(g) {
      tapPart(g, G('tapClkPost', () => new THREE.CylinderGeometry(0.12, 0.17, 1.5, 8)), tapStd('tapClkPost', 0x9a7ab0), 0, 0.75, 0);
      const face = new THREE.Group(); face.position.set(0, 1.95, 0); face.rotation.x = -0.45; g.add(face);
      tapPart(face, G('tapClkRim', () => new THREE.CylinderGeometry(0.62, 0.62, 0.12, 20)), tapStd('tapClkRim', 0xe8b84a), 0, 0, 0).rotation.x = Math.PI / 2;
      tapPart(face, G('tapClkFace', () => new THREE.CylinderGeometry(0.54, 0.54, 0.14, 20)), tapStd('tapClkFace', 0xfffdf5), 0, 0, 0.01).rotation.x = Math.PI / 2;
      const tick = G('tapClkTick', () => new THREE.BoxGeometry(0.05, 0.1, 0.03));
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        tapPart(face, tick, tapStd('tapClkTick', 0x6b5b7b), Math.sin(a) * 0.43, Math.cos(a) * 0.43, 0.08).rotation.z = -a;
      }
      const hand = (len, w, key) => {
        const pivot = new THREE.Group(); pivot.position.z = key === 'h' ? 0.1 : 0.12; face.add(pivot);
        tapPart(pivot, G('tapClkHand' + key, () => new THREE.BoxGeometry(w, len, 0.04)), tapStd('tapClkHand' + key, key === 'h' ? 0x5b4a8a : 0xd1466f), 0, len / 2, 0);
        return pivot;
      };
      g.userData.hourHand = hand(0.28, 0.09, 'h');
      g.userData.minHand = hand(0.42, 0.06, 'm');
      return { glowY: 1.95, hitR: 0.9 };
    },
    books(g) {
      const cols = [0xd6577a, 0x5b8be0, 0x59b87a, 0xf0b840];
      const box = G('tapBook', () => new THREE.BoxGeometry(0.9, 0.2, 0.62));
      cols.forEach((c, i) => { tapPart(g, box, tapStd('tapBook' + c, c), (i % 2 ? 0.05 : -0.05), 0.1 + i * 0.21, 0, 1 - i * 0.07, 1, 1 - i * 0.05).rotation.y = (i - 1.5) * 0.28; });
      return { glowY: 0.6, hitR: 0.85 };
    },
    sunflower(g) {
      tapPart(g, G('tapSfStem', () => new THREE.CylinderGeometry(0.07, 0.1, 1.5, 6)), tapStd('tapStem', 0x4caf6d), 0, 0.75, 0);
      tapPart(g, G('tapSfLeaf', () => new THREE.SphereGeometry(0.28, 6, 4)), tapStd('tapStem', 0x4caf6d), 0.28, 0.6, 0, 1.4, 0.3, 0.7);
      const head = new THREE.Group(); head.position.set(0, 1.6, 0.05); head.rotation.x = 0.35; g.add(head);
      tapPart(head, G('tapSfPetal', () => new THREE.CylinderGeometry(0.72, 0.72, 0.08, 14)), tapStd('tapSfPetal', 0xffc933), 0, 0, 0);
      tapPart(head, G('tapSfPetal2', () => new THREE.CylinderGeometry(0.62, 0.62, 0.1, 8)), tapStd('tapSfPetal2', 0xffe27a), 0, 0.01, 0).rotation.y = 0.4;
      tapPart(head, G('tapSfSeed', () => new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12)), tapStd('tapSfSeed', 0x7a4b2a), 0, 0.06, 0);
      return { glowY: 1.65, hitR: 1.0 };
    },
  };

  const tapSpotFree = (x, z) => {
    for (const c of colliders) if (Math.hypot(x - c.x, z - c.z) < c.r + 0.8) return false;
    for (const p of Object.values(landPads)) if (Math.hypot(x - p.x, z - p.z) < 3.2) return false;
    for (const it of tapItems) if (Math.hypot(x - it.group.position.x, z - it.group.position.z) < 1.8) return false;
    return Math.hypot(x, z) > 4;
  };
  const addTappable = (kind, x, z, arg, colorHex, secret) => {
    let px = x, pz = z;
    for (let k = 0; k < 60 && !tapSpotFree(px, pz); k++) { px = x + Math.cos(k * 2.4) * 0.4 * k; pz = z + Math.sin(k * 2.4) * 0.4 * k; }
    const py = Math.max(0, groundHeightAt(px, pz));
    const group = new THREE.Group();
    group.position.set(px, py, pz);
    group.rotation.y = (tapItems.length * 1.9) % 6.28;
    group.scale.setScalar(1.25);
    const info = (typeof kind === 'function' ? kind : TAP_KINDS[kind])(group, arg);
    const hit = new THREE.Mesh(tapHitGeo, tapHitMat);
    hit.position.y = info.glowY * 0.8; hit.scale.setScalar(info.hitR);
    group.add(hit);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot, color: colorHex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.position.y = info.glowY; glow.visible = false; glow.raycast = () => {};
    group.add(glow);
    scene.add(group);
    const item = { group, hit, glow, kind: typeof kind === 'function' ? 'cove' : kind, baseY: py, t: -1, secret: secret || null };
    hit.userData.tapItem = item;
    tappables.push(hit);
    tapItems.push(item);
    return item;
  };

  let clockItem = null;
  function setClockTime(h, m) {
    const hands = clockItem && clockItem.group.userData;
    if (!hands || !hands.hourHand) return;
    hands.minHand.rotation.z = -(m / 60) * Math.PI * 2;
    hands.hourHand.rotation.z = -(((h % 12) + m / 60) / 12) * Math.PI * 2;
  }

  {
    const L = landCenters;
    const castleX = CASTLE_POS.x, castleZ = CASTLE_POS.z;
    addTappable('star', castleX + 1.0, castleZ + 7.5, 0, 0xfff3a8);
    addTappable('pot', castleX - 4.5, castleZ + 6.5, 0xff9ec6, 0xffc4dc);
    addTappable('pot', castleX + 6.5, castleZ + 5.5, 0xfff3a0, 0xfff3a8);
    addTappable('lantern', castleX + 7.5, castleZ + 1.5, 0, 0xffe3a0);
    // Whispering Library
    addTappable('lantern', L.library.x - 5.2, L.library.z + 2.2, 0, 0xffe3a0);
    addTappable('lantern', L.library.x + 5.4, L.library.z + 2.6, 0, 0xffe3a0);
    addTappable('flower', L.library.x - 3.2, L.library.z - 5.0, 0xb8a4ff, 0xdcd0ff);
    addTappable('sapling', L.library.x + 3.8, L.library.z - 4.6, 0x7fcf9a, 0xcff5dc);
    // Frostfall Peaks
    addTappable('crystal', L.frostfall.x + 4.0, L.frostfall.z + 3.0, 0, 0xbfe9ff);
    addTappable('crystal', L.frostfall.x + 2.5, L.frostfall.z - 4.5, 0, 0xbfe9ff);
    addTappable('snowman', L.frostfall.x - 2.0, L.frostfall.z + 5.0, 0, 0xffffff);
    addTappable('sapling', L.frostfall.x - 1.5, L.frostfall.z - 5.5, 0xcfe8f5, 0xeaf6ff);
    // Sunflower Meadows
    addTappable('flower', L.meadow.x - 4.0, L.meadow.z + 3.0, 0xffd34d, 0xfff3a0);
    addTappable('flower', L.meadow.x + 4.5, L.meadow.z + 2.0, 0xff9ec6, 0xffc4dc);
    addTappable('flower', L.meadow.x + 1.0, L.meadow.z + 6.0, 0xff8a7a, 0xffc4b8);
    addTappable('sapling', L.meadow.x - 5.5, L.meadow.z - 2.5, 0x8fd98f, 0xd3f5d3);
    // Glass Slipper Village
    addTappable('lantern', L.village.x + 3.5, L.village.z - 1.5, 0, 0xffe3a0);
    addTappable('pot', L.village.x - 1.5, L.village.z + 2.5, 0xffb3d1, 0xffd9e8);
    addTappable('pot', L.village.x + 2.0, L.village.z + 6.5, 0xffe27a, 0xfff3a8);
    addTappable('flower', L.village.x - 3.0, L.village.z - 3.0, 0xff9ec6, 0xffc4dc);
    // Secrets
    addTappable('books', L.library.x + 0.5, L.library.z + 5.2, 0, 0xffe3a0, 'bookstack');
    addTappable('crystal', L.frostfall.x - 5.4, L.frostfall.z - 1.0, 0, 0xbfe9ff, 'ice-a');
    addTappable('crystal', L.frostfall.x - 3.2, L.frostfall.z - 1.0, 0, 0xbfe9ff, 'ice-b');
    addTappable('sunflower', L.meadow.x - 1.5, L.meadow.z - 5.0, 0, 0xfff3a0, 'sunflower');
    clockItem = addTappable('clock', L.village.x - 5.0, L.village.z + 1.5, 0, 0xfff3a8, 'clock');
    clockItem.group.rotation.y = 0;
    setClockTime(3, 0);
  }

  let cove = null;
  if (coveOpen) {
    cove = buildCove({
      THREE, scene, center: landCenters[COVE.land], G, M, addCollider, addTappable, starGeometry, softDot, calmMotion,
    });
  }
  let isle = null;
  if (isleOpen) {
    isle = buildIsle({
      THREE, scene, center: landCenters[ISLE.land], G, M, addCollider, addTappable, starGeometry, softDot, calmMotion,
    });
  }
  let garden = null;
  if (gardenOpen) {
    garden = buildGarden({
      THREE, scene, center: landCenters[GARDEN.land], pad: landPads[GARDEN.land], G, M, addCollider, addTappable, starGeometry, softDot, calmMotion,
    });
  }
  let harbor = null;
  if (harborOpen) {
    harbor = buildHarbor({
      THREE, scene, center: landCenters[HARBOR.land], pad: landPads[HARBOR.land], G, M, addCollider, addTappable, starGeometry, softDot, calmMotion,
    });
    const hc = landCenters[HARBOR.land];
    pendingChimneys.push([hc.x - 2.4, 3.8, hc.z + 5.6], [hc.x + 4.9, 3.8, hc.z + 5.6]);
  }
  let bayou = null;
  if (bayouOpen) {
    bayou = buildBayou({
      THREE, scene, center: landCenters[BAYOU.land], pad: landPads[BAYOU.land], G, M, addCollider, addTappable, starGeometry, softDot, calmMotion,
    });
    const bc = landCenters[BAYOU.land];
    pendingChimneys.push([bc.x - 6.6, 4.3, bc.z - 2.8]);
  }
  let glen = null;
  if (glenOpen) {
    glen = buildGlen({ THREE, scene, center: landCenters[GLEN.land], pad: landPads[GLEN.land], G, M, addCollider, addTappable, calmMotion });
  }

  const TAP_GROW = 1.25;
  function tapReact(it, dt) {
    it.t += dt;
    const p = it.t / (it.dur || TAP_DUR);
    if (p >= 1) {
      it.t = -1;
      if (it.react) it.react(it, 1);
      it.group.position.y = it.baseY; it.group.rotation.z = 0;
      it.group.scale.setScalar(TAP_GROW);
      it.glow.visible = false; it.glow.material.opacity = 0;
      return;
    }
    const pulse = Math.sin(Math.PI * p);
    if (calmMotion) {
      it.group.scale.setScalar(TAP_GROW * (1 + 0.12 * pulse));
      it.glow.scale.setScalar(1.8);
      it.glow.material.opacity = 0.85 * pulse;
    } else {
      const fall = 1 - p;
      if (it.react) {
        it.react(it, p);
      } else {
        it.group.position.y = it.baseY + Math.abs(Math.sin(p * Math.PI * 2)) * 0.45 * fall;
        it.group.rotation.z = Math.sin(p * Math.PI * 6) * 0.28 * fall;
        it.group.scale.setScalar(TAP_GROW * (1 + 0.15 * pulse));
      }
      it.glow.scale.setScalar(1.2 + 2.4 * p);
      it.glow.material.opacity = 0.9 * fall;
    }
  }
  function startTapReaction(it) {
    if (it.t >= 0) return false;
    it.t = 0;
    it.glow.visible = true;
    if (it.onTap && !calmMotion) it.onTap(it);
    return true;
  }

  // --- Living World (Swaying Trees, Grass, Songbirds, Butterflies, Dusk Fireflies, Smoke, Motes) ---
  const worldLife = buildWorldLife({
    scene,
    textures,
    landCenters,
    landPads,
    colliders,
    addCollider,
    calmMotion,
    initialTier: env.getTier(),
  });
  pendingChimneys.forEach(([x, y, z]) => worldLife.addChimney(x, y, z));
  const butterflyAssets = worldLife.butterflyAssets;

  // --- Soft ground blob shadows under smaller round props (when software GL disables shadow maps) ---
  if (isSoftwareGl) {
    const props = colliders.filter((c) => c.r >= 0.7 && c.r < 1.3);
    if (props.length) {
      const propShadows = new THREE.InstancedMesh(
        new THREE.CircleGeometry(1, 20),
        new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.14, depthWrite: false }),
        props.length
      );
      const dummy = new THREE.Object3D();
      props.forEach((c, i) => {
        const py = groundHeightAt(c.x, c.z);
        dummy.position.set(c.x, py + 0.045, c.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(c.shadowR || c.r * 1.12);
        dummy.updateMatrix();
        propShadows.setMatrixAt(i, dummy.matrix);
      });
      propShadows.instanceMatrix.needsUpdate = true;
      propShadows.renderOrder = 1;
      scene.add(propShadows);
    }
  }

  // --- Daily Treasures ------------------------------------------------------
  const treasureList = [];
  const treasureHits = [];
  const TREASURE_PICKUP = 1.2, TREASURE_DUR = 0.6, TREASURE_Y = 0.85;
  const TREASURE_GLOW = {
    shell: 0xffc4dc, gem: 0xbfe9ff, feather: 0xe3d6ff, star: 0xfff3a8, ribbon: 0xffb3d1,
    seaglass: 0xbff5ea, blossom: 0xffc0cf, moonstone: 0xdfe9ff, anchor: 0xbfe0ff, lily: 0xffc8e0, rose: 0xffb1ca,
  };
  const TREASURE_KINDS_3D = {
    shell(g) {
      const m = tapStd('trShell', 0xffd9e8);
      tapPart(g, G('trShellBody', () => new THREE.SphereGeometry(0.3, 8, 6)), m, 0, 0, 0, 1.1, 0.55, 1);
      tapPart(g, G('trShellRidge', () => new THREE.TorusGeometry(0.22, 0.03, 5, 10, Math.PI)), tapStd('trShellRidge', 0xf5a3c4), 0, 0.08, 0.05);
      tapPart(g, G('trShellBase', () => new THREE.ConeGeometry(0.13, 0.22, 6)), m, 0, -0.1, -0.25).rotation.x = -Math.PI / 2;
    },
    gem(g) {
      tapPart(g, G('trGem', () => new THREE.OctahedronGeometry(0.3)), tapStd('trGem', 0x9fd8ff, 0x5fb8ff), 0, 0, 0, 0.9, 1.4, 0.9);
    },
    feather(g) {
      tapPart(g, G('trFeather', () => new THREE.SphereGeometry(0.3, 8, 6)), tapStd('trFeather', 0xe3d6ff), 0, 0, 0, 0.35, 1.1, 0.12);
      tapPart(g, G('trQuill', () => new THREE.CylinderGeometry(0.015, 0.02, 0.8, 4)), tapStd('trQuill', 0xb89cf0), 0, -0.05, 0);
    },
    star(g) {
      tapPart(g, G('trStar', () => starGeometry(0.34, 0.15)), M('trStar', () => new THREE.MeshBasicMaterial({ color: GOLD, side: THREE.DoubleSide })), 0, 0, 0);
    },
    seaglass(g) {
      tapPart(g, G('trSeaGlass', () => new THREE.IcosahedronGeometry(0.28, 0)), tapStd('trSeaGlass', 0x8fe3d0, 0x4fc1b0), 0, 0, 0, 1.2, 0.8, 1);
    },
    blossom(g) {
      const petal = G('trPetal', () => new THREE.SphereGeometry(0.17, 6, 5));
      const m = tapStd('trBlossom', 0xff6f91);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        tapPart(g, petal, m, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18, 1, 0.45, 1);
      }
      tapPart(g, G('trBlossomMid', () => new THREE.SphereGeometry(0.09, 6, 5)), tapStd('trBlossomMid', 0xffd24d), 0, 0.05, 0);
    },
    moonstone(g) {
      tapPart(g, G('trMoonstone', () => new THREE.IcosahedronGeometry(0.27, 0)), tapStd('trMoonstone', 0xe6eeff, 0x9fb4ff), 0, 0, 0, 1.15, 0.85, 1);
      tapPart(g, G('trMoonShine', () => new THREE.TorusGeometry(0.16, 0.035, 5, 10, Math.PI * 1.2)), tapStd('trMoonShine', 0xffffff, 0xdfe9ff), 0.02, 0.1, 0.2).rotation.set(0.5, 0, 0.6);
    },
    anchor(g) {
      const iron = tapStd('trAnchor', 0x3f6fb5, 0x1d3d73);
      tapPart(g, G('trAnchorShank', () => new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6)), iron, 0, 0, 0);
      tapPart(g, G('trAnchorBar', () => new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6)), iron, 0, 0.15, 0).rotation.z = Math.PI / 2;
      tapPart(g, G('trAnchorRing', () => new THREE.TorusGeometry(0.07, 0.025, 5, 10)), iron, 0, 0.3, 0);
      tapPart(g, G('trAnchorArms', () => new THREE.TorusGeometry(0.2, 0.035, 5, 10, Math.PI)), iron, 0, -0.14, 0).rotation.z = Math.PI;
      const tip = G('trAnchorTip', () => new THREE.ConeGeometry(0.06, 0.12, 5));
      tapPart(g, tip, iron, -0.2, -0.12, 0).rotation.z = 0.5;
      tapPart(g, tip, iron, 0.2, -0.12, 0).rotation.z = -0.5;
    },
    lily(g) {
      tapPart(g, G('trLilyPad', () => new THREE.CylinderGeometry(0.3, 0.3, 0.04, 10)), tapStd('trLilyPad', 0x5fae5e), 0, -0.14, 0);
      const petal = G('trLilyPetal', () => new THREE.SphereGeometry(0.12, 6, 5));
      const pm = tapStd('trLily', 0xff9fc4, 0xc9578a);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        tapPart(g, petal, pm, Math.cos(a) * 0.12, 0.02, Math.sin(a) * 0.12, 0.8, 1.7, 0.8).rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      }
      tapPart(g, G('trLilyMid', () => new THREE.SphereGeometry(0.07, 6, 5)), tapStd('trLilyMid', 0xffd24d), 0, 0.04, 0);
    },
    rose(g) {
      const m = makeMerger(THREE);
      const ball = G('coveBall', () => new THREE.SphereGeometry(1, 8, 6));
      m.add(G('covePole', () => new THREE.CylinderGeometry(1, 1, 1, 7)), 0x579655, 0, -0.1, 0, 0, 0, 0, 0.025, 0.4, 0.025);
      for (let i = 0; i < 7; i++) { const a = (i * Math.PI * 2) / 7; m.add(ball, i % 2 ? 0xff92b0 : 0xdb527e, Math.cos(a) * 0.12, 0.13, Math.sin(a) * 0.12, 0, a, 0, 0.12, 0.11, 0.08); }
      m.add(ball, 0xffd98a, 0, 0.18, 0, 0, 0, 0, 0.06);
      g.add(new THREE.Mesh(m.build(), M('trRoseVC', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }))));
    },
    ribbon(g) {
      const m = tapStd('trRibbon', 0xff7fb0);
      const cone = G('trBowCone', () => new THREE.ConeGeometry(0.17, 0.32, 6));
      tapPart(g, cone, m, -0.17, 0, 0).rotation.z = Math.PI / 2;
      tapPart(g, cone, m, 0.17, 0, 0).rotation.z = -Math.PI / 2;
      tapPart(g, G('trBowKnot', () => new THREE.SphereGeometry(0.09, 8, 6)), tapStd('trKnot', 0xff5c98), 0, 0, 0);
    },
  };

  const treasureFree = (x, z) => {
    if (!tapSpotFree(x, z)) return false;
    for (const it of treasureList) if (Math.hypot(x - it.group.position.x, z - it.group.position.z) < 1.6) return false;
    return true;
  };
  {
    const gotToday = new Set(treasuresGot());
    for (const landId of treasureLandsFor(openLands)) {
      const c = landCenters[landId];
      if (!c) continue;
      const avoidWater = harbor && landId === HARBOR.land ? (lx, lz) => !harbor.dry(c.x + lx, c.z + lz)
        : bayou && landId === BAYOU.land ? (lx, lz) => !bayou.dry(c.x + lx, c.z + lz) : null;
      for (const sp of treasureSpots(todayKey(), landId, TREASURES_PER_LAND, undefined, avoidWater)) {
        const wx = c.x + sp.x, wz = c.z + sp.z;
        let px = wx, pz = wz;
        const dry = (x, z) => !(cove && landId === COVE.land) || (!cove.wet(x, z) && Math.hypot(x - c.x, z - c.z) < 9.6);
        const dryIsle = (x, z) => !(isle && landId === ISLE.land) || !isle.wet(x, z);
        const dryGarden = (x, z) => !(garden && landId === GARDEN.land) || garden.dry(x, z);
        if (harbor && landId === HARBOR.land) [px, pz] = harbor.settle(wx, wz, treasureFree);
        else if (glen && landId === GLEN.land) [px, pz] = glen.settle(wx, wz, treasureFree);
        else if (bayou && landId === BAYOU.land) [px, pz] = bayou.settle(wx, wz, treasureFree);
        else for (let k = 0; k < 60 && !(treasureFree(px, pz) && dry(px, pz) && dryIsle(px, pz) && dryGarden(px, pz)); k++) {
          px = wx + Math.cos(k * 2.4) * 0.4 * k; pz = wz + Math.sin(k * 2.4) * 0.4 * k;
        }
        const py = Math.max(0, groundHeightAt(px, pz));
        const group = new THREE.Group();
        group.position.set(px, py, pz);
        const body = new THREE.Group();
        body.position.y = TREASURE_Y;
        TREASURE_KINDS_3D[sp.kind](body);
        group.add(body);
        const hit = new THREE.Mesh(tapHitGeo, tapHitMat);
        hit.position.y = TREASURE_Y; hit.scale.setScalar(0.9);
        group.add(hit);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: softDot, color: TREASURE_GLOW[sp.kind], transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        glow.position.y = TREASURE_Y; glow.scale.setScalar(1.1); glow.raycast = () => {};
        group.add(glow);
        const item = { id: sp.id, kind: sp.kind, landId, group, body, glow, hit, phase: treasureList.length * 1.3, t: -1 };
        hit.userData.treasure = item;
        if (gotToday.has(sp.id)) { group.visible = false; item.t = -2; }
        scene.add(group);
        treasureList.push(item);
        if (item.t !== -2) treasureHits.push(hit);
      }
    }
  }
  function collectTreasureItem(it) {
    if (it.t !== -1) return false;
    it.t = 0;
    const i = treasureHits.indexOf(it.hit); if (i >= 0) treasureHits.splice(i, 1);
    it.body.visible = false;
    onTreasure(it.kind, it.landId, it.id);
    return true;
  }
  function updateTreasures(dt, t) {
    for (let i = 0; i < treasureList.length; i++) {
      const it = treasureList[i];
      if (it.t === -2) continue;
      if (it.t >= 0) {
        it.t += dt;
        const p = it.t / TREASURE_DUR;
        if (p >= 1) { it.t = -2; it.group.visible = false; continue; }
        it.glow.material.opacity = 0.9 * (1 - p);
        it.glow.scale.setScalar(calmMotion ? 1.8 : 1.1 + 2.6 * p);
        continue;
      }
      if (!calmMotion) {
        it.body.position.y = TREASURE_Y + Math.sin(t * 2 + it.phase) * 0.12;
        it.body.rotation.y = t * 1.2 + it.phase;
      }
      if (inputEnabled && Math.hypot(playerPos.x - it.group.position.x, playerPos.z - it.group.position.z) < TREASURE_PICKUP) {
        collectTreasureItem(it);
      }
    }
  }

  // --- Closed star gates interaction ----------------------------------------
  const gateHits = [];
  let gateFlash = 0;
  closedGates.forEach((g) => {
    const hit = new THREE.Mesh(tapHitGeo, tapHitMat);
    hit.position.set(g.x, groundHeightAt(g.x, g.z) + 3.2, g.z);
    hit.scale.setScalar(3.6);
    hit.userData.gateSlot = g.slot;
    scene.add(hit);
    gateHits.push(hit);
  });
  function updateGates(dt, t) {
    if (!gateVeilMat) return;
    if (calmMotion) { gateVeilMat.opacity = 0.36; return; }
    gateFlash = Math.max(0, gateFlash - dt * 1.8);
    gateVeilMat.opacity = 0.3 + 0.08 * Math.sin(t * 1.6) + 0.25 * gateFlash;
  }

  // --- Tap-to-interact ------------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  const onPointerDown = (e) => {
    skipIntro();
    if (!inputEnabled) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(npcHitMeshes, false);
    if (hits.length && hits[0].object.userData.npcId) {
      onInteractRequest(hits[0].object.userData.npcId);
      return;
    }
    const trHits = raycaster.intersectObjects(treasureHits, false);
    if (trHits.length) {
      const it = trHits[0].object.userData.treasure;
      if (it && collectTreasureItem(it)) return;
    }
    const tapHits = raycaster.intersectObjects(tappables, false);
    if (tapHits.length) {
      const it = tapHits[0].object.userData.tapItem;
      if (it) {
        const fresh = startTapReaction(it);
        if (fresh) onWorldTap(it.kind);
        if (it.secret) onSecretTap(it.secret);
      }
      return;
    }
    const gHits = raycaster.intersectObjects(gateHits, false);
    if (gHits.length) {
      if (!calmMotion) gateFlash = 1;
      onGateTap(gHits[0].object.userData.gateSlot);
    }
  };
  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  // --- Camera: tilted storybook follow + sweeping castle intro --------------
  const camBase = new THREE.Vector3(0, 12.2, 11.8);
  const camOffset = camBase.clone();
  function frameForAspect(aspect) {
    const k = Math.min(1, Math.max(0, (1 - aspect) / 0.54));
    const ease = k * k * (3 - 2 * k);
    camera.fov = 48 + 12 * ease;
    camOffset.copy(camBase).multiplyScalar(1 + 0.85 * ease);
  }

  const camTarget = new THREE.Vector3().copy(playerPos).add(camOffset);
  const lookTarget = new THREE.Vector3().copy(playerPos);
  const lookAhead = new THREE.Vector3();
  const desiredCam = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const focusCamTmp = new THREE.Vector3();
  const introCam = new THREE.Vector3();
  const introLook = new THREE.Vector3();

  let focusNpc = null;
  let focusW = 0;
  let nearCamW = 0;
  let camSnap = false;
  const FOCUS_DROP = 4.6;
  const FOCUS_ZOOM = 0.72;
  const lastFocusMid = new THREE.Vector3();
  const focusMid = new THREE.Vector3();
  const nearMid = new THREE.Vector3();
  const nearCamTmp = new THREE.Vector3();
  const lastNearMid = new THREE.Vector3();
  let lastNearSide = 1;

  // First-load castle sweeping intro (plays once on initial roam entry, skippable anytime)
  let introPlayed = false;
  let introActive = false;
  let introT = 0;
  const INTRO_DUR = 4.6;
  const introP0 = new THREE.Vector3(-23.5, 13.8, -16.5);
  const introP1 = new THREE.Vector3(-12.5, 9.6, 5.2);
  const introP2 = new THREE.Vector3(-2.0, 12.2, 13.8);
  const introLook0 = new THREE.Vector3(CASTLE_POS.x, 7.0, CASTLE_POS.z - 0.5);
  const introLook1 = new THREE.Vector3(-6.0, 3.2, -3.5);

  function skipIntro() {
    if (!introActive) return;
    introActive = false;
  }
  const onAnySkipKey = () => skipIntro();
  window.addEventListener('keydown', onAnySkipKey);
  window.addEventListener('touchstart', onAnySkipKey, { passive: true });

  camera.position.copy(camTarget);
  camera.lookAt(lookTarget);

  // --- Zoe's sparkle trail --------------------------------------------------
  const TRAIL_N = 24, TRAIL_LIFE = 0.8, TRAIL_EVERY = 0.05;
  const trailPos = new Float32Array(TRAIL_N * 3);
  const trailCol = new Float32Array(TRAIL_N * 3);
  const trailBase = new Float32Array(TRAIL_N * 3);
  const trailAge = new Float32Array(TRAIL_N).fill(TRAIL_LIFE);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
  const sparkleTrailPoints = new THREE.Points(trailGeo, new THREE.PointsMaterial({
    map: softDot, size: 0.7, sizeAttenuation: true, vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparkleTrailPoints.frustumCulled = false;
  sparkleTrailPoints.visible = false;
  scene.add(sparkleTrailPoints);
  const trailPink = new THREE.Color(0xff6fb8), trailGold = new THREE.Color(0xffc24d);
  let trailNext = 0, trailTimer = 0;
  let trailRainbow = false;
  const trailTmp = new THREE.Color();
  function sparkleTrail(dt, speed) {
    if (calmMotion) return;
    if (speed > 0.6) {
      trailTimer += dt;
      while (trailTimer >= TRAIL_EVERY) {
        trailTimer -= TRAIL_EVERY;
        const i = trailNext; trailNext = (trailNext + 1) % TRAIL_N;
        trailAge[i] = 0;
        trailPos[i * 3] = playerPos.x + (rand() - 0.5) * 0.45;
        trailPos[i * 3 + 1] = playerPos.y + 0.16;
        trailPos[i * 3 + 2] = playerPos.z + (rand() - 0.5) * 0.45;
        const m = rand();
        if (trailRainbow) {
          trailTmp.setHSL(rand(), 0.85, 0.68);
          trailBase[i * 3] = trailTmp.r; trailBase[i * 3 + 1] = trailTmp.g; trailBase[i * 3 + 2] = trailTmp.b;
        } else {
          trailBase[i * 3] = trailPink.r + (trailGold.r - trailPink.r) * m;
          trailBase[i * 3 + 1] = trailPink.g + (trailGold.g - trailPink.g) * m;
          trailBase[i * 3 + 2] = trailPink.b + (trailGold.b - trailPink.b) * m;
        }
      }
    } else {
      trailTimer = 0;
    }
    let alive = false;
    for (let i = 0; i < TRAIL_N; i++) {
      if (trailAge[i] >= TRAIL_LIFE) { trailCol[i * 3] = trailCol[i * 3 + 1] = trailCol[i * 3 + 2] = 0; continue; }
      trailAge[i] += dt;
      const k = Math.max(0, 1 - trailAge[i] / TRAIL_LIFE) * 0.85;
      trailPos[i * 3 + 1] += dt * 0.25;
      trailCol[i * 3] = trailBase[i * 3] * k;
      trailCol[i * 3 + 1] = trailBase[i * 3 + 1] * k;
      trailCol[i * 3 + 2] = trailBase[i * 3 + 2] * k;
      alive = true;
    }
    sparkleTrailPoints.visible = alive;
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.color.needsUpdate = true;
  }

  // --- Wardrobe: outfit recolors + butterfly friend -------------------------
  const dressDefault = playerDressMat.color.getHex();
  const gemDefault = playerGemMat ? playerGemMat.color.getHex() : 0;
  let buddy = null;
  const buddyPos = new THREE.Vector3();
  const buddyTarget = new THREE.Vector3();
  function makeBuddy() {
    if (!butterflyAssets) return null;
    const g = new THREE.Group();
    const wl = new THREE.Group(), wr = new THREE.Group();
    const wm = butterflyAssets.wingMat.clone();
    wm.forceSinglePass = true;
    const ml = new THREE.Mesh(butterflyAssets.wingGeo, wm);
    const mr = new THREE.Mesh(butterflyAssets.wingGeo, wm);
    ml.scale.x = -1;
    ml.raycast = mr.raycast = () => {};
    wl.add(ml); wr.add(mr);
    g.add(wl, wr);
    g.scale.setScalar(1.4);
    g.visible = false;
    scene.add(g);
    return { g, wl, wr };
  }
  let buddySnap = true;
  function buddyUpdate(dt, t) {
    if (!buddy || !buddy.g.visible) return;
    const yaw = player.rotation.y, sy = Math.sin(yaw), cy = Math.cos(yaw);
    let a;
    if (calmMotion) {
      const k = PRINCESS_SCALE;
      buddyTarget.set(playerPos.x + (0.55 * cy) * k, 1.95 * k + player.position.y, playerPos.z - (0.55 * sy) * k);
      buddyPos.copy(buddyTarget);
      a = 0.55;
    } else {
      const bob = Math.sin(t * 2.3) * 0.18;
      buddyTarget.set(playerPos.x - sy * 1.6 + cy * 0.8, playerPos.y + 2.9 + bob, playerPos.z - cy * 1.6 - sy * 0.8);
      if (buddySnap) buddyPos.copy(buddyTarget);
      else buddyPos.lerp(buddyTarget, 1 - Math.exp(-2.6 * dt));
      a = 0.35 + Math.sin(t * 9) * 0.8;
    }
    buddySnap = false;
    buddy.g.position.copy(buddyPos);
    buddy.g.rotation.y = yaw;
    buddy.wl.rotation.z = a; buddy.wr.rotation.z = -a;
  }
  function setOutfit(o) {
    o = o || {};
    const pick = (slot) => OUTFIT[slot].choices.find((c) => c.id === o[slot]) || OUTFIT[slot].choices[0];
    const tr = pick('trail');
    trailRainbow = !!tr.rainbow;
    if (tr.trail) { trailPink.set(tr.trail[0]); trailGold.set(tr.trail[1]); }
    if (playerGemMat) {
      const gm = o.gem ? pick('gem') : null;
      if (gm) { playerGemMat.color.setHex(gm.color); playerGemMat.emissive.setHex(gm.color).multiplyScalar(0.55); }
      else { playerGemMat.color.setHex(gemDefault); playerGemMat.emissive.setHex(0xff4f90); }
    }
    playerDressMat.color.setHex(o.skirt ? pick('skirt').color : dressDefault);
    if (o.buddy && !buddy) buddy = makeBuddy();
    if (buddy) {
      if (o.buddy && !buddy.g.visible) buddySnap = true;
      buddy.g.visible = !!o.buddy;
    }
  }

  // --- Celebration bursts ---------------------------------------------------
  const bursts = [];
  function celebrate(landId) {
    const def = NPC_ORDER.find((id) => NPC_DEFS[id].land === landId);
    if (!def) return;
    const npc = npcs[def];
    const origin = npc.star.position.clone();
    const COUNT = 90;
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = origin.x; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z;
      const a = Math.random() * Math.PI * 2;
      const sp = 2.5 + Math.random() * 4;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = 3 + Math.random() * 4;
      vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: GOLD, size: 0.35, transparent: true, opacity: 1, map: softDot, depthWrite: false,
    });
    const points = new THREE.Points(geo, mat);
    scene.add(points);
    bursts.push({ points, vel, life: 0, maxLife: 3 });
    npc.hopT = 0;
  }

  // --- NPC state ------------------------------------------------------------
  const stillStars = calmMotion;
  const PULSE_WHITE = new THREE.Color(0xffffff);
  function setNPCState(npcId, state) {
    const npc = npcs[npcId];
    if (!npc) return;
    npc.state = state === 'done' ? 'done' : 'available';
    if (npc.state === 'done') {
      npc.starMat.color.set(GOLD);
      npc.pad.material.color.set(0xffffff);
      npc.pad.material.opacity = 0.75;
    } else {
      npc.starMat.color.set(GOLD);
      npc.pad.material.color.set(npc.def.accent);
      npc.pad.material.opacity = 0.55;
    }
  }

  let nearNPC = null;

  // --- Gentle 3D Guidance Arrow & Prominent Destination Beacon (highlights Belle / next princess) ---
  let guideTargetId = null;
  const guideGroup = new THREE.Group();
  const guideMat = new THREE.MeshStandardMaterial({
    color: 0xffe04d,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.05,
    roughness: 0.22,
    metalness: 0.3,
  });
  const guideArrow = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.88, 6), guideMat);
  guideArrow.rotation.x = Math.PI / 2; // point along +Z
  guideArrow.position.set(0, 0, 1.9);
  guideArrow.raycast = () => {};
  guideGroup.add(guideArrow);

  const guideDots = [];
  const guideDotGeo = new THREE.SphereGeometry(0.13, 8, 6);
  for (let i = 0; i < 3; i++) {
    const dot = new THREE.Mesh(guideDotGeo, guideMat);
    dot.position.set(0, 0, 2.65 + i * 0.68);
    dot.scale.setScalar(1 - i * 0.2);
    dot.raycast = () => {};
    guideGroup.add(dot);
    guideDots.push(dot);
  }
  guideGroup.visible = false;
  scene.add(guideGroup);

  // Elevated golden beacon over the guided destination princess so she stands out across the kingdom
  const destBeacon = new THREE.Group();
  const beaconBeamMat = new THREE.MeshBasicMaterial({
    color: 0xffe066,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.82, 1.35, 11.5, 16, 1, true),
    beaconBeamMat
  );
  beaconBeam.position.y = 5.75;
  beaconBeam.raycast = () => {};
  destBeacon.add(beaconBeam);

  const beaconRingMat = new THREE.MeshBasicMaterial({
    color: 0xffd43b,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconInnerRing = new THREE.Mesh(new THREE.RingGeometry(1.48, 1.88, 32), beaconRingMat);
  beaconInnerRing.rotation.x = -Math.PI / 2;
  beaconInnerRing.position.y = 0.08;
  beaconInnerRing.renderOrder = 2;
  beaconInnerRing.raycast = () => {};
  destBeacon.add(beaconInnerRing);

  const beaconOuterRingMat = new THREE.MeshBasicMaterial({
    color: 0xfff3a8,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beaconOuterRing = new THREE.Mesh(new THREE.RingGeometry(2.12, 2.38, 32), beaconOuterRingMat);
  beaconOuterRing.rotation.x = -Math.PI / 2;
  beaconOuterRing.position.y = 0.075;
  beaconOuterRing.renderOrder = 2;
  beaconOuterRing.raycast = () => {};
  destBeacon.add(beaconOuterRing);

  const beaconCrest = new THREE.Mesh(
    starGeometry(0.96, 0.42),
    new THREE.MeshStandardMaterial({
      color: 0xfff3a8,
      emissive: 0xffb800,
      emissiveIntensity: 1.5,
      roughness: 0.2,
      metalness: 0.25,
      side: THREE.DoubleSide,
    })
  );
  beaconCrest.position.y = 7.4;
  beaconCrest.raycast = () => {};
  destBeacon.add(beaconCrest);

  destBeacon.visible = false;
  scene.add(destBeacon);

  function setGuideTarget(npcId) {
    guideTargetId = npcId && npcs[npcId] ? npcId : null;
  }

  function stepAwayFromNPC(npcId) {
    const npc = npcId && npcs[npcId] ? npcs[npcId] : null;
    if (!npc) {
      Input.clearInteract(500);
      return;
    }
    const gx = npc.group.position.x;
    const gz = npc.group.position.z;
    let dx = playerPos.x - gx;
    let dz = playerPos.z - gz;
    let d = Math.hypot(dx, dz);
    if (d < 0.25) {
      dx = -gx;
      dz = -gz;
      d = Math.hypot(dx, dz) || 1;
    }
    const baseAngle = Math.atan2(dz, dx);
    const stepDist = NPC_INTERACT_DIST + 1.35;
    const offsets = [0, 0.45, -0.45, 0.9, -0.9, 1.45, -1.45, Math.PI];

    const spotClear = (cx, cz) => {
      if (Math.hypot(cx, cz) > WORLD_RADIUS - 1) return false;
      for (const col of colliders) {
        if (Math.hypot(cx - col.x, cz - col.z) < col.r + 0.65) return false;
      }
      for (const other of Object.values(npcs)) {
        if (Math.hypot(cx - other.group.position.x, cz - other.group.position.z) < NPC_INTERACT_DIST + 0.4) {
          return false;
        }
      }
      return true;
    };

    let targetX = gx + Math.cos(baseAngle) * stepDist;
    let targetZ = gz + Math.sin(baseAngle) * stepDist;
    for (const off of offsets) {
      const a = baseAngle + off;
      const cx = gx + Math.cos(a) * stepDist;
      const cz = gz + Math.sin(a) * stepDist;
      if (spotClear(cx, cz)) {
        targetX = cx;
        targetZ = cz;
        break;
      }
    }

    const r = Math.hypot(targetX, targetZ);
    if (r > WORLD_RADIUS - 0.5) {
      targetX *= (WORLD_RADIUS - 0.5) / r;
      targetZ *= (WORLD_RADIUS - 0.5) / r;
    }

    const gy = Math.max(-0.26, walkHeightAt(targetX, targetZ));
    playerPos.set(targetX, gy, targetZ);
    playerVel.set(0, 0, 0);
    playerAngle = Math.atan2(targetX - gx, targetZ - gz);
    player.rotation.y = playerAngle;
    playerShadow.position.set(targetX, gy + 0.045, targetZ);
    playerRing.position.set(targetX, gy + 0.055, targetZ);

    if (nearNPC !== null) {
      nearNPC = null;
      onNearNPC(null);
    }
    Input.clearInteract(550);
  }

  function getNearestUnvisited(doneIds) {
    const doneSet = new Set(Array.isArray(doneIds) ? doneIds : []);
    let bestId = null;
    let bestD = Infinity;
    for (const id of NPC_ORDER) {
      if (doneSet.has(id) || !npcs[id]) continue;
      const g = npcs[id].group.position;
      const d = Math.hypot(g.x - playerPos.x, g.z - playerPos.z);
      if (d < bestD) {
        bestD = d;
        bestId = id;
      }
    }
    return bestId;
  }

  // --- Resize ---------------------------------------------------------------
  const onResize = () => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / Math.max(1, h);
    frameForAspect(camera.aspect);
    env.resize(w, h);
    if (worldPaused) renderScene();
  };
  window.addEventListener('resize', onResize);
  onResize();
  camTarget.copy(playerPos).add(camOffset);
  camera.position.copy(camTarget);
  camera.lookAt(lookTarget);

  // --- Main loop & auto quality scaling -------------------------------------
  const clock = new THREE.Clock();
  const tmpMove = new THREE.Vector2();
  const tmpTargetVel = new THREE.Vector3();
  let rafId = 0;
  let padPollTimer = 0;
  let disposed = false;
  let simTime = 0;

  const qualityCtrl = createQualityController({
    isSoftwareGl,
    onTierChange(tier) {
      env.setQualityTier(tier);
      worldLife.setTier(tier);
    },
  });
  const restartMeasure = () => qualityCtrl.reset();
  document.addEventListener('visibilitychange', restartMeasure);

  function update(dt, t) {
    if (pondTwinkle) pondTwinkle(t);

    // ---- Atmosphere & Sky cycle ----
    const duskFactor = env.updateAtmosphere(t, playerPos, calmMotion);
    terrain.update(t, calmMotion, duskFactor);
    castleSys.update(t, calmMotion, duskFactor);
    worldLife.update(dt, t, calmMotion, duskFactor);

    for (let i = 0; i < duskWindows.length; i++) {
      duskWindows[i].emissiveIntensity = 1.25 + duskFactor * 1.15;
    }

    // ---- Unified input ----
    Input.poll();
    const iv = Input.vector;
    tmpMove.set(iv.x, iv.z);
    if (tmpMove.lengthSq() > 1) {
      tmpMove.normalize();
    }
    if (introActive && tmpMove.lengthSq() > 0.02) {
      skipIntro();
    }

    const moving = inputEnabled && !introActive && tmpMove.lengthSq() > 0.0004;
    if (moving) tmpTargetVel.set(tmpMove.x * PLAYER_SPEED, 0, tmpMove.y * PLAYER_SPEED);
    else tmpTargetVel.set(0, 0, 0);
    playerVel.lerp(tmpTargetVel, 1 - Math.pow(0.0001, dt));

    playerPos.x += playerVel.x * dt;
    playerPos.z += playerVel.z * dt;

    for (const col of colliders) {
      const dx = playerPos.x - col.x, dz = playerPos.z - col.z;
      const d = Math.hypot(dx, dz);
      const minD = col.r + 0.55;
      if (d < minD && d > 0.0001) {
        playerPos.x = col.x + (dx / d) * minD;
        playerPos.z = col.z + (dz / d) * minD;
      }
    }
    const r = Math.hypot(playerPos.x, playerPos.z);
    if (r > WORLD_RADIUS) {
      playerPos.x *= WORLD_RADIUS / r;
      playerPos.z *= WORLD_RADIUS / r;
    }

    // Ground Zoe cleanly on terrain & bridges (gentle ankle-deep floor in riverbed)
    const groundY = Math.max(-0.26, walkHeightAt(playerPos.x, playerPos.z));

    const speed = playerVel.length();
    if (speed > 0.6) {
      playerAngle = Math.atan2(playerVel.x, playerVel.z);
      walkPhase += dt * 11;
    }
    if (focusNpc) {
      playerAngle = Math.atan2(focusNpc.group.position.x - playerPos.x, focusNpc.group.position.z - playerPos.z);
    }
    player.rotation.y += angleDelta(player.rotation.y, playerAngle) * (1 - Math.exp(-12 * dt));
    playerPos.y = groundY + (speed > 0.6 ? Math.abs(Math.sin(walkPhase)) * 0.09 : 0);
    playerShadow.position.set(playerPos.x, groundY + 0.045, playerPos.z);
    playerRing.position.set(playerPos.x, groundY + 0.055, playerPos.z);
    sparkleTrail(dt, speed);
    buddyUpdate(dt, t);

    // ---- Camera: smooth tilted follow OR first-load sweeping castle intro ----
    lookAhead.set(playerVel.x * 0.35, 0, playerVel.z * 0.35);
    desiredCam.set(playerPos.x + camOffset.x, groundY + camOffset.y, playerPos.z + camOffset.z);
    desiredLook.set(playerPos.x + lookAhead.x, groundY + 1.15, playerPos.z + lookAhead.z);

    // Smooth proximity framing: when Zoe walks up close to a princess, gently shift
    // laterally so Zoe's head never blocks the princess from the south camera angle.
    const activeNear = !focusNpc && nearNPC && npcs[nearNPC] ? npcs[nearNPC] : null;
    const nearGoal = activeNear ? 1 : 0;
    nearCamW = calmMotion
      ? nearGoal
      : nearCamW + (nearGoal - nearCamW) * (1 - Math.exp(-(activeNear ? 4.0 : 6.0) * dt));
    if (activeNear) {
      const gx = activeNear.group.position.x;
      const gz = activeNear.group.position.z;
      lastNearSide = playerPos.x >= gx ? 1 : -1;
      nearMid.set((playerPos.x + gx) * 0.5, groundY + 1.35, (playerPos.z + gz) * 0.5 + 0.4);
      lastNearMid.copy(nearMid);
    }
    if (nearCamW > 0.001) {
      const eNear = nearCamW * nearCamW * (3 - 2 * nearCamW);
      const mNear = activeNear ? nearMid : lastNearMid;
      desiredLook.lerp(mNear, eNear * 0.75);
      nearCamTmp.set(
        mNear.x + camOffset.x + lastNearSide * 3.3,
        groundY + camOffset.y * 0.96,
        mNear.z + camOffset.z * 0.94
      );
      desiredCam.lerp(nearCamTmp, eNear * 0.85);
    }

    const focusGoal = focusNpc ? 1 : 0;
    focusW = calmMotion ? focusGoal : focusW + (focusGoal - focusW) * (1 - Math.exp(-(focusNpc ? 4.5 : 8) * dt));
    if (focusNpc) {
      const side = playerPos.x >= focusNpc.group.position.x ? 1 : -1;
      lastNearSide = side;
      focusMid.set(
        (playerPos.x + focusNpc.group.position.x) / 2,
        groundY + 1.15,
        (playerPos.z + focusNpc.group.position.z) / 2 + FOCUS_DROP
      );
    }
    if (focusW > 0.001) {
      const e = focusW * focusW * (3 - 2 * focusW);
      const m = focusNpc ? focusMid : lastFocusMid;
      if (focusNpc) lastFocusMid.copy(focusMid);
      desiredLook.lerp(m, e);
      focusCamTmp.set(
        m.x + camOffset.x * FOCUS_ZOOM + lastNearSide * 2.4,
        m.y + camOffset.y * FOCUS_ZOOM,
        m.z + camOffset.z * FOCUS_ZOOM
      );
      desiredCam.lerp(focusCamTmp, e);
    }

    if (introActive) {
      introT += dt;
      const u = Math.min(1, introT / INTRO_DUR);
      const s = u * u * (3 - 2 * u);
      if (s < 0.5) {
        const k = s * 2;
        introCam.copy(introP0).lerp(introP1, k);
        introLook.copy(introLook0).lerp(introLook1, k * 0.8);
      } else {
        const k = (s - 0.5) * 2;
        const kSmooth = k * k * (3 - 2 * k);
        introCam.copy(introP1).lerp(introP2, Math.min(1, k * 1.2)).lerp(desiredCam, kSmooth);
        introLook.copy(introLook1).lerp(desiredLook, kSmooth);
      }
      camTarget.copy(introCam);
      lookTarget.copy(introLook);
      if (u >= 1) introActive = false;
    } else {
      if (camSnap) {
        camSnap = false;
        camTarget.copy(desiredCam);
        lookTarget.copy(desiredLook);
      }
      camTarget.lerp(desiredCam, 1 - Math.pow(0.001, dt));
      lookTarget.lerp(desiredLook, 1 - Math.pow(0.0005, dt));
    }

    camera.position.copy(camTarget);
    camera.lookAt(lookTarget);
    skyMesh.position.copy(camera.position);

    // ---- NPCs ----
    for (const npc of Object.values(npcs)) {
      npc.star.position.y = npc.baseY + 3.1 * PRINCESS_SCALE + Math.sin(t * 2 + npc.hue * 6) * 0.22;
      npc.star.rotation.y = t * 1.2;
      if (npc.state === 'done' && !stillStars) {
        const breath = 0.5 + 0.5 * Math.sin(t * Math.PI / 2);
        npc.starMat.color.set(GOLD).lerp(PULSE_WHITE, breath * 0.18);
      }
      const near = Math.hypot(playerPos.x - npc.group.position.x, playerPos.z - npc.group.position.z) < NPC_INTERACT_DIST;
      const yaw = near || npc === focusNpc
        ? Math.atan2(playerPos.x - npc.group.position.x, playerPos.z - npc.group.position.z)
        : npc.baseYaw;
      npc.group.rotation.y += angleDelta(npc.group.rotation.y, yaw) * (calmMotion ? 1 : 1 - Math.exp(-5 * dt));
      npc.group.rotation.z = calmMotion ? 0 : Math.sin(t * 1.8 + npc.swayPhase) * 0.03;
      if (npc.state !== 'done') {
        npc.padGlow += ((near ? 1 : 0) - npc.padGlow) * (1 - Math.exp(-6 * dt));
        npc.pad.material.opacity = 0.55 + npc.padGlow * 0.25;
      }
      if (npc.hopT >= 0) {
        npc.hopT += dt;
        const k = npc.hopT;
        npc.group.position.y = npc.baseY + (k < 1.2 ? Math.abs(Math.sin(k * 8)) * 0.5 * (1 - k / 1.4) : 0);
        if (k >= 1.4) { npc.hopT = -1; npc.group.position.y = npc.baseY; }
      }
    }

    if (todayStar.visible && todayTarget) {
      const g = todayTarget.group.position;
      todayStar.position.set(g.x, todayTarget.baseY + 3.1 * PRINCESS_SCALE + 1.5 + (calmMotion ? 0 : Math.sin(t * 1.4) * 0.18), g.z);
      if (!calmMotion) todayStar.rotation.y = t * 0.8;
    }

    // ---- Gentle 3D Guidance Arrow & Prominent Destination Beacon ----
    const guideNpc = !focusNpc && !introActive && guideTargetId ? npcs[guideTargetId] : null;
    if (guideNpc) {
      const gx = guideNpc.group.position.x - playerPos.x;
      const gz = guideNpc.group.position.z - playerPos.z;
      const gd = Math.hypot(gx, gz);
      if (gd > NPC_INTERACT_DIST + 1.2) {
        guideGroup.visible = true;
        const bob = calmMotion ? 0 : Math.sin(t * 3.0) * 0.1;
        guideGroup.position.set(playerPos.x, groundY + 0.58 + bob, playerPos.z);
        guideGroup.rotation.y = Math.atan2(gx, gz);
        for (let i = 0; i < guideDots.length; i++) {
          const pulse = calmMotion ? 0 : Math.sin(t * 4.2 - i * 0.9) * 0.08;
          guideDots[i].position.y = pulse;
        }
      } else {
        guideGroup.visible = false;
      }

      // Position destination beacon on the guided princess (stands out cleanly across hills/trees)
      destBeacon.visible = true;
      destBeacon.position.set(guideNpc.group.position.x, guideNpc.baseY, guideNpc.group.position.z);
      const crestBob = calmMotion ? 0 : Math.sin(t * 2.4) * 0.35;
      beaconCrest.position.y = 7.4 + crestBob;
      if (!calmMotion) {
        beaconCrest.rotation.y = t * 1.1;
        const ringBreath = 1 + Math.sin(t * 2.6) * 0.06;
        beaconOuterRing.scale.setScalar(ringBreath);
        beaconBeamMat.opacity = 0.18 + Math.sin(t * 2.0) * 0.05;
      } else {
        beaconOuterRing.scale.setScalar(1);
        beaconBeamMat.opacity = 0.2;
      }
    } else {
      guideGroup.visible = false;
      destBeacon.visible = false;
    }

    if (snowPoints) {
      const p = snowPoints.geometry.attributes.position;
      const c = snowPoints.userData.center;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 1.6;
        let x = p.getX(i) + Math.sin(t * 1.5 + i) * dt * 0.6;
        if (y < 0) y = 12;
        if (x < c.x - 12) x = c.x + 12; else if (x > c.x + 12) x = c.x - 12;
        p.setY(i, y); p.setX(i, x);
      }
      p.needsUpdate = true;
    }

    if (iceCrystals && !calmMotion) iceCrystals.userData.set(t);
    if (meadowSway && !calmMotion) meadowSway.userData.set(t);

    for (let i = 0; i < tapItems.length; i++) if (tapItems[i].t >= 0) tapReact(tapItems[i], dt);
    if (cove) cove.update(t, dt);
    if (isle) isle.update(t, dt);
    if (garden) garden.update(t, dt);
    if (harbor) harbor.update(t, dt);
    if (bayou) bayou.update(t, dt);
    updateTreasures(dt, t);
    updateGates(dt, t);

    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life += dt;
      const p = b.points.geometry.attributes.position;
      for (let j = 0; j < p.count; j++) {
        p.setX(j, p.getX(j) + b.vel[j * 3] * dt);
        p.setY(j, p.getY(j) + b.vel[j * 3 + 1] * dt);
        p.setZ(j, p.getZ(j) + b.vel[j * 3 + 2] * dt);
        b.vel[j * 3 + 1] -= 6 * dt;
      }
      p.needsUpdate = true;
      b.points.material.opacity = Math.max(0, 1 - b.life / b.maxLife);
      if (b.life >= b.maxLife) {
        scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }

    let nearest = null;
    let nearestD = NPC_INTERACT_DIST;
    for (const npc of Object.values(npcs)) {
      const d = Math.hypot(playerPos.x - npc.group.position.x, playerPos.z - npc.group.position.z);
      if (d < nearestD) { nearestD = d; nearest = npc.id; }
    }
    if (nearest !== nearNPC) {
      nearNPC = nearest;
      onNearNPC(nearNPC);
    }

    const didInteract = Input.consumeInteract();
    const didPause = Input.consumePause();
    if (didInteract && introActive) skipIntro();
    else if (inputEnabled && didInteract && nearNPC) onInteractRequest(nearNPC);
    if (didPause) onPauseRequest();
  }

  let softPauseTimer = 0;
  function loop(now) {
    if (disposed || worldPaused) return;
    if (!isSoftwareGl) rafId = requestAnimationFrame(loop);

    const dt = Math.min(clock.getDelta(), 0.05);
    simTime += dt;
    update(dt, simTime);
    renderScene();
    qualityCtrl.measure(typeof now === 'number' ? now : performance.now());

    if (isSoftwareGl && !disposed && !worldPaused) {
      softPauseTimer = setTimeout(() => {
        if (!disposed && !worldPaused) rafId = requestAnimationFrame(loop);
      }, 80);
    }
  }
  loop();

  function pauseRendering() {
    if (disposed || worldPaused) return;
    worldPaused = true;
    cancelAnimationFrame(rafId);
    clearTimeout(softPauseTimer);
    padPollTimer = setInterval(() => {
      Input.poll();
      if (Input.consumePause()) onPauseRequest();
    }, 150);
  }
  function resumeRendering() {
    if (disposed || !worldPaused) return;
    worldPaused = false;
    clearInterval(padPollTimer);
    clock.getDelta();
    Input.consumeInteract(); Input.consumePause();
    restartMeasure();
    update(0, simTime);
    renderScene();
    rafId = requestAnimationFrame(loop);
  }

  function dispose() {
    disposed = true;
    cancelAnimationFrame(rafId);
    clearTimeout(softPauseTimer);
    clearInterval(padPollTimer);
    document.removeEventListener('visibilitychange', restartMeasure);
    window.removeEventListener('keydown', onAnySkipKey);
    window.removeEventListener('touchstart', onAnySkipKey);
    Input.dispose();
    window.removeEventListener('resize', onResize);
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    gateHits.length = 0; tappables.length = 0; tapItems.length = 0; treasureList.length = 0; treasureHits.length = 0;
    worldLife.dispose();
    env.dispose();
    scene.traverse((o) => {
      if (o.geometry && !Object.values(_geo).includes(o.geometry)) o.geometry.dispose();
      if (o.material && !Object.values(_mat).includes(o.material)) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map) m.map.dispose();
          m.dispose();
        });
      }
    });
    renderer.dispose();
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return {
    setInputEnabled(bool) {
      inputEnabled = !!bool;
      if (inputEnabled && !introPlayed && !calmMotion) {
        introPlayed = true;
        introActive = true;
        introT = 0;
      }
    },
    setCastleCrown(visible) { castleCrown.visible = !!visible; },
    focus(npcId) { if (npcs[npcId]) { skipIntro(); focusNpc = npcs[npcId]; camSnap = calmMotion; } },
    unfocus() { if (focusNpc) { focusNpc = null; camSnap = calmMotion; } },
    celebrate,
    setNPCState,
    setOutfit,
    setTodayStar,
    setClockTime,
    setGuideTarget,
    stepAwayFromNPC,
    getNearestUnvisited,
    pause: pauseRendering,
    resume: resumeRendering,
    isPaused() { return worldPaused; },
    getPixelRatio() { return renderer.getPixelRatio(); },
    dispose,
  };
}
