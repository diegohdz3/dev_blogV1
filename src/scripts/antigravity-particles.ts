/**
 * Google Antigravity-inspired interactive capsule/dash particle field.
 * Runs ONLY on the Dev Blog initial hub page (`[data-antigravity-hero]`).
 */

interface Particle {
  ox: number;
  oy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
  jitterAngle: number;
  influence: number;
}

function spectrumColorForAngle(angleRad: number): [number, number, number] {
  const stops: Array<[number, number, number]> = [
    [91, 108, 249],   // indigo blue
    [8, 247, 254],    // electric cyan
    [160, 131, 250],  // prism violet
    [255, 68, 102],   // coral crimson
    [255, 183, 77],   // warm amber
    [91, 108, 249],   // loop back cleanly
  ];
  const tNorm = ((angleRad + Math.PI) / (Math.PI * 2)) * (stops.length - 1);
  const idx = Math.min(stops.length - 2, Math.max(0, Math.floor(tNorm)));
  const frac = tNorm - idx;
  const a = stops[idx];
  const b = stops[idx + 1];
  return [
    Math.round(a[0] + (b[0] - a[0]) * frac),
    Math.round(a[1] + (b[1] - a[1]) * frac),
    Math.round(a[2] + (b[2] - a[2]) * frac),
  ];
}

export function initAntigravityParticles(signal: AbortSignal): void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-antigravity-hero]');
  if (!canvas || signal.aborted) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  if (reduced.matches || connection?.saveData) return;

  let width = 1;
  let height = 1;
  let dpr = 1;
  let particles: Particle[] = [];
  let rafId = 0;
  let lastTime = 0;
  let elapsed = 0;

  let rawX = -9999;
  let rawY = -9999;
  let mx = -9999;
  let my = -9999;
  let prevMx = -9999;
  let prevMy = -9999;
  let pointerInside = false;
  let activity = 0;

  const buildField = () => {
    const rect = canvas.parentElement?.getBoundingClientRect();
    width = Math.max(1, Math.round(rect?.width || window.innerWidth));
    height = Math.max(1, Math.round(rect?.height || window.innerHeight));
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const isMobile = width < 768;
    const spacing = isMobile ? 42 : 34;
    const cols = Math.ceil(width / spacing) + 2;
    const rows = Math.ceil(height / spacing) + 2;

    const list: Particle[] = [];
    for (let row = 0; row < rows; row++) {
      const hexOffset = row % 2 === 1 ? spacing * 0.5 : 0;
      for (let col = 0; col < cols; col++) {
        const jx = (Math.random() - 0.5) * spacing * 0.42;
        const jy = (Math.random() - 0.5) * spacing * 0.42;
        const ox = col * spacing + hexOffset + jx - spacing * 0.5;
        const oy = row * spacing + jy - spacing * 0.5;
        list.push({
          ox,
          oy,
          x: ox,
          y: oy,
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2,
          jitterAngle: Math.random() * Math.PI * 2,
          influence: 0,
        });
      }
    }
    particles = list;
  };

  const render = (now: number) => {
    rafId = 0;
    if (signal.aborted || document.hidden || reduced.matches) return;
    rafId = requestAnimationFrame(render);

    const dt = Math.min((now - lastTime) / 1000 || 0.016, 0.05);
    lastTime = now;
    elapsed += dt;

    if (pointerInside && rawX > -1000) {
      if (mx < -1000) {
        mx = rawX;
        my = rawY;
        prevMx = rawX;
        prevMy = rawY;
      }
      const follow = 1 - Math.exp(-dt * 12);
      prevMx = mx;
      prevMy = my;
      mx += (rawX - mx) * follow;
      my += (rawY - my) * follow;
      activity += (1 - activity) * (1 - Math.exp(-dt * 8));
    } else {
      activity += (0 - activity) * (1 - Math.exp(-dt * 3));
    }

    const cursorVx = (mx - prevMx) / Math.max(dt, 0.008);
    const cursorVy = (my - prevMy) / Math.max(dt, 0.008);
    const cursorSpeed = Math.min(1.8, Math.hypot(cursorVx, cursorVy) / 520);

    ctx.clearRect(0, 0, width, height);

    const ringRadius = Math.min(width, height) * 0.21 + cursorSpeed * 28;
    const maxReach = ringRadius + 150;
    const springK = 48;
    const damping = 9.5;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      const breathX = Math.sin(elapsed * 0.55 + p.phase) * 1.6;
      const breathY = Math.cos(elapsed * 0.48 + p.phase * 1.13) * 1.6;
      const targetHomeX = p.ox + breathX;
      const targetHomeY = p.oy + breathY;

      let targetInfluence = 0;
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.hypot(dx, dy);

      if (activity > 0.01 && dist < maxReach && dist > 0.5) {
        const nx = dx / dist;
        const ny = dy / dist;

        const radialBand = Math.exp(-Math.pow((dist - ringRadius * 0.68) / 108, 2));
        const innerPush = Math.max(0, 1 - dist / maxReach);
        const wave = (radialBand * 0.85 + innerPush * 0.45) * activity;
        targetInfluence = Math.min(1, wave * (0.95 + cursorSpeed * 0.45));

        const pushForce = (480 + cursorSpeed * 640) * wave;
        p.vx += (nx * pushForce + cursorVx * 0.35 * wave) * dt;
        p.vy += (ny * pushForce + cursorVy * 0.35 * wave) * dt;
      }

      const fx = -springK * (p.x - targetHomeX) - damping * p.vx;
      const fy = -springK * (p.y - targetHomeY) - damping * p.vy;
      p.vx += fx * dt;
      p.vy += fy * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.influence += (targetInfluence - p.influence) * (1 - Math.exp(-dt * 10));

      const inf = p.influence;
      if (inf < 0.03) {
        const baseAlpha = 0.14 + 0.08 * Math.sin(elapsed * 0.7 + p.phase);
        ctx.fillStyle = `rgba(210, 220, 232, ${baseAlpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.05, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const angle = dist > 0.5 ? Math.atan2(dy, dx) : p.jitterAngle;
        const len = 2.5 + inf * 10.5;
        const thickness = 1.45 + inf * 1.45;
        const [r, g, b] = spectrumColorForAngle(angle + elapsed * 0.18);
        const alpha = Math.min(0.92, 0.24 + inf * 0.72);

        const hx = Math.cos(angle) * (len * 0.5);
        const hy = Math.sin(angle) * (len * 0.5);

        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x - hx, p.y - hy);
        ctx.lineTo(p.x + hx, p.y + hy);
        ctx.stroke();
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    if (e.clientY < rect.top || e.clientY > rect.bottom) {
      pointerInside = false;
      return;
    }
    rawX = e.clientX - rect.left;
    rawY = e.clientY - rect.top;
    pointerInside = true;
  };

  const onPointerLeave = () => {
    pointerInside = false;
  };

  const start = () => {
    cancelAnimationFrame(rafId);
    if (!document.hidden && !signal.aborted && !reduced.matches) {
      lastTime = performance.now();
      rafId = requestAnimationFrame(render);
    }
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true, signal });
  document.addEventListener('pointerleave', onPointerLeave, { signal });
  window.addEventListener('resize', buildField, { passive: true, signal });
  document.addEventListener('visibilitychange', start, { signal });

  signal.addEventListener(
    'abort',
    () => {
      cancelAnimationFrame(rafId);
      particles = [];
    },
    { once: true }
  );

  buildField();
  start();
}
