import type { CmsCanvasBlock, CmsDocument } from '../lib/cms';

type Category = 'tutorials' | 'architecture' | 'opinions' | 'personal';

interface LiveArticle {
  document_id: string;
  slug: string;
  title: string;
  heroTag: string;
  counterNum: string;
  counterLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  lead: string;
  category: Category;
  categoryLabel: string;
  dateDisplay: string;
  readingTime: number;
  roleSummary: string;
  repoUrl?: string;
  frozenTemplateName: string;
  blocks: CmsCanvasBlock[];
}

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeCategory(rawTag?: string, heroCategory?: string): Category {
  const combined = `${rawTag || ''} ${heroCategory || ''}`.toLowerCase();
  if (combined.includes('tutorial') || combined.includes('sql')) return 'tutorials';
  if (combined.includes('opinion') || combined.includes('psych')) return 'opinions';
  if (combined.includes('personal') || combined.includes('heart')) return 'personal';
  return 'architecture';
}

function mapDoc(doc: CmsDocument, index: number): LiveArticle {
  const blocks = [...(doc.canvas_blocks || [])].sort((a, b) => a.order_index - b.order_index);
  const heroBlock = blocks.find((b) => b.block_type === 'CASE_HERO');
  const firstParagraph = blocks.find((b) => b.block_type === 'PARAGRAPH' || b.block_type === 'OVERVIEW_SECTION');
  const meta = doc.metadata_values || {};
  const category = normalizeCategory(meta.canonical_tag, heroBlock?.content_payload?.category);
  const labels: Record<Category, string> = {
    tutorials: '/ tutorial',
    architecture: '/ full-stack',
    opinions: '/ opinion',
    personal: '/ personal',
  };

  return {
    document_id: doc.document_id,
    slug: doc.slug,
    title: doc.title,
    heroTag:
      heroBlock?.content_payload?.tag ||
      (category === 'architecture' ? `< project / 0${index + 1} />` : `< thought / 0${index + 1} />`),
    counterNum: heroBlock?.content_payload?.counter_num || `02.${index + 1}`,
    counterLabel: heroBlock?.content_payload?.counter_label || category,
    heroTitle: heroBlock?.content_payload?.title || doc.title,
    heroSubtitle: heroBlock?.content_payload?.subtitle || '',
    lead:
      heroBlock?.content_payload?.lead ||
      firstParagraph?.content_payload?.text ||
      'Technical article and engineering notes by Diego Cortés Hernandez.',
    category,
    categoryLabel: labels[category],
    dateDisplay:
      heroBlock?.content_payload?.date ||
      (doc.published_at
        ? new Date(doc.published_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : '2026'),
    readingTime: Number(meta.reading_time) || 5,
    roleSummary: String(meta.role_summary || 'Full-Stack & Frontend Engineering'),
    repoUrl: meta.repo_url ? String(meta.repo_url) : undefined,
    frozenTemplateName: doc.frozen_template?.name || 'Plantilla Bitácora Técnica (CMS)',
    blocks,
  };
}

export function resolveCmsBaseUrl(): string {
  const qsCms = new URLSearchParams(window.location.search).get('cms');
  if (qsCms) {
    try {
      sessionStorage.setItem('cms_api_url', qsCms);
    } catch {
      // ignore storage errors
    }
  }
  let stored = '';
  try {
    stored = sessionStorage.getItem('cms_api_url') || '';
  } catch {
    // ignore
  }
  const envUrl = import.meta.env.PUBLIC_CMS_API_URL || '';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return (qsCms || stored || envUrl || (isLocal ? 'http://127.0.0.1:4000' : 'https://cms-core-api-production.up.railway.app')).replace(/\/+$/, '');
}

function splitHeading(text: string): { before: string; em: string } {
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return { before: '', em: text.trim() };
  return { before: words.slice(0, -1).join(' '), em: words[words.length - 1] };
}

function sanitizeInlineHtml(html: string): string {
  return html.replace(/<\/?(?!(?:strong|b|em|i|code|a|br)\b)[^>]*>/gi, '');
}

function renderArticleBlocksHtml(blocks: CmsCanvasBlock[], cmsBase: string): string {
  const contentBlocks = blocks.filter((b) => b.block_type !== 'CASE_HERO');
  let sectionIdx = 0;
  let currentItems: CmsCanvasBlock[] = [];
  let currentHeading: string | undefined;
  let currentEyebrow: string | undefined;
  const htmlParts: string[] = [];

  const flushEditorial = () => {
    if (!currentHeading && currentItems.length === 0) return;
    const headingParts = currentHeading ? splitHeading(currentHeading) : null;
    const isAlt = sectionIdx % 2 === 1;
    sectionIdx++;

    const innerHtml = currentItems
      .map((item) => {
        const p = item.content_payload || {};
        if (item.block_type === 'HEADING') {
          return `<h3 class="th-article__subheading">${esc(p.text || '')}</h3>`;
        }
        if (item.block_type === 'PARAGRAPH') {
          if (p.divider) return `<hr class="th-article__divider" />`;
          const paras = String(p.text || '')
            .split(/\n\n+/)
            .filter(Boolean)
            .map((t) => `<p>${esc(t)}</p>`)
            .join('');
          const bodyHtml = typeof p.html === 'string' ? `<p>${sanitizeInlineHtml(p.html)}</p>` : paras;
          const list = Array.isArray(p.list) ? p.list : [];
          const listHtml = list.length
            ? p.ordered
              ? `<ol class="th-article__list th-article__list--ordered">${list.map((li) => `<li>${esc(li)}</li>`).join('')}</ol>`
              : `<ul class="th-article__list">${list.map((li) => `<li>${esc(li)}</li>`).join('')}</ul>`
            : '';
          return bodyHtml + listHtml;
        }
        if (item.block_type === 'CODE') {
          return `<div class="th-article__code">
            <div class="th-article__code-header">
              <span class="th-article__code-lang">${esc(p.language || 'code')}</span>
              <div class="th-article__code-actions">
                ${p.filename ? `<span class="th-article__code-file">${esc(p.filename)}</span>` : ''}
                <button type="button" class="th-article__code-copy" data-copy-code>[ copy ]</button>
              </div>
            </div>
            <pre><code>${esc(p.code || '')}</code></pre>
          </div>`;
        }
        if (item.block_type === 'IMAGE_GALLERY') {
          const imgs = Array.isArray(p.images) ? p.images : [];
          return imgs
            .filter((img: { url?: string }) => img?.url)
            .map((img: { url: string; caption?: string }) => {
              const src = img.url.startsWith('/uploads/') ? `${cmsBase}${img.url}` : img.url;
              return `<figure class="th-article__figure"><img src="${esc(src)}" alt="${esc(img.caption || '')}" loading="lazy" />${
                img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''
              }</figure>`;
            })
            .join('');
        }
        if (item.block_type === 'QUOTE' || item.block_type === 'CALLOUT') {
          const isWarn = item.block_type === 'CALLOUT' && p.tone === 'warning';
          const text =
            item.block_type === 'CALLOUT'
              ? esc(p.text || p.message || p.quote || '')
              : `&ldquo;${esc(p.text || p.quote || '')}&rdquo;`;
          return `<div class="th-article__callout ${isWarn ? 'th-article__callout--warning' : ''}">
            <div class="th-article__callout-line"></div>
            <blockquote>${text}</blockquote>
          </div>`;
        }
        return '';
      })
      .join('');

    htmlParts.push(`
      <section class="th-article__section ${isAlt ? 'th-article__section--alt' : ''}">
        <div class="th-article__block">
          ${currentEyebrow ? `<span class="section__eyebrow">${esc(currentEyebrow)}</span>` : ''}
          ${
            headingParts
              ? `<h2 class="th-article__heading">${headingParts.before ? `${esc(headingParts.before)} ` : ''}<em>${esc(headingParts.em)}</em></h2>`
              : ''
          }
          <div class="th-article__body">${innerHtml}</div>
        </div>
      </section>`);

    currentItems = [];
    currentHeading = undefined;
    currentEyebrow = undefined;
  };

  for (const block of contentBlocks) {
    const p = block.content_payload || {};
    if (block.block_type === 'OVERVIEW_SECTION') {
      flushEditorial();
      const paras = String(p.text || '')
        .split(/\n\n+/)
        .filter(Boolean)
        .map((t) => `<p>${esc(t)}</p>`)
        .join('');
      const heading = splitHeading(String(p.heading || 'Overview'));
      htmlParts.push(`<section class="pj-section">
        <div class="pj-section__grid">
          <div class="pj-section__left">
            <span class="section__eyebrow">${esc(p.eyebrow || '/ overview')}</span>
            <h2 class="pj-section__title">${heading.before ? `${esc(heading.before)} ` : ''}<em>${esc(heading.em)}</em></h2>
          </div>
          <div class="pj-section__right">${paras}</div>
        </div>
      </section>`);
    } else if (block.block_type === 'HEADING' && Number(p.level) !== 3) {
      flushEditorial();
      sectionIdx++;
      currentEyebrow = String(p.eyebrow || `/ section 0${sectionIdx}`);
      currentHeading = String(p.text || '');
    } else {
      if (!currentEyebrow && currentItems.length === 0) {
        currentEyebrow = String(p.eyebrow || '/ notes');
      }
      currentItems.push(block);
    }
  }
  flushEditorial();

  return `<div class="cms-rendered-article">${htmlParts.join('')}</div>`;
}

const CAT_META: Record<Category, { color: string; short: string }> = {
  personal: { color: '#ff6b81', short: 'personal' },
  opinions: { color: '#f5c542', short: 'opinion' },
  tutorials: { color: '#3ddbd9', short: 'tutorial' },
  architecture: { color: '#7c8cff', short: 'case study' },
};

const SEED_ORDER: Record<string, number> = {
  'psychology-and-software-development': 1,
  'sql-queries-inside-an-api': 2,
  'fullstack-with-a-broken-heart': 3,
  'bakingdesk-integrated-project-case-study': 4,
};

function shortDate(dateStr: string): string {
  return String(dateStr || '').replace(/,\s*\d{4}$/, '');
}

function buildSpineHtml(allArticles: LiveArticle[], filter: 'all' | Category): string {
  if (allArticles.length === 0) return '';

  let featured: LiveArticle;
  let rows: Array<{ article: LiveArticle; num: string; dimmed: boolean }> = [];

  if (filter === 'all') {
    featured = allArticles[0];
    rows = allArticles.slice(1).map((a, idx) => ({
      article: a,
      num: String(idx + 2).padStart(2, '0'),
      dimmed: false,
    }));
  } else {
    const matching = allArticles.filter((a) => a.category === filter);
    const others = allArticles.filter((a) => a.category !== filter);
    featured = matching[0] || allArticles[0];
    const restMatching = matching.slice(1).map((a, idx) => ({
      article: a,
      num: String(idx + 2).padStart(2, '0'),
      dimmed: false,
    }));
    const restOthers = others
      .filter((a) => a.slug !== featured.slug)
      .map((a, idx) => ({
        article: a,
        num: String(restMatching.length + idx + 2).padStart(2, '0'),
        dimmed: true,
      }));
    rows = [...restMatching, ...restOthers];
  }

  const fMeta = CAT_META[featured.category];
  const fHref = `/blog/live?slug=${encodeURIComponent(featured.slug)}`;

  const featuredHtml = `
    <article
      class="th2__featured"
      data-category="${featured.category}"
      data-prism-hover="${featured.category}"
      style="--cat-color: ${fMeta.color}"
    >
      <span class="th2__dot th2__dot--featured" style="background:${fMeta.color}"></span>
      <div class="th2__meta" style="color:${fMeta.color}">
        ${esc(fMeta.short)} &middot; ${esc(featured.dateDisplay)} &middot; ${featured.readingTime} min
      </div>
      <h2 class="th2__featured-title">
        <a href="${fHref}" data-nav>${esc(featured.title)}</a>
      </h2>
      <p class="th2__featured-lead">${esc(featured.lead)}</p>
      <a
        href="${fHref}"
        class="th2__featured-cta"
        style="border-bottom-color:${fMeta.color}"
        data-nav
      >
        read thread &rarr;
      </a>
    </article>`;

  const rowsHtml = rows
    .map(({ article, num, dimmed }) => {
      const rMeta = CAT_META[article.category];
      const href = `/blog/live?slug=${encodeURIComponent(article.slug)}`;
      return `
        <article
          class="th2__row${dimmed ? ' th2__row--dimmed' : ''}"
          data-category="${article.category}"
          data-prism-hover="${article.category}"
          style="--cat-color: ${rMeta.color}"
        >
          <span class="th2__dot" style="background:${rMeta.color}"></span>
          <span class="th2__num">${num}</span>
          <a class="th2__ttl" href="${href}" data-nav>${esc(article.title)}</a>
          <span class="th2__date">${esc(shortDate(article.dateDisplay))}</span>
          <p class="th2__ex">
            ${esc(article.lead)} &middot; <span style="color:${rMeta.color}">${article.readingTime} min</span>
          </p>
        </article>`;
    })
    .join('');

  return `
    ${featuredHtml}
    <div class="th2__rows">
      ${rowsHtml}
      <div class="th2__rows-end"></div>
    </div>
    <p class="th2__quote">
      &ldquo;The code compiles, but the real question is &mdash; did you learn something today?&rdquo;
    </p>`;
}

let activeVisitEventId = '';
let activeVisitKey = '';
let activeVisitPath = '';
let activeVisitDocSlug = '';
let activeVisitStartMs = 0;
let unloadBound = false;

function generateVisitId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fallback
  }
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function flushBlogVisitDwell(): void {
  if (!activeVisitEventId || !activeVisitStartMs) return;
  const cmsBase = resolveCmsBaseUrl();
  if (!cmsBase) return;
  const dwellSec = Math.max(0, Math.round((Date.now() - activeVisitStartMs) / 1000));
  const payload = JSON.stringify({
    event_id: activeVisitEventId,
    site_slug: 'diego-dev-blog',
    page_path: activeVisitPath || window.location.pathname || '/',
    doc_slug: activeVisitDocSlug || undefined,
    dwell_sec: dwellSec,
  });

  activeVisitEventId = '';
  activeVisitStartMs = 0;

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        `${cmsBase}/api/v1/telemetry/collect`,
        new Blob([payload], { type: 'text/plain;charset=UTF-8' })
      );
      return;
    }
  } catch {
    // fallback to fetch keepalive
  }

  fetch(`${cmsBase}/api/v1/telemetry/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

export function trackBlogPageView(): void {
  const cmsBase = resolveCmsBaseUrl();
  if (!cmsBase) return;

  if (!unloadBound) {
    unloadBound = true;
    window.addEventListener('pagehide', flushBlogVisitDwell);
  }

  const rawPath = window.location.pathname || '/';
  const qsSlug = new URLSearchParams(window.location.search).get('slug') || '';
  let docSlug = '';
  let normalizedPath = rawPath;

  if (rawPath.startsWith('/blog/live') && qsSlug) {
    docSlug = qsSlug;
    normalizedPath = `/blog/${qsSlug}`;
  } else if (rawPath.startsWith('/blog/') && rawPath.length > 6) {
    docSlug = rawPath.slice(6).replace(/\/+$/, '');
    normalizedPath = `/blog/${docSlug}`;
  }

  const visitKey = `${normalizedPath}|${docSlug}`;
  if (activeVisitEventId && activeVisitKey === visitKey) return;
  if (activeVisitEventId) flushBlogVisitDwell();

  activeVisitEventId = generateVisitId();
  activeVisitKey = visitKey;
  activeVisitPath = normalizedPath;
  activeVisitDocSlug = docSlug;
  activeVisitStartMs = Date.now();

  fetch(`${cmsBase}/api/v1/telemetry/collect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_id: activeVisitEventId,
      site_slug: 'diego-dev-blog',
      page_path: normalizedPath,
      doc_slug: docSlug || undefined,
      referrer: document.referrer || '',
    }),
    keepalive: true,
  }).catch(() => {});
}

