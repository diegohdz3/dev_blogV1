import fs from 'node:fs';
import path from 'node:path';

export interface CmsCanvasBlock {
  block_id: string;
  block_type: string;
  order_index: number;
  content_payload: Record<string, any>;
  style_config?: Record<string, any>;
}

export interface CmsDocument {
  document_id: string;
  slug: string;
  title: string;
  content_type: 'DEV_BLOG' | 'LANDING_CV' | 'PROFESSIONAL_PROFILE';
  status: 'BORRADOR' | 'EN_REVISION' | 'PUBLICADO' | 'ARCHIVADO';
  template_id: string;
  frozen_template?: {
    name?: string;
    allow_published_edit: boolean;
    metadata_contract: Array<{ field_key: string; expected_type: string; is_required: boolean }>;
    layout_structure: { regions: string[] };
  } | null;
  metadata_values?: Record<string, any> | null;
  canvas_blocks: CmsCanvasBlock[];
  published_at?: string | null;
  updated_at: string;
}

export interface BlogArticle {
  document_id: string;
  slug: string;
  title: string;
  heroTag: string;
  counterNum: string;
  counterLabel: string;
  heroTitle: string;
  heroSubtitle: string;
  lead: string;
  category: 'tutorials' | 'architecture' | 'opinions' | 'personal';
  categoryLabel: string;
  dateDisplay: string;
  readingTime: number;
  roleSummary: string;
  repoUrl?: string;
  publishedAt: string;
  frozenTemplateName: string;
  blocks: CmsCanvasBlock[];
  toc: Array<{ id: string; label: string; order: number }>;
}

function normalizeCategory(rawTag?: string, heroCategory?: string): 'tutorials' | 'architecture' | 'opinions' | 'personal' {
  const combined = `${rawTag || ''} ${heroCategory || ''}`.toLowerCase();
  if (combined.includes('tutorial') || combined.includes('sql')) return 'tutorials';
  if (combined.includes('opinion') || combined.includes('psych')) return 'opinions';
  if (combined.includes('personal') || combined.includes('heart')) return 'personal';
  return 'architecture';
}

function mapCmsDocToArticle(doc: CmsDocument, index: number): BlogArticle {
  const sortedBlocks = [...(doc.canvas_blocks || [])].sort((a, b) => a.order_index - b.order_index);
  const heroBlock = sortedBlocks.find((b) => b.block_type === 'CASE_HERO');
  const firstParagraph = sortedBlocks.find((b) => b.block_type === 'PARAGRAPH' || b.block_type === 'OVERVIEW_SECTION');

  const meta = doc.metadata_values || {};
  const category = normalizeCategory(meta.canonical_tag, heroBlock?.content_payload?.category);
  const categoryLabelMap: Record<BlogArticle['category'], string> = {
    tutorials: '/ tutorial',
    architecture: '/ full-stack',
    opinions: '/ opinion',
    personal: '/ personal',
  };

  const heroTitle = heroBlock?.content_payload?.title || doc.title;
  const heroSubtitle = heroBlock?.content_payload?.subtitle || '';
  const heroTag =
    heroBlock?.content_payload?.tag ||
    (category === 'architecture' ? `< project / 0${index + 1} />` : `< thought / 0${index + 1} />`);
  const counterNum = heroBlock?.content_payload?.counter_num || `02.${index + 1}`;
  const counterLabel = heroBlock?.content_payload?.counter_label || category;

  const lead =
    heroBlock?.content_payload?.lead ||
    firstParagraph?.content_payload?.text ||
    'Technical article and architectural notes by Diego Cortés Hernandez.';

  const dateDisplay =
    heroBlock?.content_payload?.date ||
    (doc.published_at ? new Date(doc.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '2026');

  // Extract Table of Contents from structural blocks
  const toc: Array<{ id: string; label: string; order: number }> = [];
  for (const b of sortedBlocks) {
    if (b.block_type === 'HEADING' && Number(b.content_payload?.level) !== 3 && b.content_payload?.text) {
      toc.push({
        id: `section-${b.order_index}`,
        label: String(b.content_payload.text),
        order: b.order_index,
      });
    } else if (b.block_type === 'OVERVIEW_SECTION' && b.content_payload?.heading) {
      toc.push({
        id: `section-${b.order_index}`,
        label: String(b.content_payload.heading),
        order: b.order_index,
      });
    } else if (b.block_type === 'TIMELINE_SECTION' && b.content_payload?.heading) {
      toc.push({
        id: `section-${b.order_index}`,
        label: String(b.content_payload.heading),
        order: b.order_index,
      });
    } else if (b.block_type === 'CHALLENGE_CARDS' && b.content_payload?.heading) {
      toc.push({
        id: `section-${b.order_index}`,
        label: String(b.content_payload.heading),
        order: b.order_index,
      });
    }
  }

  return {
    document_id: doc.document_id,
    slug: doc.slug,
    title: doc.title,
    heroTag,
    counterNum,
    counterLabel,
    heroTitle,
    heroSubtitle,
    lead,
    category,
    categoryLabel: categoryLabelMap[category],
    dateDisplay,
    readingTime: Number(meta.reading_time) || 6,
    roleSummary: String(meta.role_summary || 'Full-Stack & Frontend Engineering'),
    repoUrl: meta.repo_url ? String(meta.repo_url) : undefined,
    publishedAt: doc.published_at || doc.updated_at,
    frozenTemplateName: doc.frozen_template?.name || 'Plantilla Bitácora Técnica (Frozen)',
    blocks: sortedBlocks,
    toc,
  };
}

/**
 * Obtiene todos los artículos publicados de tipo DEV_BLOG.
 * Intenta primero consultar la API en vivo (cms-core-api) si está activa,
 * y usa como fuente estática garantizada las instantáneas en ../cms/snapshots/.
 */
export async function getPublishedBlogArticles(): Promise<BlogArticle[]> {
  const cmsApiUrl = process.env.CMS_API_URL || 'http://127.0.0.1:4000';

  // 1. Intentar obtener desde cms-core-api si está encendida
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const res = await fetch(`${cmsApiUrl}/api/v1/documents?content_type=DEV_BLOG&status=PUBLICADO`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { items: CmsDocument[] };
      if (Array.isArray(data.items) && data.items.length > 0) {
        return data.items.map((doc, idx) => mapCmsDocToArticle(doc, idx));
      }
    }
  } catch {
    // Fallback automático a los snapshots estáticos generados por el Pipeline Estático del CMS
  }

  // 2. Leer desde ../cms/snapshots/*.snapshot.json
  const candidates = [
    path.resolve(process.cwd(), '../cms/snapshots'),
    path.resolve(process.cwd(), 'cms/snapshots'),
  ];

  const snapshotsDir = candidates.find((dir) => fs.existsSync(dir));
  if (!snapshotsDir) {
    return [];
  }

  const files = fs.readdirSync(snapshotsDir).filter((f) => f.endsWith('.snapshot.json'));
  const docs: CmsDocument[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(snapshotsDir, file), 'utf-8');
      const parsed = JSON.parse(raw);
      const doc = parsed.document as CmsDocument | undefined;
      if (doc && doc.content_type === 'DEV_BLOG' && doc.status === 'PUBLICADO') {
        docs.push(doc);
      }
    } catch {
      // ignore malformed snapshot
    }
  }

  docs.sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
  return docs.map((doc, idx) => mapCmsDocToArticle(doc, idx));
}
