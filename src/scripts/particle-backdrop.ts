// Lightweight, independent dust particles for case-study backgrounds.
export function initParticleBackdrop(signal: AbortSignal) {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-particle-backdrop]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx || signal.aborted) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const particles = Array.from({ length: 220 }, () => ({
    x: Math.random(), y: Math.random(), radius: .6 + Math.random() * 1.2,
    vx: (Math.random() - .5) * 7, vy: -3 - Math.random() * 6,
    alpha: .3 + Math.random() * .45, phase: Math.random() * Math.PI * 2,
  }));
  let width = 1, height = 1, count = 80, frame = 0, last = 0, time = 0;
  const moving = () => !reduced.matches && !connection?.saveData;

  function draw(delta: number) {
    time += delta;
    ctx!.clearRect(0, 0, width, height);
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.x = (p.x + p.vx * delta / width + 1) % 1;
      p.y = (p.y + p.vy * delta / height + 1) % 1;
      const x = p.x * width, y = p.y * height;
      ctx!.fillStyle = `rgba(192, 218, 232, ${p.alpha * (.8 + .2 * Math.sin(time * .6 + p.phase))})`;
      ctx!.beginPath();
      ctx!.arc(x, y, p.radius, 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  function tick(now: number) {
    draw(last ? Math.min((now - last) / 1000, .05) : 0);
    last = now;
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    last = 0;
    if (signal.aborted) return;
    draw(0);
    if (!document.hidden && moving()) frame = requestAnimationFrame(tick);
  }

  function resize() {
    width = canvas!.clientWidth || window.innerWidth;
    height = canvas!.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, width <= 768 ? 1 : 1.5);
    canvas!.width = Math.round(width * dpr);
    canvas!.height = Math.round(height * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    count = Math.min(width <= 768 ? 85 : particles.length, Math.max(45, Math.round(width * height / 8000)));
    sync();
  }

  window.addEventListener('resize', resize, { passive: true, signal });
  document.addEventListener('visibilitychange', sync, { signal });
  reduced.addEventListener('change', sync, { signal });
  signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  resize();
}
