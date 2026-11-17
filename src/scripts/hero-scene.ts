/* =====================================================================
   PRISM ENGINE — Persistent 3D WebGL Prism, Dispersed Spectrum,
   Cratered Moon & Interactive Modes for the Dev Blog.
   Preserves the exact original Dark Side of the Moon crystal & rainbow
   colors while staying 100% continuous at 60fps across page transitions.
   ===================================================================== */

export type PrismCategory = 'all' | 'tutorials' | 'opinions' | 'personal' | 'architecture';
export type PrismMode = 'spectrum' | 'overdrive' | 'xray' | 'eclipse';

const MODE_LABELS: Record<PrismMode, string> = {
  spectrum: 'λ 380–750nm · SPECTRUM',
  overdrive: 'λ 380–750nm · OVERDRIVE',
  xray: 'λ 380–750nm · X-RAY CRYSTAL',
  eclipse: 'λ 380–750nm · LUNAR ECLIPSE',
};

// Keep the original balanced 6-band rainbow and cool crystal colors across all categories
const WAVELENGTH_INFO: Record<
  PrismCategory,
  { label: string; colorHex: string; rgb: [number, number, number]; bandWeights: number[] }
> = {
  all: {
    label: 'λ 380–750nm · SPECTRUM',
    colorHex: '#c9e5f2',
    rgb: [0.18, 0.38, 0.46],
    bandWeights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
  tutorials: {
    label: 'λ 380–750nm · SPECTRUM',
    colorHex: '#c9e5f2',
    rgb: [0.18, 0.38, 0.46],
    bandWeights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
  opinions: {
    label: 'λ 380–750nm · SPECTRUM',
    colorHex: '#c9e5f2',
    rgb: [0.18, 0.38, 0.46],
    bandWeights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
  personal: {
    label: 'λ 380–750nm · SPECTRUM',
    colorHex: '#c9e5f2',
    rgb: [0.18, 0.38, 0.46],
    bandWeights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
  architecture: {
    label: 'λ 380–750nm · SPECTRUM',
    colorHex: '#c9e5f2',
    rgb: [0.18, 0.38, 0.46],
    bandWeights: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
  },
};

type PersistentCanvas = HTMLCanvasElement & {
  __prismActive?: boolean;
  __prismOnNavigate?: () => void;
};

export async function initHeroScene(_signal?: AbortSignal): Promise<void> {
  const container = document.querySelector<HTMLElement>('#prismBackdrop');
  const canvas = container?.querySelector<PersistentCanvas>('.prism-backdrop__canvas');
  if (!container || !canvas) return;

  // If the WebGL Prism scene is already running on this persistent canvas,
  // never destroy or reset it — just notify it of the new page layout!
  if (canvas.__prismActive) {
    canvas.__prismOnNavigate?.();
    return;
  }
  canvas.__prismActive = true;

  // Persistent lifetime controller (only aborts if canvas is ever removed from DOM)
  const sceneController = new AbortController();
  const signal = sceneController.signal;

  const initialCat = (container.dataset.prismCategory as PrismCategory) || 'all';
  const initialMode = (container.dataset.prismMode as PrismMode) || 'spectrum';

  let activeCategory: PrismCategory = WAVELENGTH_INFO[initialCat] ? initialCat : 'all';
  let activeMode: PrismMode = initialMode;
  let pulseEnergy = 0;

  const isHubPath = () => {
    const p = window.location.pathname.replace(/\/$/, '');
    return p === '' || p === '/index.html';
  };
  let targetHubMix = isHubPath() ? 1 : 0;
  let easedHubMix = targetHubMix;
  let navBreath = 0;

  const updateHudUI = () => {
    const wlEl = document.getElementById('prismWavelength');
    const dotEl = document.getElementById('prismHudDot');
    if (wlEl) wlEl.textContent = MODE_LABELS[activeMode] || WAVELENGTH_INFO.all.label;
    if (dotEl) {
      dotEl.style.background = '#c9e5f2';
      dotEl.style.boxShadow = '0 0 10px rgba(201, 229, 242, 0.8)';
    }
    document.querySelectorAll<HTMLElement>('[data-prism-mode-btn]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.prismModeBtn === activeMode);
    });
  };
  updateHudUI();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 768px)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  let scrollTarget = 0;
  let scrollRange = 1;

  const onScroll = () => {
    scrollTarget = Math.min(1, Math.max(0, window.scrollY / scrollRange));
    const fade = Math.min(1, Math.max(0, window.scrollY / Math.max(1, innerHeight)));
    container.style.setProperty('--prism-strength', String(1 - fade * 0.22));
  };
  const measureScroll = () => {
    const rawScrollable = document.documentElement.scrollHeight - innerHeight;
    // Use a consistent physical scroll scale (at least 4 viewports / 3600px) so
    // individual section pages (thoughts, projects, about, certs, contact) never
    // spin the prism rapidly over a short scrollbar.
    scrollRange = Math.max(3600, innerHeight * 4, rawScrollable);
    onScroll();
  };
  window.addEventListener('scroll', onScroll, { passive: true, signal });
  window.addEventListener('resize', measureScroll, { passive: true, signal });
  const pageObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measureScroll);
  pageObserver?.observe(document.documentElement);
  if (document.body) pageObserver?.observe(document.body);
  signal.addEventListener('abort', () => pageObserver?.disconnect(), { once: true });
  measureScroll();

  canvas.__prismOnNavigate = () => {
    targetHubMix = isHubPath() ? 1 : 0;
    navBreath = Math.max(navBreath, 0.35);
    measureScroll();
    if (document.body) pageObserver?.observe(document.body);
    updateHudUI();
  };

  if (reduced.matches || connection?.saveData) return;

  let THREE: typeof import('three');
  try {
    THREE = await import('three');
  } catch {
    canvas.__prismActive = false;
    return;
  }
  if (signal.aborted) return;

  let renderer: import('three').WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch {
    canvas.__prismActive = false;
    return;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-6, 6, 3.6, -3.6, 0.1, 40);
  camera.position.set(0, 0, 12);

  const artwork = new THREE.Group();
  artwork.name = 'prism-artwork';
  scene.add(artwork);

  const prism = new THREE.Group();
  prism.name = 'rotating-prism';
  artwork.add(prism);

  const light = new THREE.Group();
  light.name = 'refracted-light';
  artwork.add(light);

  const bandMaterials: Array<{
    outer: import('three').MeshBasicMaterial;
    inner: import('three').MeshBasicMaterial;
    baseOuterOpacity: number;
    baseInnerOpacity: number;
    bandIndex: number;
  }> = [];
  const lightMaterials: Array<{ material: import('three').Material & { opacity: number }; opacity: number }> = [];
  const resources: Array<{ dispose(): void }> = [];
  const own = <T extends { dispose(): void }>(resource: T): T => {
    resources.push(resource);
    return resource;
  };

  const top = 1.35;
  const bottom = -0.82;
  const halfWidth = 1.25;
  const edgeX = (y: number) => (halfWidth * (top - y)) / (top - bottom);
  const entry = new THREE.Vector3(-edgeX(0.02), 0.02, 0.39);

  // Extruded triangular glass prism — exact original silhouette & crystal colors
  const shape = new THREE.Shape();
  shape.moveTo(0, top);
  shape.lineTo(-halfWidth, bottom);
  shape.lineTo(halfWidth, bottom);
  shape.closePath();

  const geometry = own(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.7,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.018,
      bevelThickness: 0.018,
    })
  );
  geometry.translate(0, 0, -0.35);

  const glass = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uEnergy: { value: 0 },
        uPulse: { value: 0 },
        uXray: { value: 0 },
      },
      vertexShader: `
        varying vec3 vLocal;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vLocal = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vView = -view.xyz;
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uEnergy;
        uniform float uPulse;
        uniform float uXray;
        varying vec3 vLocal;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 eye = normalize(vView);
          float fresnel = pow(1.0 - abs(dot(n, eye)), 2.2);
          float sideDistance = (1.35 - vLocal.y - 1.736 * abs(vLocal.x)) / 2.004;
          float edgeDistance = max(0.0, min(vLocal.y + .82, sideDistance));
          float edge = exp(-edgeDistance * 32.0);
          float innerRim = exp(-edgeDistance * 8.0) * .18;
          float glint = pow(max(0.0, dot(n, normalize(vec3(-.5, .8, 1.3) + eye))), 48.0);
          float sweep = pow(.5 + .5 * sin(vLocal.x * 1.7 + vLocal.y * 1.1 - uTime * .22), 6.0);

          // Subtle internal caustic wave when Refract is triggered
          float distFromEntry = length(vLocal.xy - vec2(-0.65, 0.0));
          float waveRing = exp(-pow((distFromEntry - (1.0 - uPulse) * 2.6) * 6.5, 2.0)) * uPulse;

          // Original crystal colors from our Landing Page prism
          vec3 tint = mix(vec3(.16, .24, .30), vec3(.75, .88, .95), edge * .8 + fresnel * .2);
          tint += glint * .5 + innerRim + sweep * (.08 + uEnergy * .18);
          tint += vec3(.18, .38, .46) * (uEnergy + waveRing * 0.85) * (edge + fresnel);
          tint += vec3(.75, .88, .95) * waveRing * 0.32;

          // X-Ray wireframe harmonic scanlines in the same icy-crystal tone
          float xrayGrid = step(0.92, fract(vLocal.y * 12.0 - uTime * 0.5)) * uXray * 0.35;
          tint += vec3(.65, .84, .95) * xrayGrid;

          float alpha = (.055 + edge * .6 + fresnel * .23 + innerRim + glint * .15 + uEnergy * .08 + waveRing * .25) * (1.0 - uXray * 0.42);
          gl_FragColor = vec4(tint, min(alpha, .85));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
  );
  prism.add(new THREE.Mesh(geometry, glass));

  const edges = own(new THREE.EdgesGeometry(geometry, 25));
  const edgeMaterial = own(
    new THREE.LineBasicMaterial({
      color: 0xc9e5f2,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    })
  );
  prism.add(new THREE.LineSegments(edges, edgeMaterial));

  // Thin luminous edge volumes
  const rimMaterial = own(
    new THREE.MeshBasicMaterial({
      color: 0x9cdfe9,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  const corners = [-0.35, 0.35].flatMap((z) => [
    new THREE.Vector3(0, top, z),
    new THREE.Vector3(-halfWidth, bottom, z),
    new THREE.Vector3(halfWidth, bottom, z),
  ]);
  for (const [a, b] of [
    [0, 1],
    [1, 2],
    [2, 0],
    [3, 4],
    [4, 5],
    [5, 3],
    [0, 3],
    [1, 4],
    [2, 5],
  ]) {
    const start = corners[a];
    const end = corners[b];
    const axis = end.clone().sub(start);
    const rim = new THREE.Mesh(own(new THREE.CylinderGeometry(0.012, 0.012, axis.length(), 6)), rimMaterial);
    rim.position.copy(start).add(end).multiplyScalar(0.5);
    rim.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
    prism.add(rim);
  }

  // Incoming white light beam ribbons
  const ribbon = (
    a: import('three').Vector3,
    b: import('three').Vector3,
    widthA: number,
    widthB: number,
    color: number,
    opacity: number
  ) => {
    const direction = b.clone().sub(a);
    const perpendicular = new THREE.Vector3(-direction.y, direction.x, 0).normalize();
    const points = [
      a.clone().addScaledVector(perpendicular, widthA / 2),
      a.clone().addScaledVector(perpendicular, -widthA / 2),
      b.clone().addScaledVector(perpendicular, -widthB / 2),
      b.clone().addScaledVector(perpendicular, widthB / 2),
    ];
    const buffer = own(new THREE.BufferGeometry());
    buffer.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap((p) => [p.x, p.y, p.z]), 3));
    buffer.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    buffer.setIndex([0, 1, 2, 0, 2, 3]);
    const material = own(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
    );
    const mesh = new THREE.Mesh(buffer, material);
    mesh.renderOrder = 2;
    light.add(mesh);
    lightMaterials.push({ material, opacity });
    return mesh;
  };

  const whiteStart = new THREE.Vector3(-14, -2.85, 0.39);
  ribbon(whiteStart, entry, 0.025, 0.014, 0xf5faff, 0.95);
  ribbon(whiteStart, entry, 0.085, 0.065, 0xb2d7ef, 0.09);
  ribbon(entry, new THREE.Vector3(-5.2, 3.5, 0.27), 0.013, 0.004, 0xc1deef, 0.12);

  // Original 6 Dispersed Rainbow Spectrum Bands
  const spectrum = [0xff304d, 0xff932c, 0xffe747, 0x68e879, 0x36bffa, 0xa083fa];
  for (let i = 0; i < spectrum.length; i++) {
    const yTop = 0.34 - i * 0.065;
    const yBottom = yTop - 0.065;
    const pTop = new THREE.Vector3(edgeX(yTop), yTop, 0.39);
    const pBottom = new THREE.Vector3(edgeX(yBottom), yBottom, 0.39);
    const farTop = new THREE.Vector3(12, -1.15 - i * 0.36, 0.39);
    const farBottom = new THREE.Vector3(12, -1.15 - (i + 1) * 0.36, 0.39);

    const bandGeometry = own(new THREE.BufferGeometry());
    bandGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([pTop, pBottom, farBottom, farTop].flatMap((p) => [p.x, p.y, p.z]), 3)
    );
    bandGeometry.setIndex([0, 1, 2, 0, 2, 3]);

    const color = new THREE.Color(spectrum[i]);
    const bandMaterial = own(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const band = new THREE.Mesh(bandGeometry, bandMaterial);
    band.renderOrder = 3;
    light.add(band);

    const innerGeometry = own(new THREE.BufferGeometry());
    innerGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([entry, pBottom, pTop].flatMap((p) => [p.x, p.y, p.z]), 3)
    );
    innerGeometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute([1, 1, 1, ...color.toArray(), ...color.toArray()], 3)
    );
    const innerMaterial = own(
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
    );
    const innerBeam = new THREE.Mesh(innerGeometry, innerMaterial);
    innerBeam.renderOrder = 4;
    light.add(innerBeam);

    bandMaterials.push({
      outer: bandMaterial,
      inner: innerMaterial,
      baseOuterOpacity: 0.76,
      baseInnerOpacity: 0.42,
      bandIndex: i,
    });
  }

  // Soft icy-crystal Shockwave Ring Mesh for interactive Refraction Pulses
  const pulseRingGeo = own(new THREE.RingGeometry(0.12, 0.18, 64));
  const pulseRingMat = own(
    new THREE.MeshBasicMaterial({
      color: 0xc9e5f2,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
  pulseRing.position.set(0, 0.1, 0.42);
  pulseRing.renderOrder = 6;
  prism.add(pulseRing);

  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const ctx = glowCanvas.getContext('2d');
  let entryGlowSprite: import('three').Sprite | null = null;
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(245,252,255,1)');
    gradient.addColorStop(0.16, 'rgba(190,230,255,.65)');
    gradient.addColorStop(1, 'rgba(100,160,220,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
    const texture = own(new THREE.CanvasTexture(glowCanvas));
    const glowMaterial = own(
      new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.65,
      })
    );
    const glow = new THREE.Sprite(glowMaterial);
    glow.position.copy(entry);
    glow.scale.set(0.32, 0.32, 1);
    light.add(glow);
    entryGlowSprite = glow;
    lightMaterials.push({ material: glowMaterial, opacity: 0.65 });

    const apexMaterial = own(
      new THREE.SpriteMaterial({
        map: texture,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.28,
      })
    );
    const apex = new THREE.Sprite(apexMaterial);
    apex.position.set(0, top, 0.35);
    apex.scale.set(0.45, 0.45, 1);
    prism.add(apex);
  }

  // =====================================================================
  // MOON — Cratered sphere with original cool lunar palette + Eclipse mode
  // =====================================================================
  const moonGroup = new THREE.Group();
  moonGroup.name = 'moon';
  scene.add(moonGroup);

  const moonRadius = 0.42;
  const moonSegments = 96;
  const moonGeometry = own(new THREE.SphereGeometry(moonRadius, moonSegments, moonSegments));

  const moonMaterial = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPhase: { value: 0 },
        uEnergy: { value: 0 },
        uEclipse: { value: 0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = position;
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uPhase;
        uniform float uEnergy;
        uniform float uEclipse;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }
        float craters(vec2 p) {
          float n = 0.0;
          n += noise(p * 4.0) * .5;
          n += noise(p * 8.0 + 3.7) * .25;
          n += noise(p * 16.0 + 7.3) * .125;
          n += noise(p * 32.0 + 13.1) * .0625;
          float c1 = smoothstep(.08, .0, length(fract(p * 3.0 + .2) - .5));
          float c2 = smoothstep(.12, .0, length(fract(p * 5.5 + .7) - .5));
          float c3 = smoothstep(.06, .0, length(fract(p * 8.2 + .4) - .5));
          n -= (c1 * .15 + c2 * .1 + c3 * .08);
          return n;
        }

        void main() {
          vec3 n = normalize(vNormal);
          float theta = atan(vPosition.z, vPosition.x) + uTime * .03;
          float phi = acos(clamp(vPosition.y / ${moonRadius.toFixed(4)}, -1.0, 1.0));
          vec2 surfaceUv = vec2(theta / 6.2832, phi / 3.1416);
          float surface = craters(surfaceUv * 6.0);

          vec3 darkSide = vec3(.03, .035, .045);
          vec3 litSide = vec3(.58, .6, .65) + surface * .2;
          litSide = mix(litSide, vec3(.7, .72, .76), smoothstep(.3, .7, surface));

          float phaseAngle = uPhase * 6.2832;
          vec3 lightDir = normalize(vec3(cos(phaseAngle), .15, sin(phaseAngle)));
          float illumination = dot(n, lightDir);
          float terminator = smoothstep(-.12, .18, illumination) * (1.0 - uEclipse * 0.78);

          vec3 color = mix(darkSide, litSide, terminator);
          float fresnel = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 3.0);
          color += vec3(.25, .32, .42) * fresnel * (.3 + terminator * .4 + uEclipse * 1.15);
          color += vec3(.12, .16, .22) * fresnel * .5;
          color += vec3(.08, .12, .18) * uEnergy * fresnel;

          float alpha = .82 + fresnel * .15;
          gl_FragColor = vec4(color, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
  );

  const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
  moonGroup.add(moonMesh);

  if (ctx) {
    const moonGlowCanvas = document.createElement('canvas');
    moonGlowCanvas.width = moonGlowCanvas.height = 128;
    const mCtx = moonGlowCanvas.getContext('2d');
    if (mCtx) {
      const g = mCtx.createRadialGradient(64, 64, 8, 64, 64, 64);
      g.addColorStop(0, 'rgba(180,200,220,0)');
      g.addColorStop(0.35, 'rgba(140,165,195,.06)');
      g.addColorStop(0.6, 'rgba(120,145,180,.04)');
      g.addColorStop(1, 'rgba(80,100,140,0)');
      mCtx.fillStyle = g;
      mCtx.fillRect(0, 0, 128, 128);
      const moonGlowTexture = own(new THREE.CanvasTexture(moonGlowCanvas));
      const moonGlowMat = own(
        new THREE.SpriteMaterial({
          map: moonGlowTexture,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          opacity: 0.6,
          transparent: true,
        })
      );
      const moonGlow = new THREE.Sprite(moonGlowMat);
      moonGlow.scale.set(1.9, 1.9, 1);
      moonGroup.add(moonGlow);
    }
  }

  // Lunar orbiting dust
  const lunarDustCount = mobile.matches ? 18 : 36;
  const lunarDustGeo = own(new THREE.BufferGeometry());
  const lunarPos = new Float32Array(lunarDustCount * 3);
  const lunarSizes = new Float32Array(lunarDustCount);
  const lunarPhases = new Float32Array(lunarDustCount);
  const lunarOrbitRadius = new Float32Array(lunarDustCount);
  const lunarOrbitSpeed = new Float32Array(lunarDustCount);

  for (let i = 0; i < lunarDustCount; i++) {
    lunarOrbitRadius[i] = 0.52 + Math.random() * 0.45;
    lunarOrbitSpeed[i] = (0.12 + Math.random() * 0.25) * (i % 2 === 0 ? 1 : -1);
    lunarPhases[i] = Math.random() * Math.PI * 2;
    lunarSizes[i] = 1.6 + Math.random() * 2.2;
  }

  const lunarPosAttr = new THREE.BufferAttribute(lunarPos, 3);
  lunarPosAttr.setUsage(THREE.DynamicDrawUsage);
  lunarDustGeo.setAttribute('position', lunarPosAttr);
  lunarDustGeo.setAttribute('aSize', new THREE.BufferAttribute(lunarSizes, 1));
  lunarDustGeo.setAttribute('aPhase', new THREE.BufferAttribute(lunarPhases, 1));

  const lunarDustMat = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vAlpha;
        void main() {
          vAlpha = .3 + .2 * sin(uTime * .6 + aPhase);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          float r = length(gl_PointCoord - vec2(.5));
          float glow = 1.0 - smoothstep(.1, .5, r);
          gl_FragColor = vec4(.7, .76, .85, glow * vAlpha);
          #include <colorspace_fragment>
        }
      `,
    })
  );

  const lunarDust = new THREE.Points(lunarDustGeo, lunarDustMat);
  lunarDust.frustumCulled = false;
  moonGroup.add(lunarDust);

  let moonBaseX = 0;
  let moonBaseY = 0;

  // Ambient cosmic dust field — original soft starlight colors
  const dustGeometry = own(new THREE.BufferGeometry());
  const maxParticles = 480;
  const dustPoints = new Float32Array(maxParticles * 3);
  const origins = new Float32Array(maxParticles * 2);
  const velocities = new Float32Array(maxParticles * 2);
  const sizes = new Float32Array(maxParticles);
  const opacities = new Float32Array(maxParticles);
  const phases = new Float32Array(maxParticles);
  const tints = new Float32Array(maxParticles * 3);

  for (let i = 0; i < maxParticles; i++) {
    origins[i * 2] = Math.random();
    origins[i * 2 + 1] = Math.random();
    velocities[i * 2] = (Math.random() - 0.5) * 0.025;
    velocities[i * 2 + 1] = 0.009 + Math.random() * 0.02;
    const depth = Math.random();
    dustPoints[i * 3 + 2] = -2 - depth * 4;
    sizes[i] = 3.2 + (1 - depth) * 4;
    opacities[i] = 0.55 + (1 - depth) * 0.35;
    phases[i] = Math.random() * Math.PI * 2;
    const tint = new THREE.Color(i % 7 === 0 ? 0xa4c7df : i % 11 === 0 ? 0xc5b6dd : 0xd0d9dc);
    tint.toArray(tints, i * 3);
  }

  const dustPosition = new THREE.BufferAttribute(dustPoints, 3);
  dustPosition.setUsage(THREE.DynamicDrawUsage);
  dustGeometry.setAttribute('position', dustPosition);
  dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  dustGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));
  dustGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  dustGeometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));

  const dustMaterial = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
      vertexShader: `
        attribute float aSize;
        attribute float aOpacity;
        attribute float aPhase;
        attribute vec3 aTint;
        uniform float uTime;
        uniform float uPixelRatio;
        varying float vOpacity;
        varying vec3 vTint;
        void main() {
          vOpacity = aOpacity * (.88 + .12 * sin(uTime * .45 + aPhase));
          vTint = aTint;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: `
        varying float vOpacity;
        varying vec3 vTint;
        void main() {
          float radius = length(gl_PointCoord - vec2(.5));
          float core = 1.0 - smoothstep(.12, .3, radius);
          float halo = 1.0 - smoothstep(.1, .5, radius);
          float glow = core * .75 + halo * .25;
          gl_FragColor = vec4(vTint, glow * vOpacity);
          #include <colorspace_fragment>
        }
      `,
    })
  );

  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.name = 'independent-particles';
  dust.frustumCulled = false;
  dust.renderOrder = -1;
  scene.add(dust);

  let particleCount = maxParticles;
  let frame = 0;
  let lastTime = 0;
  let elapsed = 0;
  let lost = false;
  let scroll = scrollTarget;
  let scrollVelocity = 0;
  let easedEnergy = 0;
  let easedXray = activeMode === 'xray' ? 1 : 0;
  let easedEclipse = activeMode === 'eclipse' ? 1 : 0;
  let easedOverdrive = activeMode === 'overdrive' ? 1 : 0;
  let sceneWidth = 12;
  let baseScale = 1;
  let viewportKey = '';
  const currentBandWeights = [...WAVELENGTH_INFO[activeCategory].bandWeights];

  const wrap = (value: number) => value - Math.floor(value);
  const centerY = (top + bottom) / 2;
  prism.children.forEach((child) => {
    child.position.y -= centerY;
  });
  light.children.forEach((child) => {
    child.position.y -= centerY;
  });

  const pointer = new THREE.Vector2();
  const easedPointer = new THREE.Vector2();
  const pointerDrift = new THREE.Vector2();

  // Trigger a soft crystal shockwave pulse through the prism
  const triggerPulse = () => {
    pulseEnergy = 1.0;
    pulseRingMat.color.set(0xc9e5f2);
  };

  // Listen to custom mode/pulse events from the UI
  const onFrequencyChange = (ev: Event) => {
    const detail = (ev as CustomEvent<{ category?: PrismCategory; mode?: PrismMode; pulse?: boolean }>).detail || {};
    if (detail.category && WAVELENGTH_INFO[detail.category]) {
      activeCategory = detail.category;
    }
    if (detail.mode) {
      activeMode = detail.mode;
    }
    if (detail.pulse) {
      triggerPulse();
    }
    updateHudUI();
  };
  window.addEventListener('prism:frequency', onFrequencyChange, { signal });

  // Wire up HUD buttons once via event delegation so they always work across navigations
  document.addEventListener(
    'click',
    (e) => {
      const target = e.target as HTMLElement | null;
      const modeBtn = target?.closest<HTMLButtonElement>('[data-prism-mode-btn]');
      if (modeBtn) {
        const mode = modeBtn.dataset.prismModeBtn as PrismMode;
        if (mode) {
          window.dispatchEvent(new CustomEvent('prism:frequency', { detail: { mode, pulse: true } }));
        }
        return;
      }
      const pulseBtn = target?.closest<HTMLButtonElement>('#prismPulseBtn');
      if (pulseBtn) {
        triggerPulse();
      }
    },
    { signal }
  );

  // Double-click anywhere on non-interactive hero background triggers a refraction pulse
  window.addEventListener(
    'dblclick',
    () => {
      triggerPulse();
    },
    { signal }
  );

  const resize = () => {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    const pixelRatio = Math.min(devicePixelRatio || 1, 2.5);
    const nextKey = `${width}:${height}:${pixelRatio}`;
    if (viewportKey === nextKey) return;
    viewportKey = nextKey;

    const viewHeight = 7.2;
    sceneWidth = (viewHeight * width) / height;
    camera.left = -sceneWidth / 2;
    camera.right = sceneWidth / 2;
    camera.top = viewHeight / 2;
    camera.bottom = -viewHeight / 2;
    camera.updateProjectionMatrix();

    renderer.setPixelRatio(pixelRatio);
    dustMaterial.uniforms.uPixelRatio.value = pixelRatio;
    lunarDustMat.uniforms.uPixelRatio.value = pixelRatio;
    particleCount = Math.min(mobile.matches ? 140 : maxParticles, Math.max(90, Math.round((width * height) / 4600)));
    dustGeometry.setDrawRange(0, particleCount);
    renderer.setSize(width, height, false);

    baseScale = Math.min(1.26, (sceneWidth * 0.78) / (3.4 * 1.16), (viewHeight * 0.72) / (3.4 * 1.16));
    artwork.scale.setScalar(baseScale);

    moonBaseX = mobile.matches ? sceneWidth * 0.28 : sceneWidth * 0.36;
    moonBaseY = mobile.matches ? viewHeight * 0.26 : viewHeight * 0.31;
    const moonScale = mobile.matches ? 0.72 : 1.05;
    moonMesh.scale.setScalar(moonScale);
    onScroll();
  };

  const render = (time: number) => {
    frame = 0;
    if (signal.aborted || document.hidden || reduced.matches || lost) return;
    frame = requestAnimationFrame(render);

    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    elapsed += delta * (1 + easedOverdrive * 0.75);
    const ease = 1 - Math.exp(-delta * 6.5);

    // Smooth, floating pointer follow (two cascaded low-pass filters)
    const pointerEase = 1 - Math.exp(-delta * 1.8);
    pointerDrift.lerp(pointer, pointerEase);
    easedPointer.lerp(pointerDrift, pointerEase);

    // Smoothly glide between Hub offset (right side) and subpage center
    const hubEase = 1 - Math.exp(-delta * 2.6);
    easedHubMix += (targetHubMix - easedHubMix) * hubEase;

    if (navBreath > 0.001) {
      navBreath = Math.max(0, navBreath - delta * 0.65);
    } else {
      navBreath = 0;
    }

    easedXray += ((activeMode === 'xray' ? 1 : 0) - easedXray) * ease;
    easedEclipse += ((activeMode === 'eclipse' ? 1 : 0) - easedEclipse) * ease;
    easedOverdrive += ((activeMode === 'overdrive' ? 1 : 0) - easedOverdrive) * ease;

    if (pulseEnergy > 0.001) {
      pulseEnergy = Math.max(0, pulseEnergy - delta * 1.15);
    } else {
      pulseEnergy = 0;
    }

    const targetWeights = WAVELENGTH_INFO[activeCategory].bandWeights;
    for (let i = 0; i < 6; i++) {
      currentBandWeights[i] += (targetWeights[i] - currentBandWeights[i]) * ease;
    }

    // Critically damped spring for scroll (calm, weighty inertia)
    const frequency = 7.5;
    const offset = scroll - scrollTarget;
    const impulse = (scrollVelocity + frequency * offset) * delta;
    const decay = Math.exp(-frequency * delta);
    scroll = scrollTarget + (offset + impulse) * decay;
    scrollVelocity = (scrollVelocity - frequency * impulse) * decay;

    const angle = scroll * Math.PI * 2.4 + elapsed * easedOverdrive * 0.32;
    const travel = Math.sin(scroll * Math.PI);
    const rawEnergy = Math.min(
      1,
      Math.abs(scrollVelocity) * 2.5 + pulseEnergy * 0.7 + navBreath * 0.4 + easedOverdrive * 0.45
    );
    easedEnergy += (rawEnergy - easedEnergy) * ease;
    const energy = easedEnergy;

    // Smoothly offset right when on the Hub (/), and glide toward center on subpages or scroll
    const hubRightOffset =
      mobile.matches ? 0 : easedHubMix * (1 - Math.min(1, scroll * 3.2)) * (sceneWidth * 0.11);
    artwork.position.set(
      hubRightOffset + easedPointer.x * 0.12,
      easedPointer.y * -0.08,
      0
    );
    artwork.scale.setScalar(baseScale * (1 + travel * 0.16 + pulseEnergy * 0.05 + navBreath * 0.025));
    artwork.rotation.set(0, 0, Math.sin(angle * 0.5) * 0.07);

    prism.rotation.set(
      -0.06 + Math.sin(angle) * 0.18 + easedPointer.y * 0.04,
      angle - 0.13 + easedPointer.x * 0.05,
      0
    );
    light.rotation.copy(prism.rotation);

    const alignment = Math.pow(Math.max(0, Math.cos(prism.rotation.y)), 12);
    light.visible = alignment > 0.008;

    lightMaterials.forEach(({ material, opacity }) => {
      material.opacity = opacity * alignment * (1 + energy * 0.25);
    });

    bandMaterials.forEach(({ outer, inner, baseOuterOpacity, baseInnerOpacity, bandIndex }) => {
      const weight = currentBandWeights[bandIndex] ?? 1;
      const boost = 1 + energy * 0.25 + pulseEnergy * 0.35;
      outer.opacity = Math.min(1, baseOuterOpacity * weight * alignment * boost);
      inner.opacity = Math.min(1, baseInnerOpacity * weight * alignment * boost);
    });

    if (entryGlowSprite) {
      const s = 0.32 + pulseEnergy * 0.35 + energy * 0.12;
      entryGlowSprite.scale.set(s, s, 1);
    }

    // Shockwave ring expansion
    if (pulseEnergy > 0.01) {
      const ringProgress = 1 - pulseEnergy;
      const ringScale = 1 + ringProgress * 15;
      pulseRing.scale.setScalar(ringScale);
      pulseRingMat.opacity = pulseEnergy * 0.65;
    } else {
      pulseRingMat.opacity = 0;
    }

    edgeMaterial.opacity = 0.3 + (1 - alignment) * 0.34 + energy * 0.14 + easedXray * 0.45;
    rimMaterial.opacity = 0.14 + (1 - alignment) * 0.24 + energy * 0.2 + easedXray * 0.32;
    glass.uniforms.uTime.value = elapsed * 0.45 + scroll * 55;
    glass.uniforms.uEnergy.value = energy;
    glass.uniforms.uPulse.value = pulseEnergy;
    glass.uniforms.uXray.value = easedXray;

    // --- Moon animation (glides behind Prism apex in Eclipse mode!) ---
    const bobY = Math.sin(elapsed * 0.35) * 0.06;
    const bobX = Math.cos(elapsed * 0.22) * 0.04;
    const normalMoonX = moonBaseX + bobX - easedPointer.x * 0.08;
    const normalMoonY = moonBaseY + bobY - easedPointer.y * 0.05;
    const eclipseMoonX = artwork.position.x;
    const eclipseMoonY = artwork.position.y + 0.32;

    moonGroup.position.set(
      normalMoonX + (eclipseMoonX - normalMoonX) * easedEclipse,
      normalMoonY + (eclipseMoonY - normalMoonY) * easedEclipse,
      1 - easedEclipse * 1.8
    );

    const targetMoonScale = (mobile.matches ? 0.72 : 1.05) * (1 + easedEclipse * 0.85);
    moonMesh.scale.setScalar(targetMoonScale);

    moonMesh.rotation.y = elapsed * 0.08;
    moonMesh.rotation.x = Math.sin(elapsed * 0.15) * 0.06 + 0.1;

    moonMaterial.uniforms.uPhase.value = scroll;
    moonMaterial.uniforms.uTime.value = elapsed;
    moonMaterial.uniforms.uEnergy.value = energy;
    moonMaterial.uniforms.uEclipse.value = easedEclipse;

    for (let i = 0; i < lunarDustCount; i++) {
      const orbitAngle = elapsed * lunarOrbitSpeed[i] + lunarPhases[i];
      const r = lunarOrbitRadius[i] * (1 + easedEclipse * 0.5);
      lunarPos[i * 3] = Math.cos(orbitAngle) * r;
      lunarPos[i * 3 + 1] = Math.sin(orbitAngle) * r * 0.65 + Math.sin(elapsed * 0.2 + lunarPhases[i]) * 0.05;
      lunarPos[i * 3 + 2] = Math.sin(orbitAngle * 0.7 + lunarPhases[i]) * 0.3 - 0.5;
    }
    lunarPosAttr.needsUpdate = true;
    lunarDustMat.uniforms.uTime.value = elapsed;

    for (let i = 0; i < particleCount; i++) {
      const depth = (-dustPoints[i * 3 + 2] - 2) / 4;
      const x = wrap(origins[i * 2] + elapsed * velocities[i * 2]);
      const y = wrap(origins[i * 2 + 1] + elapsed * velocities[i * 2 + 1] + scroll * 0.06 * (1 - depth));
      dustPoints[i * 3] =
        (x - 0.5) * (sceneWidth + 1.2) +
        Math.sin(elapsed * 0.3 + phases[i]) * 0.08 -
        easedPointer.x * 0.07 * (1 - depth);
      dustPoints[i * 3 + 1] = (y - 0.5) * 8.4 - easedPointer.y * 0.05 * (1 - depth);
    }
    dustPosition.needsUpdate = true;
    dustMaterial.uniforms.uTime.value = elapsed;

    renderer.render(scene, camera);
    container.classList.add('is-ready');
  };

  const pause = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };
  const resume = () => {
    pause();
    if (!document.hidden && !signal.aborted && !reduced.matches && !lost) {
      lastTime = performance.now();
      scrollVelocity = 0;
      frame = requestAnimationFrame(render);
    }
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      pointer.set((event.clientX / innerWidth) * 2 - 1, (event.clientY / innerHeight) * 2 - 1);
    },
    { passive: true, signal }
  );
  document.addEventListener('pointerleave', () => pointer.set(0, 0), { signal });
  window.addEventListener('resize', resize, { signal });
  window.visualViewport?.addEventListener('resize', resize, { signal });
  const viewportObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
  viewportObserver?.observe(container);
  document.addEventListener('visibilitychange', resume, { signal });
  reduced.addEventListener(
    'change',
    () => {
      if (reduced.matches) container.classList.remove('is-ready');
      resume();
    },
    { signal }
  );
  canvas.addEventListener(
    'webglcontextlost',
    (event) => {
      event.preventDefault();
      lost = true;
      pause();
      container.classList.remove('is-ready');
    },
    { signal }
  );
  canvas.addEventListener(
    'webglcontextrestored',
    () => {
      lost = false;
      viewportKey = '';
      resize();
      resume();
    },
    { signal }
  );
  signal.addEventListener(
    'abort',
    () => {
      pause();
      viewportObserver?.disconnect();
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      container.classList.remove('is-ready');
      canvas.__prismActive = false;
    },
    { once: true }
  );
  resize();
  resume();
}
