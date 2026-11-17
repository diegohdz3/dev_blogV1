/* =====================================================================
   Landing effects — magnetic buttons + scroll parallax.
   Both are opt-in via data attributes and disabled for reduced motion
   or coarse pointers.
   ===================================================================== */

const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* --- magnetic buttons: CTAs ease toward the pointer, then spring back --- */
export function initMagneticButtons(signal: AbortSignal): void {
  if (prefersReduced() || !finePointer()) return;

  document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach(button => {
    let frame = 0;
    const strength = Number(button.dataset.magnetic) || 0.28;

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = button.getBoundingClientRect();
        const x = (event.clientX - (rect.left + rect.width / 2)) * strength;
        const y = (event.clientY - (rect.top + rect.height / 2)) * strength;
        button.style.setProperty('--mag-x', `${x}px`);
        button.style.setProperty('--mag-y', `${y}px`);
      });
    };

    const reset = () => {
      cancelAnimationFrame(frame);
      button.style.setProperty('--mag-x', '0px');
      button.style.setProperty('--mag-y', '0px');
    };

    button.addEventListener('pointermove', onMove, { signal });
    button.addEventListener('pointerleave', reset, { signal });
    button.addEventListener('blur', reset, { signal });
    signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  });
}

/* --- subtle scroll parallax on imagery --- */
export function initParallax(signal: AbortSignal): void {
  if (prefersReduced()) return;

  const layers = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax]'));
  if (!layers.length) return;

  if (!finePointer()) return;

  let frame = 0;
  const update = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const viewport = window.innerHeight;
      for (const layer of layers) {
        const rect = layer.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > viewport + 200) continue;
        const strength = Number(layer.dataset.parallax) || 24;
        const center = rect.top + rect.height / 2;
        const offset = (center - viewport / 2) / viewport;
        layer.style.setProperty('--parallax-y', `${(-offset * strength).toFixed(2)}px`);
      }
    });
  };

  window.addEventListener('scroll', update, { passive: true, signal });
  window.addEventListener('resize', update, { signal });
  signal.addEventListener('abort', () => cancelAnimationFrame(frame), { once: true });
  update();
}

export function initEffects(signal: AbortSignal): void {
  initMagneticButtons(signal);
  initParallax(signal);
}

