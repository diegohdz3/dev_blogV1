import { initEffects } from './effects';
import { initHeroScene, type PrismCategory } from './hero-scene';
import { initParticleBackdrop } from './particle-backdrop';

let pageController: AbortController | null = null;
let routerInstalled = false;
let isNavigating = false;
const pageCache = new Map<string, string>();

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const normalizePath = (p: string) => p.replace(/\/index\.html$/, '').replace(/\/$/, '') || '/';

async function fetchPageHtml(url: string): Promise<string | null> {
  const key = new URL(url, window.location.origin).pathname;
  const cached = pageCache.get(key);
  if (cached) return cached;
  try {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) return null;
    const html = await res.text();
    pageCache.set(key, html);
    return html;
  } catch {
    return null;
  }
}

async function navigateStage(href: string, pushHistory = true): Promise<void> {
  if (isNavigating) return;
  const targetUrl = new URL(href, window.location.origin);

  // If same page without hash change, smoothly scroll to top
  if (normalizePath(targetUrl.pathname) === normalizePath(window.location.pathname) && !targetUrl.hash) {
    window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
    return;
  }

  const stage = document.getElementById('blogStage');
  if (!stage || reducedMotion()) {
    window.location.href = targetUrl.href;
    return;
  }

  isNavigating = true;

  // Start fetching in parallel with the soft stage fade-out
  const htmlPromise = fetchPageHtml(targetUrl.href);
  stage.classList.remove('stage-enter');
  stage.classList.add('stage-leave');

  const [html] = await Promise.all([
    htmlPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 260)),
  ]);

  if (!html) {
    isNavigating = false;
    window.location.href = targetUrl.href;
    return;
  }

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nextStage = doc.getElementById('blogStage');
  const nextNav = doc.getElementById('subNav');

  if (!nextStage) {
    isNavigating = false;
    window.location.href = targetUrl.href;
    return;
  }

  if (pushHistory) {
    window.history.pushState({ path: targetUrl.href }, '', targetUrl.href);
  }

  // Update document metadata & body attributes without touching #prismBackdrop or #prismHud
  document.title = doc.title || document.title;
  document.body.className = doc.body.className;
  if (doc.body.dataset.page) {
    document.body.dataset.page = doc.body.dataset.page;
  }

  const currentNav = document.getElementById('subNav');
  if (currentNav && nextNav) {
    currentNav.replaceWith(nextNav);
  }

  stage.innerHTML = nextStage.innerHTML;
  if (nextStage.dataset.page) {
    stage.dataset.page = nextStage.dataset.page;
  }

  if (targetUrl.hash) {
    const hashTarget = document.querySelector(targetUrl.hash);
    if (hashTarget) {
      hashTarget.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  } else {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  // Re-bind page-specific interactions and notify the persistent 3D Prism
  bootPageInteractions();
  void initHeroScene();

  stage.classList.remove('stage-leave');
  void stage.offsetWidth; // trigger reflow for smooth enter animation
  stage.classList.add('stage-enter');

  setTimeout(() => {
    stage.classList.remove('stage-enter');
    isNavigating = false;
  }, 520);
}

function installStageRouter(): void {
  if (routerInstalled) return;
  routerInstalled = true;

  // Cache initial page HTML
  pageCache.set(window.location.pathname, document.documentElement.outerHTML);

  // Prefetch internal pages on pointer hover for 0ms navigation latency
  document.addEventListener(
    'pointerover',
    (e) => {
      const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
      void fetchPageHtml(url.href);
    },
    { passive: true }
  );

  // Intercept internal link clicks so the 3D WebGL Prism never reloads or drops a frame
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const link = (e.target as HTMLElement | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) return;

    e.preventDefault();
    void navigateStage(url.href, true);
  });

  // Handle browser Back / Forward buttons seamlessly
  window.addEventListener('popstate', () => {
    void navigateStage(window.location.href, false);
  });
}

