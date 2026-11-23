import { initEffects } from './effects';
import { initHeroScene, type PrismCategory } from './hero-scene';
import { initParticleBackdrop } from './particle-backdrop';
import { syncBlogFromCms } from './cms-live';

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

  // 3. Thoughts v2 Category Segment System + Interactive Schematic Prism Ray Resonance
  const tabs = document.querySelectorAll<HTMLButtonElement>('.thoughts__tab[data-tab]');
  const panels = document.querySelectorAll<HTMLElement>('.thoughts__panel[data-panel]');
  const diagram = document.getElementById('th2Diagram');
  const wlText = document.getElementById('th2WavelengthText');
  const wlDot = document.getElementById('th2WavelengthDot');

  const RAY_META: Record<string, { color: string; text: string }> = {
    all: { color: '#ffffff', text: 'λ 380–700nm · full spectrum' },
    personal: { color: '#ff6b81', text: 'λ 650nm · personal' },
    opinions: { color: '#f5c542', text: 'λ 590nm · opinion' },
    tutorials: { color: '#3ddbd9', text: 'λ 490nm · tutorial' },
    architecture: { color: '#7c8cff', text: 'λ 410nm · case study' },
  };

  let activeTabKey = 'all';

  function setDiagramRay(rayKey: string): void {
    const meta = RAY_META[rayKey] || RAY_META.all;
    if (diagram) diagram.dataset.activeRay = rayKey;
    if (wlText) wlText.textContent = meta.text;
    if (wlDot) {
      wlDot.style.background = meta.color;
      wlDot.style.boxShadow = `0 0 10px ${meta.color}`;
    }
  }

  interface InspectorItem {
    slug: string;
    href: string;
    num: string;
    title: string;
    lead: string;
    category: string;
    categoryShort: string;
    color: string;
    wavelength: string;
    dateDisplay: string;
    readingTime: number;
    roleSummary: string;
    toc: Array<{ id: string; label: string }>;
    snippetHeading: string;
    snippetBody: string;
    snippetCode: string;
  }

  function updateInspectorBySlug(slug: string): void {
    const dataEl = document.getElementById('th2InspectorData');
    const cardEl = document.getElementById('th2InspectorCard');
    if (!dataEl || !cardEl || !slug) return;
    let list: InspectorItem[] = [];
    try {
      list = JSON.parse(dataEl.textContent || '[]') as InspectorItem[];
    } catch {
      return;
    }
    const item = list.find((i) => i.slug === slug);
    if (!item) return;

    cardEl.style.setProperty('--inspect-color', item.color);
    const dotEl = document.getElementById('th2InspectDot');
    if (dotEl) dotEl.style.background = item.color;
    const wlEl = document.getElementById('th2InspectWavelength');
    if (wlEl) {
      wlEl.textContent = item.wavelength;
      wlEl.style.color = item.color;
    }
    const numEl = document.getElementById('th2InspectNum');
    if (numEl) numEl.textContent = `#${item.num}`;

    const titleLink = document.getElementById('th2InspectTitleLink') as HTMLAnchorElement | null;
    if (titleLink) {
      titleLink.textContent = item.title;
      titleLink.href = item.href;
    }

    const metaEl = document.getElementById('th2InspectMeta');
    if (metaEl) {
      metaEl.innerHTML = `<span>${item.dateDisplay}</span><span>&middot;</span><span>${item.readingTime} min read</span><span>&middot;</span><span>${item.roleSummary}</span>`;
    }

    const tocEl = document.getElementById('th2InspectToc');
    if (tocEl) {
      tocEl.innerHTML = (item.toc || [])
        .map(
          (sec, idx) =>
            `<li><a href="${item.href}#${sec.id}" data-nav><span class="th2__inspector-toc-idx">${String(
              idx + 1
            ).padStart(2, '0')}</span><span class="th2__inspector-toc-text">${sec.label}</span></a></li>`
        )
        .join('');
    }

    const snipLabel = document.getElementById('th2InspectSnippetLabel');
    if (snipLabel) snipLabel.textContent = `> preview // ${item.snippetHeading.toLowerCase()}`;
    const snipBody = document.getElementById('th2InspectSnippetBody');
    if (snipBody) snipBody.textContent = item.snippetBody;

    const snipCode = document.getElementById('th2InspectSnippetCode');
    if (snipCode) {
      const codeInner = snipCode.querySelector('code');
      if (item.snippetCode) {
        if (codeInner) codeInner.textContent = item.snippetCode;
        snipCode.style.display = '';
      } else {
        snipCode.style.display = 'none';
      }
    }

    const openBtn = document.getElementById('th2InspectOpenBtn') as HTMLAnchorElement | null;
    if (openBtn) {
      openBtn.href = item.href;
      openBtn.style.borderColor = item.color;
    }
    const copyBtn = document.getElementById('th2InspectCopyBtn');
    if (copyBtn) copyBtn.setAttribute('data-copy-href', item.href);
  }

  tabs.forEach((tab) => {
    tab.addEventListener(
      'click',
      () => {
        const target = tab.dataset.tab as PrismCategory | undefined;
        if (!target) return;

        activeTabKey = target;
        setDiagramRay(target);

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
          const firstSlug = panel.querySelector<HTMLElement>('[data-inspect-slug]')?.dataset.inspectSlug;
          if (firstSlug) updateInspectorBySlug(firstSlug);
          requestAnimationFrame(() => {
            panel.classList.add('panel-enter');
            panel.querySelectorAll<HTMLElement>('.anim').forEach((el) => el.classList.add('visible'));
          });
        }
      },
      { signal }
    );

    tab.addEventListener(
      'mouseenter',
      () => {
        const target = tab.dataset.tab;
        if (target) setDiagramRay(target);
      },
      { signal }
    );

    tab.addEventListener(
      'mouseleave',
      () => {
        setDiagramRay(activeTabKey);
      },
      { signal }
    );
  });

  const thoughtsSection = document.getElementById('thoughts');
  if (thoughtsSection) {
    thoughtsSection.addEventListener(
      'pointerover',
      (e) => {
        const item = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-prism-hover]');
        if (item?.dataset.prismHover) {
          setDiagramRay(item.dataset.prismHover);
        }
        const inspectTarget = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-inspect-slug]');
        if (inspectTarget?.dataset.inspectSlug) {
          updateInspectorBySlug(inspectTarget.dataset.inspectSlug);
        }
      },
      { signal, passive: true }
    );
    thoughtsSection.addEventListener(
      'pointerleave',
      () => {
        setDiagramRay(activeTabKey);
      },
      { signal, passive: true }
    );
  }

  // Live Instant Filter / Search Input on /thoughts
  const searchInput = document.getElementById('th2SearchInput') as HTMLInputElement | null;
  if (searchInput) {
    searchInput.addEventListener(
      'input',
      () => {
        const q = searchInput.value.trim().toLowerCase();
        const items = document.querySelectorAll<HTMLElement>('#thoughts [data-search-text]');
        let firstMatchSlug = '';
        items.forEach((el) => {
          const hay = (el.dataset.searchText || '').toLowerCase();
          const matched = !q || hay.includes(q);
          el.style.display = matched ? '' : 'none';
          if (matched && !firstMatchSlug && el.dataset.inspectSlug) {
            firstMatchSlug = el.dataset.inspectSlug;
          }
        });
        if (firstMatchSlug) updateInspectorBySlug(firstMatchSlug);
      },
      { signal }
    );

    window.addEventListener(
      'keydown',
      (e) => {
        if (
          e.key === '/' &&
          document.activeElement !== searchInput &&
          !(document.activeElement instanceof HTMLInputElement) &&
          !(document.activeElement instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          searchInput.focus();
        }
      },
      { signal }
    );
  }

  // Full Thought Reader: Reading Progress Meter + Scroll-Spy Section TOC
  const readFill = document.getElementById('th2ReadFill');
  const readPercent = document.getElementById('th2ReadPercent');
  const updateReaderScroll = () => {
    const bodyEl = document.getElementById('articleBody');
    if (!bodyEl) return;
    const rect = bodyEl.getBoundingClientRect();
    const totalScrollable = Math.max(1, bodyEl.offsetHeight - window.innerHeight * 0.55);
    const scrolled = Math.min(Math.max(0, -rect.top + window.innerHeight * 0.25), totalScrollable);
    const pct = Math.round((scrolled / totalScrollable) * 100);
    const fillEl = document.getElementById('th2ReadFill');
    const pctEl = document.getElementById('th2ReadPercent');
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;

    const secEls = document.querySelectorAll<HTMLElement>('[data-reader-section]');
    const tocLinks = document.querySelectorAll<HTMLElement>('[data-toc-target]');
    if (secEls.length > 0 && tocLinks.length > 0) {
      let currentId = secEls[0].dataset.readerSection || '';
      secEls.forEach((sec) => {
        if (sec.getBoundingClientRect().top <= window.innerHeight * 0.35) {
          currentId = sec.dataset.readerSection || currentId;
        }
      });
      tocLinks.forEach((link) => {
        link.classList.toggle('is-active', link.dataset.tocTarget === currentId);
      });
    }
  };
  if (readFill || readPercent || document.getElementById('liveArticleRoot')) {
    window.addEventListener('scroll', () => requestAnimationFrame(updateReaderScroll), {
      passive: true,
      signal,
    });
    updateReaderScroll();
  }

  // Delegated Copy Code, Copy Thread Link, and Scroll Top actions (works for both static & live CMS HTML)
  document.addEventListener(
    'click',
    async (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const copyCodeBtn = target.closest<HTMLButtonElement>('[data-copy-code]');
      if (copyCodeBtn) {
        const codeEl = copyCodeBtn.closest('.th-article__code')?.querySelector('code');
        if (!codeEl) return;
        try {
          await navigator.clipboard.writeText(codeEl.textContent || '');
          const prev = copyCodeBtn.textContent;
          copyCodeBtn.textContent = '[ copied ✓ ]';
          copyCodeBtn.classList.add('is-copied');
          setTimeout(() => {
            copyCodeBtn.textContent = prev;
            copyCodeBtn.classList.remove('is-copied');
          }, 1800);
        } catch {}
        return;
      }

      const copyHrefBtn = target.closest<HTMLButtonElement>('[data-copy-href]');
      if (copyHrefBtn) {
        const rawHref = copyHrefBtn.getAttribute('data-copy-href') || window.location.pathname;
        const fullUrl = new URL(rawHref, window.location.origin).href;
        try {
          await navigator.clipboard.writeText(fullUrl);
          const prev = copyHrefBtn.textContent;
          copyHrefBtn.textContent = '[ link copied ✓ ]';
          setTimeout(() => {
            copyHrefBtn.textContent = prev;
          }, 1800);
        } catch {}
        return;
      }

      const topBtn = target.closest<HTMLButtonElement>('[data-scroll-top]');
      if (topBtn) {
        window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      }
    },
    { signal }
  );

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
  void syncBlogFromCms();
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