export async function syncBlogFromCms(): Promise<void> {
  trackBlogPageView();
  const cmsBase = resolveCmsBaseUrl();
  if (!cmsBase) return;

  try {
    const res = await fetch(`${cmsBase}/api/v1/documents?content_type=DEV_BLOG&status=PUBLICADO&limit=100`, {
      signal: AbortSignal.timeout(1800),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { items?: CmsDocument[] };
    const docs = (data.items || []).sort((a, b) => {
      const oa = SEED_ORDER[a.slug] ?? 0;
      const ob = SEED_ORDER[b.slug] ?? 0;
      if (oa === 0 && ob === 0) {
        return String(b.published_at || b.updated_at).localeCompare(String(a.published_at || a.updated_at));
      }
      if (oa === 0) return -1;
      if (ob === 0) return 1;
      return oa - ob;
    });
    const articles = docs.map((d, i) => mapDoc(d, i));

    // 1. En el Hub (/): actualizar contador thoughts (XX)
    const hubLabel = document.querySelector('.hub-nav__btn[href="/thoughts"] .hub-nav__label');
    if (hubLabel) {
      hubLabel.textContent = `thoughts (${String(articles.length).padStart(2, '0')})`;
    }

    // 2. En /thoughts: actualizar hilos en vivo y contadores (Thoughts v2)
    const thoughtsSection = document.getElementById('thoughts');
    if (thoughtsSection && articles.length > 0) {
      const counts: Record<'all' | Category, LiveArticle[]> = {
        all: articles,
        tutorials: articles.filter((a) => a.category === 'tutorials'),
        opinions: articles.filter((a) => a.category === 'opinions'),
        personal: articles.filter((a) => a.category === 'personal'),
        architecture: articles.filter((a) => a.category === 'architecture'),
      };

      const setCount = (tabId: string, val: number) => {
        const el = document.querySelector(`#${tabId} .thoughts__tab-count`);
        if (el) el.textContent = String(val).padStart(2, '0');
      };
      setCount('tabAll', counts.all.length);
      setCount('tabTutorials', counts.tutorials.length);
      setCount('tabOpinions', counts.opinions.length);
      setCount('tabPersonal', counts.personal.length);
      setCount('tabArchitecture', counts.architecture.length);

      const panelMap: Array<[string, 'all' | Category]> = [
        ['panelAll', 'all'],
        ['panelTutorials', 'tutorials'],
        ['panelOpinions', 'opinions'],
        ['panelPersonal', 'personal'],
        ['panelArchitecture', 'architecture'],
      ];
      for (const [panelId, filterKey] of panelMap) {
        const feed = document.querySelector(`#${panelId} .thoughts__feed`);
        if (feed) {
          feed.innerHTML = buildSpineHtml(articles, filterKey);
        }
      }
    }

    // 3. En /blog/live?slug=...: renderizar el artículo completo desde el CMS
    const liveRoot = document.getElementById('liveArticleRoot');
    if (liveRoot) {
      const slug = new URLSearchParams(window.location.search).get('slug') || '';
      const found = articles.find((a) => a.slug === slug) || articles[0];
      if (!found) {
        liveRoot.innerHTML = `<div style="padding:140px 24px;text-align:center;color:#9ba1ae;">No se encontró el artículo "${esc(slug)}" publicado en el CMS.</div>`;
        return;
      }

      document.title = `${found.title} — Diego Cortés Hernandez`;
      const indicatorEl = document.getElementById('subNavIndicator');
      if (indicatorEl) indicatorEl.textContent = `${found.counterNum} / ${found.counterLabel}`;

      liveRoot.innerHTML = `
        <section class="pj-hero subpage-hero" id="articleHero" data-category="${found.category}">
          <div class="pj-hero__bg"><div class="pj-hero__grid-pattern"></div><div class="pj-hero__overlay"></div></div>
          <div class="pj-hero__content">
            <div class="pj-hero__meta">
              <span class="pj-hero__tag">${esc(found.heroTag)}</span>
              <span class="pj-hero__category pj-hero__category--${found.category}">${esc(found.categoryLabel)}</span>
              <span class="pj-hero__date">${esc(found.dateDisplay)} &middot; ${found.readingTime} min read</span>
            </div>
            <h1 class="pj-hero__title">
              <span class="heading-line is-visible"><span class="heading-line__inner">${esc(found.heroTitle)}</span></span>
              ${
                found.heroSubtitle
                  ? `<span class="heading-line is-visible"><span class="heading-line__inner"><em>${esc(found.heroSubtitle)}</em></span></span>`
                  : ''
              }
            </h1>
            <p class="pj-hero__subtitle">${esc(found.lead)}</p>
            <div class="pj-hero__actions">
              <a href="#articleBody" class="pj-hero__visit-btn">
                <span class="pj-hero__visit-label">[ read full thread ]</span>
                <span class="pj-hero__visit-arrow">&darr;</span>
              </a>
              ${
                found.repoUrl
                  ? `<a href="${esc(found.repoUrl)}" target="_blank" rel="noopener noreferrer" class="pj-hero__scroll-hint"><span>view source repository</span><span aria-hidden="true">&nearr;</span></a>`
                  : ''
              }
            </div>
          </div>
        </section>
        <div id="articleBody" class="article-body-wrapper">
          ${renderArticleBlocksHtml(found.blocks, cmsBase)}
        </div>
        <div class="next-page">
          <a href="/thoughts" class="next-page__link" data-nav>
            <span class="next-page__arrow">&larr;</span>
            <span class="next-page__label">back to thoughts</span>
          </a>
        </div>`;
    }
  } catch {
    // Silencioso: conserva la versión estática precompilada
  }
}

