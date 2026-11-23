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
  toc: Array<{ id: string; label: string }>;
}

const CAT_META: Record<Category, { color: string; short: string; wavelength: string }> = {
  personal: { color: '#ff6b81', short: 'personal', wavelength: 'λ 650nm · personal' },
  opinions: { color: '#f5c542', short: 'opinion', wavelength: 'λ 590nm · opinion' },
  tutorials: { color: '#3ddbd9', short: 'tutorial', wavelength: 'λ 490nm · tutorial' },
  architecture: { color: '#7c8cff', short: 'case study', wavelength: 'λ 410nm · case study' },
};

const SEED_ORDER: Record<string, number> = {
  'psychology-and-software-development': 1,
  'sql-queries-inside-an-api': 2,
  'fullstack-with-a-broken-heart': 3,
  'bakingdesk-integrated-project-case-study': 4,
};

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

  const toc: Array<{ id: string; label: string }> = [];
  for (const b of blocks) {
    if (b.block_type === 'HEADING' && Number(b.content_payload?.level) !== 3 && b.content_payload?.text) {
      toc.push({ id: `section-${b.order_index}`, label: String(b.content_payload.text) });
    } else if (
      (b.block_type === 'OVERVIEW_SECTION' ||
        b.block_type === 'TIMELINE_SECTION' ||
        b.block_type === 'CHALLENGE_CARDS') &&
      b.content_payload?.heading
    ) {
      toc.push({ id: `section-${b.order_index}`, label: String(b.content_payload.heading) });
    }
  }

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
    readingTime: Number(meta.reading_time) || 6,
    roleSummary: String(meta.role_summary || 'Full-Stack & Frontend Engineering'),
    repoUrl: meta.repo_url ? String(meta.repo_url) : undefined,
    frozenTemplateName: doc.frozen_template?.name || 'Plantilla Bitácora Técnica (CMS)',
    blocks,
    toc,
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
  return (
    qsCms ||
    stored ||
    envUrl ||
    (isLocal ? 'http://127.0.0.1:4000' : 'https://cms-core-api-production.up.railway.app')
  ).replace(/\/+$/, '');
}

function sanitizeInlineHtml(html: string): string {
  return html.replace(/<\/?(?!(?:strong|b|em|i|code|a|br)\b)[^>]*>/gi, '');
}

