// ============================================================================
// Zoe's Starlight Quest — Atmospheric Environment, Sky, Lighting, Bloom & Quality
// Purely visual module: golden-afternoon-to-dusk pastel sky cycle, soft shadows,
// RoomEnvironment IBL, selective half-res bloom, and auto 3-tier quality scaling.
// ============================================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function detectSoftwareGl() {
  if (typeof document === 'undefined') return true;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch (e) {
    return false;
  }
}

export function createTextures(renderer) {
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);

  const makeCanvas = (size, draw, repeat = false, srgb = true) => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    draw(c.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = maxAniso;
    if (repeat) {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    }
    return tex;
  };

  // Soft radial glow sprite for lanterns, windows, sparkles, fireflies
  const softDot = makeCanvas(64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

  // Subtle pastel cobblestone texture for paths
  const cobbleTex = makeCanvas(256, (ctx, s) => {
    ctx.fillStyle = '#ead7b7';
    ctx.fillRect(0, 0, s, s);
    const stones = [
      [26, 28, 38, 26, '#f6ead4'], [82, 24, 42, 28, '#e3ccb0'], [146, 26, 44, 24, '#f9f0de'], [208, 28, 38, 26, '#e7d2b8'],
      [54, 72, 44, 28, '#f5e6cf'], [118, 70, 40, 26, '#ead5b8'], [178, 74, 44, 26, '#f8edda'], [234, 72, 34, 26, '#e2cab0'],
      [28, 120, 42, 26, '#e6d0b4'], [90, 118, 44, 28, '#f8eedc'], [156, 120, 38, 26, '#f0dec2'], [216, 118, 40, 28, '#e4cdb0'],
      [58, 168, 40, 26, '#f8efde'], [120, 166, 46, 28, '#e5ceb2'], [186, 168, 40, 26, '#f4e4ca'], [238, 168, 30, 26, '#ebd7bd'],
      [30, 218, 44, 26, '#f4e5cc'], [94, 216, 40, 26, '#e5cfb4'], [154, 218, 44, 28, '#faf2e4'], [218, 216, 38, 26, '#ecd8be'],
    ];
    for (const [x, y, w, h, fill] of stones) {
      ctx.fillStyle = 'rgba(176, 145, 112, 0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, w * 0.48, h * 0.44, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.46, h * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(x - w * 0.1, y - h * 0.12, w * 0.24, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, true, true);
  cobbleTex.repeat.set(2.2, 7.5);

  // Subtle terrain pastel grass grain (multiplied gently over vertex colors)
  const grassTex = makeCanvas(128, (ctx, s) => {
    ctx.fillStyle = '#f8f8f5';
    ctx.fillRect(0, 0, s, s);
    let seed = 9187;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 240; i++) {
      const x = rnd() * s;
      const y = rnd() * s;
      const r = 3 + rnd() * 9;
      ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(160,190,145,0.08)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, true, true);
  grassTex.repeat.set(32, 32);

  // Soft wing sprite for butterflies
  const wingTex = makeCanvas(64, (ctx, s) => {
    ctx.fillStyle = 'rgba(240,240,240,0.96)';
    ctx.beginPath();
    ctx.ellipse(s * 0.5, s * 0.34, s * 0.46, s * 0.3, -0.35, 0, Math.PI * 2);
    ctx.ellipse(s * 0.4, s * 0.68, s * 0.32, s * 0.24, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath(); ctx.arc(s * 0.6, s * 0.3, s * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s * 0.42, s * 0.7, s * 0.06, 0, Math.PI * 2); ctx.fill();
  });

  return {
    softDot,
    cobbleTex,
    grassTex,
    wingTex,
    dispose() {
      softDot.dispose();
      cobbleTex.dispose();
      grassTex.dispose();
      wingTex.dispose();
    },
  };
}

function createSkyDome() {
  const geo = new THREE.SphereGeometry(265, 32, 20);
  const uniforms = {
    uTime: { value: 0 },
    uDusk: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.5, 0.55, 0.4).normalize() },
    uHorizon: { value: new THREE.Color(0xffe1c8) },
    uMidSky: { value: new THREE.Color(0xbce2ff) },
    uZenith: { value: new THREE.Color(0x88b9f8) },
    uCloudCol: { value: new THREE.Color(0xfff5ec) },
    uSunCol: { value: new THREE.Color(0xfff1bf) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDusk;
      uniform vec3 uSunDir;
      uniform vec3 uHorizon;
      uniform vec3 uMidSky;
      uniform vec3 uZenith;
      uniform vec3 uCloudCol;
      uniform vec3 uSunCol;
      varying vec3 vDir;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 3; i++) {
          v += a * noise2(p);
          p = p * 2.04 + vec2(7.1, 3.7);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y, 0.0, 1.0);

        // Smooth pastel sky gradient: warm horizon -> soft mid -> periwinkle/lavender zenith
        vec3 col = mix(uHorizon, uMidSky, smoothstep(0.0, 0.34, h));
        col = mix(col, uZenith, smoothstep(0.28, 0.92, h));

        // Warm sun disc & soft storybook halo near the sun direction
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float sunHalo = pow(sunDot, 5.0) * 0.42 + pow(sunDot, 28.0) * 0.55;
        float sunDisc = smoothstep(0.9965, 0.999, sunDot) * 0.95;
        col += uSunCol * (sunHalo + sunDisc);

        // Painted pastel clouds drifting slowly across the sky
        if (dir.y > 0.03) {
          vec2 cloudUv = dir.xz / (dir.y + 0.24) * 1.15 + vec2(uTime * 0.008, uTime * 0.004);
          float cVal = fbm(cloudUv * 1.45);
          float cloudMask = smoothstep(0.51, 0.75, cVal) * smoothstep(0.03, 0.22, dir.y) * 0.72;
          col = mix(col, uCloudCol, cloudMask);
        }

        // Soft twinkling pastel stars appearing gently during dusk waves
        if (uDusk > 0.08 && dir.y > 0.14) {
          vec2 starCell = floor(dir.xz / (dir.y + 0.35) * 46.0);
          vec2 starLocal = fract(dir.xz / (dir.y + 0.35) * 46.0) - 0.5;
          float rnd = hash21(starCell);
          if (rnd > 0.92) {
            float d = length(starLocal);
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + rnd * 40.0);
            float star = smoothstep(0.22, 0.02, d) * twinkle * smoothstep(0.08, 0.75, uDusk) * smoothstep(0.14, 0.4, dir.y);
            col += vec3(1.0, 0.95, 0.85) * star * 0.85;
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  return { mesh, uniforms, dispose: () => { geo.dispose(); mat.dispose(); } };
}

export function setupEnvironment({ container, isHandheld, isSoftwareGl }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.90;

  const highDpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isHandheld ? 1.5 : 1.75);
  let currentTier = isSoftwareGl ? 'lite' : 'high';
  let currentDpr = highDpr;

  renderer.setPixelRatio(currentDpr);
  const w0 = container.clientWidth || window.innerWidth;
  const h0 = container.clientHeight || window.innerHeight;
  renderer.setSize(w0, h0);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdcf0ff);
  const fog = new THREE.FogExp2(0xdcf0ff, 0.0038);
  scene.fog = fog;

  // Baked procedural Studio Environment Map (RoomEnvironment IBL)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envTarget = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.34;
  roomEnv.dispose();
  pmrem.dispose();

  const textures = createTextures(renderer);
  const sky = createSkyDome();
  scene.add(sky.mesh);

  const camera = new THREE.PerspectiveCamera(48, w0 / Math.max(1, h0), 0.2, 320);

  // Lighting rig: warm golden-hour key light + cool/pastel hemisphere + gentle rim fill
  const hemiLight = new THREE.HemisphereLight(0xdef0ff, 0x8fc07d, 0.72);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffdfb0, 1.32);
  sunLight.position.set(24, 24, 18);
  sunLight.castShadow = !isSoftwareGl;
  sunLight.shadow.mapSize.set(isHandheld ? 1024 : 2048, isHandheld ? 1024 : 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 96;
  const shD = 32;
  sunLight.shadow.camera.left = -shD;
  sunLight.shadow.camera.right = shD;
  sunLight.shadow.camera.top = shD;
  sunLight.shadow.camera.bottom = -shD;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  sunLight.shadow.radius = 2.6;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const rimLight = new THREE.DirectionalLight(0xe5d4ff, 0.25);
  rimLight.position.set(-22, 14, -20);
  scene.add(rimLight);

  // Selective Half-Resolution Bloom Post-Processing (GPU only; software GL renders directly)
  let composer = null;
  let bloomPass = null;
  let bloomActive = !isSoftwareGl;

  if (!isSoftwareGl) {
    composer = new EffectComposer(renderer);
    composer.setPixelRatio(currentDpr);
    composer.setSize(w0, h0);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(w0 * 0.5)), Math.max(1, Math.floor(h0 * 0.5))),
      0.38, // gentle magical bloom
      0.50, // soft spread
      0.96  // high threshold: only HDR emissive lanterns, windows, crystals & stars glow
    );
    composer.addPass(bloomPass);
    composer.addPass(new OutputPass());
  }

  // Day-to-Dusk cycle palettes: ~70% golden afternoon, ~30% gentle cozy pastel dusk wave
  const PAL = {
    dayHorizon: new THREE.Color(0xdcf0ff),
    duskHorizon: new THREE.Color(0xffb5a7),
    dayMid: new THREE.Color(0xb2dcff),
    duskMid: new THREE.Color(0xcfa8eb),
    dayZenith: new THREE.Color(0x7fb3f5),
    duskZenith: new THREE.Color(0x7c74c2),
    dayCloud: new THREE.Color(0xfff6ed),
    duskCloud: new THREE.Color(0xffcad4),
    daySunCol: new THREE.Color(0xffdfaa),
    duskSunCol: new THREE.Color(0xffad8c),
    dayHemiSky: new THREE.Color(0xe6f2ff),
    duskHemiSky: new THREE.Color(0xcab5f5),
    dayHemiGnd: new THREE.Color(0x8fc07d),
    duskHemiGnd: new THREE.Color(0x6e829c),
    dayRim: new THREE.Color(0xebd8ff),
    duskRim: new THREE.Color(0xffb8d9),
  };

  const _sunOffset = new THREE.Vector3();

  function updateAtmosphere(simTime, focusPos, calmMotion) {
    // 140s cycle: smoothly spends ~70% in golden afternoon, ~30% drifting through pastel dusk
    const phase = calmMotion ? 0.12 : ((simTime / 140) % 1);
    const wave = Math.max(0, Math.sin((phase - 0.56) * Math.PI / 0.44));
    const inWave = phase >= 0.56 ? wave : 0;
    const duskFactor = Math.pow(inWave, 1.35) * 0.78; // never pitch dark or scary

    // Update Sky Dome & Fog colors seamlessly
    sky.uniforms.uTime.value = simTime;
    sky.uniforms.uDusk.value = duskFactor;
    sky.uniforms.uHorizon.value.copy(PAL.dayHorizon).lerp(PAL.duskHorizon, duskFactor);
    sky.uniforms.uMidSky.value.copy(PAL.dayMid).lerp(PAL.duskMid, duskFactor);
    sky.uniforms.uZenith.value.copy(PAL.dayZenith).lerp(PAL.duskZenith, duskFactor);
    sky.uniforms.uCloudCol.value.copy(PAL.dayCloud).lerp(PAL.duskCloud, duskFactor);
    sky.uniforms.uSunCol.value.copy(PAL.daySunCol).lerp(PAL.duskSunCol, duskFactor);

    scene.background.copy(sky.uniforms.uHorizon.value);
    fog.color.copy(sky.uniforms.uHorizon.value);
    fog.density = 0.0038 + duskFactor * 0.0014;

    // Warm sun arc: warm afternoon elevation -> lower apricot glow at dusk
    const sunAz = 0.62 + duskFactor * 0.35;
    const sunElev = 0.62 - duskFactor * 0.28;
    _sunOffset.set(
      Math.cos(sunAz) * Math.cos(sunElev),
      Math.sin(sunElev),
      Math.sin(sunAz) * Math.cos(sunElev)
    ).normalize();
    sky.uniforms.uSunDir.value.copy(_sunOffset);

    const fx = focusPos ? focusPos.x : 0;
    const fz = focusPos ? focusPos.z : 0;
    sunLight.position.set(fx + _sunOffset.x * 42, _sunOffset.y * 42, fz + _sunOffset.z * 42);
    sunLight.target.position.set(fx, 0, fz);
    sunLight.target.updateMatrixWorld();

    sunLight.color.copy(PAL.daySunCol).lerp(PAL.duskSunCol, duskFactor);
    sunLight.intensity = 1.32 - duskFactor * 0.38;

    hemiLight.color.copy(PAL.dayHemiSky).lerp(PAL.duskHemiSky, duskFactor);
    hemiLight.groundColor.copy(PAL.dayHemiGnd).lerp(PAL.duskHemiGnd, duskFactor);
    hemiLight.intensity = 0.72 - duskFactor * 0.16;

    rimLight.color.copy(PAL.dayRim).lerp(PAL.duskRim, duskFactor);
    rimLight.intensity = 0.25 + duskFactor * 0.20;

    scene.environmentIntensity = 0.34 - duskFactor * 0.08;
    sky.mesh.position.copy(camera.position);

    if (bloomPass) {
      bloomPass.strength = 0.38 + duskFactor * 0.22;
    }

    return duskFactor;
  }

  function resize(w, h) {
    renderer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(currentDpr);
      composer.setSize(w, h);
      if (bloomPass) {
        bloomPass.resolution.set(Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5)));
      }
    }
  }

  function setQualityTier(tier) {
    if (isSoftwareGl || tier === currentTier) return;
    currentTier = tier;
    if (tier === 'high') {
      currentDpr = highDpr;
      renderer.shadowMap.enabled = true;
      sunLight.castShadow = true;
      bloomActive = true;
    } else if (tier === 'balanced') {
      currentDpr = Math.min(highDpr, 1.35);
      renderer.shadowMap.enabled = true;
      sunLight.castShadow = true;
      if (sunLight.shadow.mapSize.width !== 1024) {
        sunLight.shadow.mapSize.set(1024, 1024);
        if (sunLight.shadow.map) {
          sunLight.shadow.map.dispose();
          sunLight.shadow.map = null;
        }
      }
      bloomActive = true;
    } else {
      currentDpr = Math.min(highDpr, 1.15);
      renderer.shadowMap.enabled = false;
      sunLight.castShadow = false;
      bloomActive = false;
    }
    renderer.setPixelRatio(currentDpr);
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    resize(w, h);
  }

  function renderFrame() {
    if (composer && bloomActive && !isSoftwareGl) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  }

  function dispose() {
    sky.dispose();
    textures.dispose();
    envTarget.dispose();
    if (composer) composer.dispose();
    if (bloomPass) bloomPass.dispose();
  }

  return {
    renderer,
    scene,
    camera,
    skyMesh: sky.mesh,
    textures,
    sunLight,
    hemiLight,
    bloomPass,
    updateAtmosphere,
    resize,
    setQualityTier,
    renderFrame,
    getTier: () => currentTier,
    dispose,
  };
}

export function createQualityController({ isSoftwareGl, onTierChange }) {
  const tiers = ['high', 'balanced', 'lite'];
  let idx = isSoftwareGl ? 2 : 0;
  let warmupUntil = performance.now() + 3000;
  let lastTs = 0;
  let winMs = 0;
  let winFrames = 0;

  return {
    reset() {
      warmupUntil = performance.now() + 3000;
      lastTs = 0;
      winMs = 0;
      winFrames = 0;
    },
    measure(now) {
      if (isSoftwareGl || idx >= tiers.length - 1) return;
      const gap = lastTs ? now - lastTs : 0;
      lastTs = now;
      if (now < warmupUntil || !gap) return;
      if (gap > 250 || document.hidden) {
        winMs = 0;
        winFrames = 0;
        return;
      }
      winMs += gap;
      winFrames++;
      if (winMs >= 2000) {
        const avg = winMs / Math.max(1, winFrames);
        if (avg > 21.5) {
          idx++;
          onTierChange(tiers[idx]);
          warmupUntil = now + 2500;
        }
        winMs = 0;
        winFrames = 0;
      }
    },
    getTier: () => tiers[idx],
  };
}
