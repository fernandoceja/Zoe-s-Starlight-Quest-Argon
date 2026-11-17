// ============================================================================
// Zoe's Starlight Quest — Sparkly Storybook Princess Castle on Castle Hill
// Purely visual module: multi-tower pastel castle with arched glowing windows,
// gilded double doors, curved front staircase descending toward the plaza,
// fluttering pastel banners, orbiting starlight sparkles, and 10-point Crown.
// ============================================================================

import * as THREE from 'three';
import { CASTLE_POS } from './worldmap.js';
import { groundHeightAt } from './world_terrain.js';

export function buildCastle({ scene, starGeometry, softDot }) {
  const castleY = groundHeightAt(CASTLE_POS.x, CASTLE_POS.z);
  const group = new THREE.Group();
  group.position.set(CASTLE_POS.x, castleY, CASTLE_POS.z);
  // Turn gently toward the plaza center (0, 0) while keeping the front facade readable from camera
  group.rotation.y = 0.28;

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xffd0e3,
    roughness: 0.78,
    metalness: 0.02,
    flatShading: true,
  });
  const trimStoneMat = new THREE.MeshStandardMaterial({
    color: 0xe6d4f0,
    roughness: 0.82,
    flatShading: true,
  });
  const roofPinkMat = new THREE.MeshStandardMaterial({
    color: 0xff7eb9,
    roughness: 0.52,
    metalness: 0.05,
    flatShading: true,
  });
  const roofLilacMat = new THREE.MeshStandardMaterial({
    color: 0xb78ef4,
    roughness: 0.52,
    metalness: 0.05,
    flatShading: true,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf5cd62,
    roughness: 0.28,
    metalness: 0.65,
    emissive: 0x805b10,
    emissiveIntensity: 0.45,
  });
  const winGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c2,
    emissive: 0xffc864,
    emissiveIntensity: 1.55,
    roughness: 0.22,
  });
  const roseGlowMat = new THREE.MeshStandardMaterial({
    color: 0xffd6ec,
    emissive: 0xff8bc4,
    emissiveIntensity: 1.35,
    roughness: 0.25,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0xf3c65e,
    roughness: 0.34,
    metalness: 0.55,
    emissive: 0x6b470c,
    emissiveIntensity: 0.28,
  });
  const stepMat = new THREE.MeshStandardMaterial({
    color: 0xebd1ab,
    roughness: 0.8,
    flatShading: true,
  });
  const flagPinkMat = new THREE.MeshStandardMaterial({
    color: 0xff8fc1,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });
  const flagMintMat = new THREE.MeshStandardMaterial({
    color: 0x9de6d0,
    roughness: 0.65,
    side: THREE.DoubleSide,
  });

  const add = (mesh, x, y, z, shadow = true) => {
    mesh.position.set(x, y, z);
    if (shadow) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    group.add(mesh);
    return mesh;
  };

  // Sculpted stone terrace plinth hugging Castle Hill smoothly
  add(new THREE.Mesh(new THREE.CylinderGeometry(5.3, 5.9, 1.1, 20), trimStoneMat), 0, -0.45, -0.6);
  add(new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.2, 0.24, 20), stepMat), 0, 0.12, -0.6);

  // Grand curved cobblestone steps descending down front terrace toward plaza
  for (let i = 0; i < 6; i++) {
    const stepW = 2.6 + i * 0.28;
    const stepY = 0.04 - i * 0.34;
    const stepZ = 3.25 + i * 0.7;
    const st = add(new THREE.Mesh(new THREE.BoxGeometry(stepW, 0.36, 0.78), stepMat), 0, stepY, stepZ);
    st.receiveShadow = true;
  }
  // Step side balustrades with glowing lantern orbs at the foot
  const halos = [];
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.9, 4.2), trimStoneMat), sx * 1.95, -0.65, 4.8).rotation.x = 0.44;
    const post = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 1.35, 8), trimStoneMat), sx * 2.15, -1.25, 6.75);
    post.castShadow = true;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), winGlowMat);
    bulb.position.set(sx * 2.15, -0.42, 6.75);
    group.add(bulb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot, color: 0xffdf96, transparent: true, opacity: 0.48, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.position.set(sx * 2.15, -0.42, 6.75);
    halo.scale.setScalar(1.45);
    halo.raycast = () => {};
    group.add(halo);
    halos.push(halo);
  }

  // Main Keep body & scalloped battlements
  add(new THREE.Mesh(new THREE.BoxGeometry(5.4, 4.4, 3.6), stoneMat), 0, 2.4, -1.1);
  add(new THREE.Mesh(new THREE.BoxGeometry(5.7, 0.42, 3.9), trimStoneMat), 0, 4.7, -1.1);
  // Central tall keep spire
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 3.4, 12), stoneMat), 0, 5.95, -1.2);
  add(new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.14, 8, 20), goldMat), 0, 7.62, -1.2).rotation.x = Math.PI / 2;
  add(new THREE.Mesh(new THREE.ConeGeometry(1.98, 2.8, 12), roofPinkMat), 0, 9.02, -1.2);

  // Two inner high spires flanking the keep
  for (const sx of [-1, 1]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.12, 6.2, 12), stoneMat), sx * 2.25, 3.25, -2.25);
    add(new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.11, 7, 16), goldMat), sx * 2.25, 6.32, -2.25).rotation.x = Math.PI / 2;
    add(new THREE.Mesh(new THREE.ConeGeometry(1.42, 2.4, 12), roofLilacMat), sx * 2.25, 7.52, -2.25);
  }

  // Four outer rounded corner towers with gold cornices, stained glass windows & finials
  const cornerTowers = [
    { x: -3.55, z: 0.65, h: 4.9, roof: roofPinkMat },
    { x: 3.55, z: 0.65, h: 4.9, roof: roofPinkMat },
    { x: -3.2, z: -2.85, h: 5.4, roof: roofLilacMat },
    { x: 3.2, z: -2.85, h: 5.4, roof: roofLilacMat },
  ];
  const winGeo = new THREE.CapsuleGeometry(0.24, 0.52, 4, 8);
  const frameGeo = new THREE.CapsuleGeometry(0.3, 0.58, 4, 8);
  const banners = [];
  const starFinialGeo = starGeometry(0.36, 0.15);

  cornerTowers.forEach((tw, idx) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(1.22, 1.42, tw.h, 12), stoneMat), tw.x, tw.h * 0.5 + 0.15, tw.z);
    add(new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.12, 7, 18), goldMat), tw.x, tw.h + 0.12, tw.z).rotation.x = Math.PI / 2;
    add(new THREE.Mesh(new THREE.ConeGeometry(1.72, 2.55, 12), tw.roof), tw.x, tw.h + 1.42, tw.z);
    // Gold finial orb + pole
    const fin = add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), goldMat), tw.x, tw.h + 2.75, tw.z, false);
    if (idx < 2) {
      // Fluttering front tower pennants
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.15, 6), goldMat), tw.x, tw.h + 3.25, tw.z, false);
      const bannerGeo = new THREE.PlaneGeometry(0.95, 0.42, 4, 1);
      bannerGeo.translate(0.48, 0, 0);
      const banner = new THREE.Mesh(bannerGeo, idx === 0 ? flagPinkMat : flagMintMat);
      banner.position.set(tw.x, tw.h + 3.55, tw.z);
      group.add(banner);
      banners.push({ mesh: banner, phase: idx * 2.1 });
    } else {
      const miniStar = new THREE.Mesh(starFinialGeo, goldMat);
      miniStar.position.set(tw.x, tw.h + 3.05, tw.z);
      group.add(miniStar);
    }

    // Glowing tower windows facing front & outward
    for (const wy of [2.5, 4.35]) {
      const ang = idx < 2 ? (idx === 0 ? 0.35 : -0.35) : (idx === 2 ? 2.4 : -2.4);
      const wx = tw.x + Math.sin(ang) * 1.24;
      const wz = tw.z + Math.cos(ang) * 1.24;
      const frm = new THREE.Mesh(frameGeo, goldMat);
      frm.position.set(wx, wy, wz);
      frm.rotation.y = ang;
      group.add(frm);
      const gl = new THREE.Mesh(winGeo, winGlowMat);
      gl.position.set(wx + Math.sin(ang) * 0.05, wy, wz + Math.cos(ang) * 0.05);
      gl.rotation.y = ang;
      group.add(gl);
    }
    void fin;
  });

  // Front Keep Gilded Arch Doorway + Rose Window + Warm Sconces
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.18, 1.18, 0.55, 16, 1, false, 0, Math.PI), goldMat), 0, 2.05, 0.65).rotation.z = Math.PI / 2;
  add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.05, 0.55), goldMat), 0, 1.15, 0.65);
  add(new THREE.Mesh(new THREE.BoxGeometry(1.65, 2.35, 0.62), doorMat), 0, 1.32, 0.68);
  // Arch top glow crescent & rose window above door
  const archGlow = new THREE.Mesh(new THREE.CircleGeometry(0.84, 16, 0, Math.PI), winGlowMat);
  archGlow.position.set(0, 2.35, 1.0);
  group.add(archGlow);
  const roseRing = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.09, 8, 20), goldMat);
  roseRing.position.set(0, 4.05, 0.74);
  group.add(roseRing);
  const roseGlass = new THREE.Mesh(new THREE.CircleGeometry(0.64, 18), roseGlowMat);
  roseGlass.position.set(0, 4.05, 0.75);
  group.add(roseGlass);

  // Two arched keep windows flanking the doorway
  for (const sx of [-1.85, 1.85]) {
    const frm = new THREE.Mesh(frameGeo, goldMat);
    frm.position.set(sx, 3.3, 0.72);
    group.add(frm);
    const gl = new THREE.Mesh(winGeo, winGlowMat);
    gl.position.set(sx, 3.3, 0.77);
    group.add(gl);
  }

  // Doorway warm glowing lantern sconces
  for (const sx of [-1.45, 1.45]) {
    const sconce = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), winGlowMat);
    sconce.position.set(sx, 2.05, 0.96);
    group.add(sconce);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: softDot, color: 0xffdc92, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    halo.position.set(sx, 2.05, 1.05);
    halo.scale.setScalar(1.3);
    halo.raycast = () => {};
    group.add(halo);
    halos.push(halo);
  }

  // Central Starlight Spire Marker (rotating star preserved for world.js)
  const starGeo = starGeometry(0.98, 0.42);
  const starMat = new THREE.MeshStandardMaterial({
    color: 0xffdf75,
    emissive: 0xffc63d,
    emissiveIntensity: 1.55,
    roughness: 0.25,
    side: THREE.DoubleSide,
  });
  const castleStar = new THREE.Mesh(starGeo, starMat);
  castleStar.position.set(0, 10.95, -1.2);
  group.add(castleStar);

  const spireHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softDot, color: 0xffe89c, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  spireHalo.position.set(0, 10.95, -1.2);
  spireHalo.scale.setScalar(2.9);
  spireHalo.raycast = () => {};
  group.add(spireHalo);
  halos.push(spireHalo);

  // Ten-point Starlight Crown restored on castle in 10-land finale
  const castleCrown = new THREE.Group();
  const crownGold = new THREE.MeshStandardMaterial({
    color: 0xffe16e, emissive: 0xffbe2e, emissiveIntensity: 1.45, roughness: 0.25, side: THREE.DoubleSide,
  });
  const crownBand = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 0.96, 0.38, 20, 1, true), crownGold);
  castleCrown.add(crownBand);
  const crownPoints = new THREE.InstancedMesh(new THREE.ConeGeometry(0.19, 0.72, 5), crownGold, 10);
  const crownGems = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.11, 6, 5),
    new THREE.MeshStandardMaterial({ color: 0xff94c4, emissive: 0xff64a6, emissiveIntensity: 1.25 }),
    10
  );
  const crownPart = new THREE.Object3D();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    const x = Math.cos(a), z = Math.sin(a);
    crownPart.position.set(x, 0.45, z);
    crownPart.updateMatrix();
    crownPoints.setMatrixAt(i, crownPart.matrix);
    crownPart.position.set(x * 1.08, 0.02, z * 1.08);
    crownPart.updateMatrix();
    crownGems.setMatrixAt(i, crownPart.matrix);
  }
  crownPoints.instanceMatrix.needsUpdate = true;
  crownGems.instanceMatrix.needsUpdate = true;
  castleCrown.add(crownPoints, crownGems);
  castleCrown.position.set(0, 11.45, -1.2);
  castleCrown.visible = false;
  group.add(castleCrown);

  // Sparkle aura orbiting around the castle spires
  const SPARK_N = 26;
  const sparkPos = new Float32Array(SPARK_N * 3);
  const sparkCol = new Float32Array(SPARK_N * 3);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkCol, 3));
  const sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({
    map: softDot, size: 0.62, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  sparkPoints.frustumCulled = false;
  group.add(sparkPoints);

  scene.add(group);

  function update(t, calmMotion, duskFactor) {
    castleStar.rotation.y = calmMotion ? 0.35 : t * 0.65;
    if (castleCrown.visible) castleCrown.rotation.y = calmMotion ? 0 : -t * 0.35;

    // Gentle window & lantern glow boost during golden dusk waves
    winGlowMat.emissiveIntensity = 1.4 + duskFactor * 1.25;
    roseGlowMat.emissiveIntensity = 1.25 + duskFactor * 1.1;
    const haloOp = 0.45 + duskFactor * 0.36;
    for (let i = 0; i < halos.length; i++) {
      halos[i].material.opacity = i === halos.length - 1 ? 0.56 + duskFactor * 0.3 : haloOp;
    }

    // Fluttering pastel banners
    for (let i = 0; i < banners.length; i++) {
      const b = banners[i];
      b.mesh.rotation.y = calmMotion ? 0.25 : 0.25 + Math.sin(t * 2.6 + b.phase) * 0.28;
    }

    // Orbiting sparkles around spires
    for (let i = 0; i < SPARK_N; i++) {
      const a = (calmMotion ? 0 : t * 0.42) + i * 0.48;
      const rad = 2.6 + (i % 4) * 1.05;
      const py = 5.4 + ((i * 1.7 + (calmMotion ? 0 : t * 0.45)) % 7.2);
      sparkPos[i * 3] = Math.cos(a) * rad;
      sparkPos[i * 3 + 1] = py;
      sparkPos[i * 3 + 2] = -1.2 + Math.sin(a) * rad;
      const tw = calmMotion ? 0.65 : (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.8 + i * 1.3)));
      const bri = tw * (0.78 + duskFactor * 0.38);
      sparkCol[i * 3] = bri;
      sparkCol[i * 3 + 1] = bri * 0.92;
      sparkCol[i * 3 + 2] = bri * (i % 2 ? 0.68 : 0.95);
    }
    sparkGeo.attributes.position.needsUpdate = true;
    sparkGeo.attributes.color.needsUpdate = true;
  }

  return {
    group,
    castleStar,
    castleCrown,
    update,
  };
}