function bootPageInteractions(): void {
  pageController?.abort();
  pageController = new AbortController();
  const { signal } = pageController;

  initEffects(signal);
  void initParticleBackdrop(signal);

  // 1. Hub Nav Magnetic & Subtle Chromatic Glitch (from dev_blog_pasado/js/index.js)
  const hubBtns = document.querySelectorAll<HTMLElement>('.hub-nav__btn');
  hubBtns.forEach((btn) => {
    btn.addEventListener(
      'mousemove',
      (e) => {
        if (
          !window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
          reducedMotion()
        )
          return;
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.1;
        const y = (e.clientY - r.top - r.height / 2) * 0.1;
        btn.style.transform = `translate(${x}px, ${y}px)`;
      },
      { signal }
    );

    btn.addEventListener(
      'mouseleave',
      () => {
        btn.style.transform = 'translate(0, 0)';
      },
      { signal }
    );
  });

  // Subtle random glitch on hub buttons
  let glitchTimer = 0;
  function randomGlitch(): void {
    if (signal.aborted || hubBtns.length === 0) return;
    if (
      reducedMotion() ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      return;

    const randomBtn = hubBtns[Math.floor(Math.random() * hubBtns.length)];
    const label = randomBtn.querySelector<HTMLElement>('.hub-nav__label');
    if (label) {
      label.style.textShadow = '-1px 0 #ff2e63, 1px 0 #08f7fe';
      label.style.transform = `translate(${Math.random() * 2 - 1}px, ${Math.random() * 2 - 1}px)`;
      setTimeout(() => {
        label.style.textShadow = 'none';
        label.style.transform = 'translate(0, 0)';
      }, 90);
    }
    glitchTimer = window.setTimeout(randomGlitch, 4000 + Math.random() * 5000);
  }
  glitchTimer = window.setTimeout(randomGlitch, 2800);
  signal.addEventListener('abort', () => clearTimeout(glitchTimer), { once: true });

  // 2. Section-level & Element-level IntersectionObservers (from dev_blog_pasado/js/nav.js)
  const indicatorEl = document.getElementById('subNavIndicator');
  const sections = document.querySelectorAll<HTMLElement>('.hero, .about, .projects, .thoughts, .pj-hero, .contact');
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          const sectionIndicator = (entry.target as HTMLElement).dataset.sectionIndicator;
          if (sectionIndicator && indicatorEl) {
            indicatorEl.textContent = sectionIndicator;
          }
        }
      });
    },
    { threshold: 0.15 }
  );
  sections.forEach((sec) => sectionObserver.observe(sec));
  signal.addEventListener('abort', () => sectionObserver.disconnect(), { once: true });

  const animEls = document.querySelectorAll<HTMLElement>('.anim');
  const elementObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          elementObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -16px 0px' }
  );
  animEls.forEach((el) => elementObserver.observe(el));
  signal.addEventListener('abort', () => elementObserver.disconnect(), { once: true });

  // Immediately trigger in-view for initial hero
  requestAnimationFrame(() => {
    document.querySelector('.subpage-hero')?.classList.add('in-view');
  });

  // 3. Thoughts Category Tab System (switches panels smoothly without altering the Prism's original colors)
  const tabs = document.querySelectorAll<HTMLButtonElement>('.thoughts__tab[data-tab]');
  const panels = document.querySelectorAll<HTMLElement>('.thoughts__panel[data-panel]');

  tabs.forEach((tab) => {
    tab.addEventListener(
      'click',
      () => {
        const target = tab.dataset.tab as PrismCategory | undefined;
        if (!target) return;

        tabs.forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        panels.forEach((p) => {
          p.classList.remove('is-active', 'panel-enter');
        });

        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');

        const panel = document.querySelector<HTMLElement>(`.thoughts__panel[data-panel="${target}"]`);
        if (panel) {
          panel.classList.add('is-active');
          requestAnimationFrame(() => {
            panel.classList.add('panel-enter');
            panel.querySelectorAll<HTMLElement>('.anim').forEach((el) => el.classList.add('visible'));
          });
        }
      },
      { signal }
    );
  });

  // 4. Projects Card Mouse-Tracking Glow + Category Filter
  const cards = document.querySelectorAll<HTMLElement>('.card');
  cards.forEach((card) => {
    card.addEventListener(
      'mousemove',
      (e) => {
        if (reducedMotion()) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
      },
      { signal }
    );
  });

  const projectFilters = document.querySelectorAll<HTMLElement>('[data-project-filter]');
  const projectCards = document.querySelectorAll<HTMLElement>('[data-project-card]');
  projectFilters.forEach((btn) => {
    btn.addEventListener(
      'click',
      () => {
        const filter = btn.dataset.projectFilter || 'all';
        projectFilters.forEach((b) => b.classList.toggle('is-active', b === btn));
        projectCards.forEach((card) => {
          const match = filter === 'all' || card.dataset.projectCard === filter;
          card.style.display = match ? '' : 'none';
        });
      },
      { signal }
    );
  });

  // 5. Scroll-driven Timeline Progress Line (from dev_blog_pasado/js/project-detail.js)
  const timelineLine = document.querySelector<HTMLElement>('.pj-timeline__line');
  const timelineSection = document.querySelector<HTMLElement>('#timeline');
  if (timelineLine && timelineSection) {
    const updateTimelineLine = () => {
      const rect = timelineSection.getBoundingClientRect();
      const windowH = window.innerHeight;
      if (rect.top < windowH && rect.bottom > 0) {
        const sectionVisible = Math.min(
          Math.max((windowH - rect.top) / (rect.height + windowH * 0.3), 0),
          1
        );
        timelineLine.style.setProperty('--line-progress', String(sectionVisible));
      }
    };
    window.addEventListener('scroll', () => requestAnimationFrame(updateTimelineLine), {
      passive: true,
      signal,
    });
    updateTimelineLine();
  }

  // 6. Code Block Copy Button
  document.querySelectorAll<HTMLButtonElement>('[data-copy-code]').forEach((btn) => {
    btn.addEventListener(
      'click',
      async () => {
        const codeEl = btn.closest('.th-article__code')?.querySelector('code');
        if (!codeEl) return;
        try {
          await navigator.clipboard.writeText(codeEl.textContent || '');
          const prev = btn.textContent;
          btn.textContent = '[ copied ✓ ]';
          btn.classList.add('is-copied');
          setTimeout(() => {
            btn.textContent = prev;
            btn.classList.remove('is-copied');
          }, 1800);
        } catch {
          // ignore clipboard error
        }
      },
      { signal }
    );
  });

  // 7. Smooth scroll for in-page anchor links (#articleBody, etc.)
  document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]').forEach((link) => {
    link.addEventListener(
      'click',
      (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        }
      },
      { signal }
    );
  });
}

function bootBlog(): void {
  installStageRouter();
  bootPageInteractions();
  void initHeroScene();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootBlog, { once: true });
} else {
  bootBlog();
}