function renderArticleBlocksHtml(blocks: CmsCanvasBlock[], cmsBase: string, accentColor: string): string {
  const contentBlocks = blocks.filter((b) => b.block_type !== 'CASE_HERO');
  let sectionIdx = 0;
  let currentSectionId = 'section-1';
  let currentItems: CmsCanvasBlock[] = [];
  let currentHeading: string | undefined;
  let currentEyebrow: string | undefined;
  const htmlParts: string[] = [];

  const flushEditorial = () => {
    if (!currentHeading && currentItems.length === 0) return;
    sectionIdx++;
    const num = String(sectionIdx).padStart(2, '0');

    const innerHtml = currentItems
      .map((item) => {
        const p = item.content_payload || {};
        if (item.block_type === 'HEADING') {
          return `<h3 class="th2-reader__subheading">${esc(p.text || '')}</h3>`;
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
          return `<div class="th-article__code th2-reader__code">
            <div class="th-article__code-header">
              <span class="th-article__code-lang" style="color:${accentColor}">${esc(p.language || 'code')}</span>
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
          return `<div class="th-article__callout th2-reader__callout ${isWarn ? 'th-article__callout--warning' : ''}">
            <div class="th-article__callout-line" style="${isWarn ? '' : `background:${accentColor}`}"></div>
            <blockquote>${text}</blockquote>
          </div>`;
        }
        return '';
      })
      .join('');

    htmlParts.push(`
      <section class="th2-reader__section" id="${esc(currentSectionId)}" data-reader-section="${esc(currentSectionId)}">
        <span class="th2__dot th2-reader__sec-dot" style="background:${accentColor}"></span>
        <div class="th2-reader__sec-left">
          <div class="th2-reader__sec-meta">
            <span class="th2-reader__sec-num">${num}</span>
            ${currentEyebrow ? `<span class="th2-reader__sec-eyebrow" style="color:${accentColor}">${esc(currentEyebrow)}</span>` : ''}
          </div>
          ${currentHeading ? `<h2 class="th2-reader__sec-title">${esc(currentHeading)}</h2>` : ''}
        </div>
        <div class="th2-reader__prose">${innerHtml}</div>
      </section>`);

    currentItems = [];
    currentHeading = undefined;
    currentEyebrow = undefined;
  };

  for (const block of contentBlocks) {
    const p = block.content_payload || {};
    if (block.block_type === 'OVERVIEW_SECTION') {
      flushEditorial();
      sectionIdx++;
      const num = String(sectionIdx).padStart(2, '0');
      const secId = `section-${block.order_index}`;
      const paras = String(p.text || '')
        .split(/\n\n+/)
        .filter(Boolean)
        .map((t) => `<p>${esc(t)}</p>`)
        .join('');
      htmlParts.push(`
        <section class="th2-reader__section" id="${secId}" data-reader-section="${secId}">
          <span class="th2__dot th2-reader__sec-dot" style="background:${accentColor}"></span>
          <div class="th2-reader__sec-left">
            <div class="th2-reader__sec-meta">
              <span class="th2-reader__sec-num">${num}</span>
              <span class="th2-reader__sec-eyebrow" style="color:${accentColor}">${esc(p.eyebrow || '/ overview')}</span>
            </div>
            <h2 class="th2-reader__sec-title">${esc(p.heading || 'Overview')}</h2>
          </div>
          <div class="th2-reader__prose">${paras}</div>
        </section>`);
    } else if (block.block_type === 'HEADING' && Number(p.level) !== 3) {
      flushEditorial();
      currentSectionId = `section-${block.order_index}`;
      currentEyebrow = String(p.eyebrow || `/ section 0${sectionIdx + 1}`);
      currentHeading = String(p.text || '');
    } else {
      if (!currentEyebrow && currentItems.length === 0) {
        currentSectionId = `section-${block.order_index}`;
        currentEyebrow = String(p.eyebrow || '/ notes');
      }
      currentItems.push(block);
    }
  }
  flushEditorial();

  return `<div class="th2-reader__sections" style="--cat-color: ${accentColor}">${htmlParts.join('')}</div>`;
}

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
  const fSearch = esc(`${featured.title} ${featured.lead} ${fMeta.short}`.toLowerCase());
  const fChaptersHtml =
    featured.toc.length > 0
      ? `<div class="th2__featured-chapters">
          <span class="th2__chapters-label">/ chapters</span>
          <div class="th2__chapters-list">
            ${featured.toc
              .slice(0, 4)
              .map(
                (sec, idx) => `
              <a href="${fHref}#${esc(sec.id)}" class="th2__chapter-link" data-nav>
                <span class="th2__chapter-num">${String(idx + 1).padStart(2, '0')}</span>
                <span>${esc(sec.label)}</span>
              </a>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const featuredHtml = `
    <article
      class="th2__featured"
      data-category="${featured.category}"
      data-prism-hover="${featured.category}"
      data-search-text="${fSearch}"
      style="--cat-color: ${fMeta.color}"
    >
      <span class="th2__dot th2__dot--featured" style="background:${fMeta.color}"></span>
      <div class="th2__featured-head">
        <div class="th2__meta" style="color:${fMeta.color}">
          <span>01</span>
          <span>&middot;</span>
          <span>${esc(fMeta.short)}</span>
          <span>&middot;</span>
          <span>${esc(featured.dateDisplay)}</span>
          <span>&middot;</span>
          <span>${featured.readingTime} min</span>
        </div>
        <span class="th2__featured-wavelength">${esc(fMeta.wavelength)}</span>
      </div>
      <h2 class="th2__featured-title">
        <a href="${fHref}" data-nav>${esc(featured.title)}</a>
      </h2>
      <div class="th2__featured-grid">
        <div class="th2__featured-main">
          <p class="th2__featured-lead">${esc(featured.lead)}</p>
          <a
            href="${fHref}"
            class="th2__featured-cta"
            style="border-bottom-color:${fMeta.color}"
            data-nav
          >
            read thread &rarr;
          </a>
        </div>
        ${fChaptersHtml}
      </div>
    </article>`;

  const rowsHtml = rows
    .map(({ article, num, dimmed }) => {
      const rMeta = CAT_META[article.category];
      const href = `/blog/live?slug=${encodeURIComponent(article.slug)}`;
      const rSearch = esc(`${article.title} ${article.lead} ${rMeta.short}`.toLowerCase());
      const rowChapters =
        article.toc.length > 0
          ? `<div class="th2__row-chapters">
              ${article.toc
                .slice(0, 3)
                .map(
                  (sec, idx) =>
                    `<a href="${href}#${esc(sec.id)}" data-nav><span>${String(idx + 1).padStart(
                      2,
                      '0'
                    )}</span> ${esc(sec.label)}</a>`
                )
                .join('')}
            </div>`
          : '';
      return `
        <article
          class="th2__row${dimmed ? ' th2__row--dimmed' : ''}"
          data-category="${article.category}"
          data-prism-hover="${article.category}"
          data-search-text="${rSearch}"
          style="--cat-color: ${rMeta.color}"
        >
          <span class="th2__dot" style="background:${rMeta.color}"></span>
          <span class="th2__num">${num}</span>
          <div class="th2__row-primary">
            <a class="th2__ttl" href="${href}" data-nav>${esc(article.title)}</a>
            <span class="th2__row-role">${esc(article.roleSummary)}</span>
          </div>
          <div class="th2__row-middle">
            <p class="th2__row-lead">${esc(article.lead)}</p>
            ${rowChapters}
          </div>
          <div class="th2__row-right">
            <span class="th2__row-cat" style="color:${rMeta.color}">${esc(rMeta.short)} &middot; ${article.readingTime} min</span>
            <span class="th2__date">${esc(shortDate(article.dateDisplay))}</span>
            <a href="${href}" class="th2__row-go" style="color:${rMeta.color}" data-nav>read &rarr;</a>
          </div>
        </article>`;
    })
    .join('');

  return `
    ${featuredHtml}
    <div class="th2__rows">
      ${rowsHtml}
      <div class="th2__rows-end"></div>
    </div>
    <div class="th2__footer-bar">
      <p class="th2__quote">
        &ldquo;The code compiles, but the real question is &mdash; did you learn something today?&rdquo;
      </p>
      <span class="th2__footer-sig">diego cortés hernández // full-spectrum notes</span>
    </div>`;
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

    // 2. En /thoughts: actualizar hilos en vivo y contadores (Thoughts v2 Wide 2-Column)
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

      const totalCountEl = document.getElementById('th2TotalCount');
      if (totalCountEl) {
        const mins = articles.reduce((acc, a) => acc + (Number(a.readingTime) || 6), 0);
        totalCountEl.textContent = `${String(articles.length).padStart(2, '0')} · ${mins}m`;
      }

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

    // 3. En /blog/live?slug=...: renderizar el artículo completo con la arquitectura 2-Column Wide Boxless Reader
    const liveRoot = document.getElementById('liveArticleRoot');
    if (liveRoot) {
      const slug = new URLSearchParams(window.location.search).get('slug') || '';
      const found = articles.find((a) => a.slug === slug) || articles[0];
      if (!found) {
        liveRoot.innerHTML = `<div style="padding:140px 24px;text-align:center;color:#9ba1ae;">No se encontró el artículo "${esc(slug)}" publicado en el CMS.</div>`;
        return;
      }

      const meta = CAT_META[found.category] || CAT_META.tutorials;
      const otherArticles = articles.filter((a) => a.slug !== found.slug);

      document.title = `${found.title} — Diego Cortés Hernandez`;
      const indicatorEl = document.getElementById('subNavIndicator');
      if (indicatorEl) indicatorEl.textContent = `${found.counterNum} / ${meta.short}`;

      const tocHtml =
        found.toc.length > 0
          ? `<nav class="th2-reader__toc" aria-label="Table of contents">
              <div class="th2-reader__toc-title">/ chapters</div>
              <ol class="th2-reader__toc-list" id="th2ReaderTocList">
                ${found.toc
                  .map(
                    (sec, idx) => `
                  <li>
                    <a href="#${esc(sec.id)}" class="th2-reader__toc-link${idx === 0 ? ' is-active' : ''}" data-toc-target="${esc(sec.id)}">
                      <span class="th2-reader__toc-dot"></span>
                      <span class="th2-reader__toc-num">${String(idx + 1).padStart(2, '0')}</span>
                      <span class="th2-reader__toc-label">${esc(sec.label)}</span>
                    </a>
                  </li>`
                  )
                  .join('')}
              </ol>
            </nav>`
          : '';

      const othersHtml =
        otherArticles.length > 0
          ? `<div class="th2-reader__others">
              <div class="th2-reader__toc-title">/ other thoughts</div>
              <div class="th2-reader__switcher">
                ${otherArticles
                  .map((other) => {
                    const oMeta = CAT_META[other.category] || CAT_META.tutorials;
                    const oHref = `/blog/live?slug=${encodeURIComponent(other.slug)}`;
                    return `<a href="${oHref}" class="th2-reader__switch-item" data-nav>
                      <span class="th2-reader__switch-dot" style="background:${oMeta.color}"></span>
                      <span class="th2-reader__switch-title">${esc(other.title)}</span>
                    </a>`;
                  })
                  .join('')}
              </div>
            </div>`
          : '';

      liveRoot.innerHTML = `
        <section class="th2 th2-reader subpage-hero" id="articleHero" data-category="${found.category}" style="--cat-color: ${meta.color}">
          <div class="thoughts__bg" aria-hidden="true">
            <div class="thoughts__bg-overlay th2__bg-overlay"></div>
          </div>

          <div class="th2-reader__workbench">
            <aside class="th2-reader__left">
              <a href="/thoughts" class="th2-reader__back" data-nav>
                <span aria-hidden="true">&larr;</span>
                <span>all thoughts</span>
              </a>

              <div class="th2__diagram" data-active-ray="${found.category}">
                <svg aria-hidden="true" viewBox="0 0 340 120" width="300" height="106" class="th2__svg">
                  <defs>
                    <linearGradient id="th2LiveCoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
                      <stop offset="100%" stop-color="${meta.color}" stop-opacity="0.55" />
                    </linearGradient>
                    <linearGradient id="th2LivePrismFill" x1="50%" y1="0%" x2="50%" y2="100%">
                      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.07" />
                      <stop offset="100%" stop-color="${meta.color}" stop-opacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line class="th2__beam-in" x1="0" y1="70" x2="123" y2="70" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" />
                  <line class="th2__beam-pulse" x1="0" y1="70" x2="123" y2="70" stroke="#ffffff" stroke-width="2" />
                  <polygon class="th2__caustic" points="123,70 175,60 175,80" fill="url(#th2LiveCoreGrad)" opacity="0.32" />
                  <line class="th2__beam-core" x1="123" y1="70" x2="174" y2="68" stroke="url(#th2LiveCoreGrad)" stroke-width="1.6" />
                  <polygon class="th2__prism-glow" points="150,18 205,102 95,102" fill="url(#th2LivePrismFill)" stroke="#5e5a68" stroke-width="1.25" />
                  <polygon class="th2__prism-trace" points="150,18 205,102 95,102" fill="none" stroke="#ffffff" stroke-width="1.35" />
                  <circle class="th2__node-in" cx="123" cy="70" r="2.2" fill="#ffffff" />
                  <circle class="th2__node-out" cx="174" cy="68" r="2" fill="${meta.color}" opacity="0.85" />

                  <g class="th2__ray-group" data-ray="personal">
                    <line class="th2__ray" x1="174" y1="68" x2="340" y2="34" stroke="#ff6b81" stroke-width="1.5" />
                    <line class="th2__ray-flow th2__ray-flow--1" x1="174" y1="68" x2="340" y2="34" stroke="#ff94a4" stroke-width="2.2" />
                  </g>
                  <g class="th2__ray-group" data-ray="opinions">
                    <line class="th2__ray" x1="174" y1="68" x2="340" y2="56" stroke="#f5c542" stroke-width="1.5" />
                    <line class="th2__ray-flow th2__ray-flow--2" x1="174" y1="68" x2="340" y2="56" stroke="#ffe082" stroke-width="2.2" />
                  </g>
                  <g class="th2__ray-group" data-ray="tutorials">
                    <line class="th2__ray" x1="174" y1="68" x2="340" y2="78" stroke="#3ddbd9" stroke-width="1.5" />
                    <line class="th2__ray-flow th2__ray-flow--3" x1="174" y1="68" x2="340" y2="78" stroke="#88f7f5" stroke-width="2.2" />
                  </g>
                  <g class="th2__ray-group" data-ray="architecture">
                    <line class="th2__ray" x1="174" y1="68" x2="340" y2="100" stroke="#7c8cff" stroke-width="1.5" />
                    <line class="th2__ray-flow th2__ray-flow--4" x1="174" y1="68" x2="340" y2="100" stroke="#aeb8ff" stroke-width="2.2" />
                  </g>
                </svg>
                <div class="th2__wavelength">
                  <span class="th2__wavelength-dot" style="background:${meta.color};box-shadow:0 0 10px ${meta.color}"></span>
                  <span style="color:${meta.color}">${esc(meta.wavelength)}</span>
                </div>
              </div>

              <div class="th2-reader__progress-line">
                <div class="th2-reader__progress-head">
                  <span>reading</span>
                  <span id="th2ReadPercent" style="color:${meta.color}">0%</span>
                </div>
                <div class="th2-reader__progress-track">
                  <div class="th2-reader__progress-fill" id="th2ReadFill" style="background:${meta.color}"></div>
                </div>
              </div>

              ${tocHtml}
              ${othersHtml}
            </aside>

            <div class="th2-reader__center" id="articleBody">
              <div class="th2__spine th2-reader__spine">
                <header class="th2-reader__header">
                  <span class="th2__dot th2__dot--featured" style="background:${meta.color}"></span>
                  <div class="th2__featured-head">
                    <div class="th2__meta" style="color:${meta.color}">
                      <span>${esc(found.counterNum)}</span>
                      <span>&middot;</span>
                      <span>${esc(meta.short)}</span>
                      <span>&middot;</span>
                      <span>${esc(found.dateDisplay)}</span>
                      <span>&middot;</span>
                      <span>${found.readingTime} min read</span>
                    </div>
                    <span class="th2__featured-wavelength">${esc(found.roleSummary)}</span>
                  </div>
                  <h1 class="th2-reader__title">
                    ${esc(found.heroTitle)}
                    ${found.heroSubtitle ? `<span class="th2-reader__subtitle-em"> ${esc(found.heroSubtitle)}</span>` : ''}
                  </h1>
                  <p class="th2-reader__lead">${esc(found.lead)}</p>
                  <div class="th2-reader__header-actions">
                    <a href="#${esc(found.toc[0]?.id || 'articleBody')}" class="th2__featured-cta" style="border-bottom-color:${meta.color}">
                      read thread &darr;
                    </a>
                    ${
                      found.repoUrl
                        ? `<a href="${esc(found.repoUrl)}" target="_blank" rel="noopener noreferrer" class="th2-reader__repo-link"><span>source repository &nearr;</span></a>`
                        : ''
                    }
                    <button type="button" class="th2-reader__inline-btn" data-copy-href="/blog/live?slug=${encodeURIComponent(found.slug)}">copy link</button>
                  </div>
                </header>

                ${renderArticleBlocksHtml(found.blocks, cmsBase, meta.color)}

                <footer class="th2-reader__footer">
                  <div class="th2-reader__bottom-nav">
                    <a href="/thoughts" class="th2-reader__back" data-nav>&larr; back to thoughts</a>
                  </div>
                  <p class="th2__quote">
                    &ldquo;The code compiles, but the real question is &mdash; did you learn something today?&rdquo;
                  </p>
                </footer>
              </div>
            </div>
          </div>
        </section>`;
    }
  } catch {
    // Silencioso: conserva la versión estática precompilada
  }
}
